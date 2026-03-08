import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { VerificationResult } from '@/lib/storage';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

interface CorrectionInput {
  text: string;
  timeRef: number;
  priority: string;
  frameDescription?: string;
}

function buildVerifyPrompt(exercise: string): string {
  return `\
Eres un coach elite de calistenia analizando ${exercise}.

Las imágenes anteriores son frames extraídos del video, cada uno etiquetado con el segundo \
exacto y la corrección técnica que se quería verificar.

Para cada imagen etiquetada, evalúa CON TOTAL HONESTIDAD si el error descrito es realmente \
visible en ese frame específico. Ten en cuenta la descripción de lo que se esperaba ver \
(frameEsperado) para orientarte.

Si el frame muestra claramente el gesto o error descrito → confirmed: true.
Si el frame muestra algo distinto (fase preparatoria, otro momento, etc.) → confirmed: false \
y describe qué ves realmente y cuándo ocurre ese error aproximadamente.

Devuelve SOLAMENTE un JSON válido (sin texto adicional ni markdown):
{
  "verifications": [
    {
      "timeRef": <número con 1 decimal — el mismo del label de la imagen>,
      "confirmed": <true si el error es claramente visible en ESTA imagen, false si no>,
      "confidence": "<high|medium|low>",
      "observation": "<descripción objetiva y concisa de lo que ves en este frame>",
      "revisedCorrection": "<si confirmed=false: descripción de qué ves y dónde ocurre realmente el error, o null si confirmed=true>",
      "revisedTimeRef": <si confirmed=false: tu mejor estimación del segundo exacto donde SÍ se vería el error (número con 1 decimal), o null si confirmed=true>
    }
  ],
  "accuracy": <0-100, porcentaje de correcciones confirmadas>,
  "summary": "<evaluación directa: qué tan precisos fueron los timestamps del análisis original>"
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

    // Build interleaved parts: label → image → label → image ...
    const interleavedParts: { text?: string; inlineData?: { mimeType: 'image/jpeg'; data: string } }[] = [];
    for (let i = 0; i < corrections.length; i++) {
      const c = corrections[i];
      const frameDesc = c.frameDescription ? ` (se esperaba ver: "${c.frameDescription}")` : '';
      interleavedParts.push({
        text: `--- IMAGEN ${i + 1} | @ ${c.timeRef}s | [${c.priority.toUpperCase()}] "${c.text}"${frameDesc} ---`,
      });
      if (frames[i]) {
        interleavedParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frames[i].replace(/^data:image\/\w+;base64,/, ''),
          },
        });
      }
    }

    const response = await genai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{
        role: 'user',
        parts: [
          ...interleavedParts,
          { text: buildVerifyPrompt(exercise) },
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
