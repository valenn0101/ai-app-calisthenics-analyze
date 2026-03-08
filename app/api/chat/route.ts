import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { AnalysisResult, VerificationResult } from '@/lib/storage';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

function buildContext(exercise: string, analysis: AnalysisResult, verification?: VerificationResult | null): string {
  const positives = analysis.positives
    .map(p => `  • ${p.text}${p.timeRef != null ? ` (@${p.timeRef}s)` : ''}`)
    .join('\n');

  const corrections = analysis.corrections
    .map(c => `  • [${c.priority.toUpperCase()}] ${c.text}${c.timeRef != null ? ` (@${c.timeRef}s)` : ''}`)
    .join('\n');

  let verificationSection = '';
  if (verification) {
    const items = verification.verifications
      .map(v =>
        `  • @${v.timeRef}s → ${v.confirmed ? '✓ Confirmado' : '↻ Revisado'} (${v.confidence}): ${v.observation}` +
        (v.revisedCorrection ? `\n    Revisión: ${v.revisedCorrection}` : '') +
        (v.revisedTimeRef != null ? `\n    Timestamp corregido: @${v.revisedTimeRef}s` : '')
      )
      .join('\n');
    verificationSection = `

Verificación de frames (precisión: ${verification.accuracy}%):
${items}

Resumen verificación: ${verification.summary}`;
  }

  return `Eres un coach elite de calistenia. Tienes acceso al siguiente análisis técnico de un video del atleta:

Ejercicio: ${exercise}
Score: ${analysis.score}/10
Fase detectada: ${analysis.phase}

Puntos positivos:
${positives || '  (ninguno registrado)'}

Correcciones técnicas:
${corrections || '  (ninguna)'}

Cues técnicos: ${analysis.cues.join(', ')}
Próximos pasos: ${analysis.nextSteps.join(' | ')}${verificationSection}

Instrucciones de respuesta:
- Responde SIEMPRE en español, de forma concisa y técnica
- Máximo 3-4 párrafos por respuesta; si la pregunta es simple, responde en 1-2 frases
- Cuando expliques correcciones, da ejercicios o drills concretos y progresiones
- Haz referencia a los timestamps (@Xs) cuando sea relevante para ser específico
- Si preguntan algo fuera del análisis, responde brevemente pero redirige al contexto del video
- Sé directo, no uses frases de relleno como "¡Claro!" o "¡Excelente pregunta!"`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
    }

    const { messages, exercise, analysis, verification } = await req.json() as {
      messages: { role: 'user' | 'model'; content: string }[];
      exercise: string;
      analysis: AnalysisResult;
      verification?: VerificationResult | null;
    };

    if (!messages?.length || !analysis) {
      return NextResponse.json({ error: 'messages and analysis required' }, { status: 400 });
    }

    const context = buildContext(exercise, analysis, verification);

    const contents = [
      { role: 'user' as const, parts: [{ text: context }] },
      {
        role: 'model' as const,
        parts: [{ text: 'Entendido. Tengo el análisis completo. ¿Qué quieres saber?' }],
      },
      ...messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
    ];

    const response = await genai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents,
    });

    const text = response.text ?? '';
    if (!text) {
      return NextResponse.json({ error: 'No response from Gemini' }, { status: 500 });
    }

    return NextResponse.json({ message: text });
  } catch (error: unknown) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
