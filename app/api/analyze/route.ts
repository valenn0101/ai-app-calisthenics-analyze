import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { saveSession, Exercise } from '@/lib/storage';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXERCISE_LABELS: Record<Exercise, string> = {
  muscle_up: 'Muscle Up',
  pull_up: 'Pull Up / Dominadas',
  push_up: 'Push Up / Flexiones',
  dip: 'Dip / Fondos',
  planche: 'Planche / Plancha',
  l_sit: 'L-Sit',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { frames, exercise } = body as { frames: string[]; exercise: Exercise };

    if (!frames || frames.length === 0) {
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
    }
    if (!exercise) {
      return NextResponse.json({ error: 'No exercise specified' }, { status: 400 });
    }

    const exerciseLabel = EXERCISE_LABELS[exercise] || exercise;

    // Build image content blocks (max 8 frames for token efficiency)
    const selectedFrames = frames.length > 8
      ? frames.filter((_, i) => i % Math.ceil(frames.length / 8) === 0).slice(0, 8)
      : frames;

    const imageBlocks = selectedFrames.map((frame) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: 'image/jpeg' as const,
        data: frame.replace(/^data:image\/\w+;base64,/, ''),
      },
    }));

    const textBlock = {
      type: 'text' as const,
      text: `Eres un coach experto en calistenia. Analiza la técnica de ${exerciseLabel} en estos ${selectedFrames.length} frames de video.

Devuelve SOLAMENTE un JSON válido con esta estructura exacta (sin texto adicional):
{
  "score": <número 1-10>,
  "phase": "<fase del movimiento detectada>",
  "positives": [
    {"text": "<punto positivo>", "frameRef": <índice de frame 0-${selectedFrames.length - 1} o null>}
  ],
  "corrections": [
    {"text": "<corrección específica>", "frameRef": <índice o null>, "priority": "<high|medium|low>"}
  ],
  "cues": ["<cue técnico breve 1>", "<cue 2>", "<cue 3>"],
  "shareText": "<texto completo listo para compartir con agente, incluye ejercicio, score, correcciones principales y próximos pasos>",
  "nextSteps": ["<paso concreto 1>", "<paso 2>", "<paso 3>"]
}

Sé específico, técnico y accionable. El shareText debe ser autocontenido para que un agente pueda entender el contexto sin ver el video.`,
    };

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, textBlock],
        },
      ],
    });

    const textContent = response.content.find(b => b.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No text response from Claude' }, { status: 500 });
    }

    let analysisData;
    try {
      // Strip any markdown code fences if present
      const cleaned = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse Claude response', raw: textContent.text }, { status: 500 });
    }

    // Save to storage
    const summary = analysisData.positives?.[0]?.text || `${exerciseLabel} analysis`;
    const session = saveSession({
      exercise,
      date: new Date().toISOString(),
      score: analysisData.score,
      summary,
      shareText: analysisData.shareText,
      framesData: frames,
      analysisData,
    });

    return NextResponse.json({ session, analysisData });
  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
