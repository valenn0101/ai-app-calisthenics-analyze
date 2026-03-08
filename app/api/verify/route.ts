import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { VerificationResult } from '@/lib/storage';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

interface CorrectionInput {
  text: string;
  timeRef: number;
  priority: string;
}

function buildVerifyPrompt(exercise: string, corrections: CorrectionInput[]): string {
  const correctionList = corrections
    .map((c, i) => `Frame ${i + 1} (@ ${c.timeRef}s) [${c.priority.toUpperCase()}]: "${c.text}"`)
    .join('\n');

  return `\
Eres un coach elite de calistenia. Anteriormente analizaste un video de ${exercise} y emitiste \
las siguientes correcciones técnicas, indicando el segundo exacto de cada una:

${correctionList}

Ahora te muestro los frames extraídos EXACTAMENTE en esos segundos para que verifiques tu análisis. \
Cada imagen corresponde al timestamp indicado arriba, en el mismo orden.

Para cada frame, evalúa con total honestidad si realmente se observa el error que describiste, \
o si tu análisis original fue impreciso o incorrecto.

Devuelve SOLAMENTE un JSON válido (sin texto adicional ni markdown):
{
  "verifications": [
    {
      "timeRef": <número con 1 decimal>,
      "confirmed": <true si el error es claramente visible, false si no>,
      "confidence": "<high|medium|low>",
      "observation": "<descripción exacta y objetiva de lo que ves en este frame>",
      "revisedCorrection": "<corrección revisada si confirmed=false, o null si confirmed=true>"
    }
  ],
  "accuracy": <0-100, porcentaje de correcciones del análisis original que se confirman>,
  "summary": "<evaluación honesta y directa de la precisión del análisis previo>"
}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
    }

    const body = await req.json() as {
      frames: string[];       // base64 frames at timeRef positions
      corrections: CorrectionInput[];
      exercise: string;
    };

    const { frames, corrections, exercise } = body;

    if (!frames?.length || !corrections?.length) {
      return NextResponse.json({ error: 'frames and corrections required' }, { status: 400 });
    }

    // Build image parts from base64 frames
    const imageParts = frames.map(frame => ({
      inlineData: {
        mimeType: 'image/jpeg' as const,
        data: frame.replace(/^data:image\/\w+;base64,/, ''),
      },
    }));

    const response = await genai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: buildVerifyPrompt(exercise, corrections) },
        ],
      }],
    });

    const rawText = response.text ?? '';
    if (!rawText) {
      return NextResponse.json({ error: 'No response from Gemini' }, { status: 500 });
    }

    let result: VerificationResult;
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse verification response', raw: rawText }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Verify error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
