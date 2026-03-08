import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { saveSession, Exercise } from '@/lib/storage';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export type Provider = 'claude' | 'gemini';

const EXERCISE_LABELS: Record<Exercise, string> = {
  muscle_up: 'Muscle Up',
  pull_up: 'Pull Up / Dominadas',
  push_up: 'Push Up / Flexiones',
  dip: 'Dip / Fondos',
  planche: 'Planche / Plancha',
  l_sit: 'L-Sit',
};

const ANALYSIS_PROMPT = (exerciseLabel: string, frameCount: number) =>
  `Eres un coach experto en calistenia. Analiza la técnica de ${exerciseLabel} en estos ${frameCount} frames de video.

Devuelve SOLAMENTE un JSON válido con esta estructura exacta (sin texto adicional):
{
  "score": <número 1-10>,
  "phase": "<fase del movimiento detectada>",
  "positives": [
    {"text": "<punto positivo>", "frameRef": <índice de frame 0-${frameCount - 1} o null>}
  ],
  "corrections": [
    {"text": "<corrección específica>", "frameRef": <índice o null>, "priority": "<high|medium|low>"}
  ],
  "cues": ["<cue técnico breve 1>", "<cue 2>", "<cue 3>"],
  "shareText": "<texto completo listo para compartir con agente, incluye ejercicio, score, correcciones principales y próximos pasos>",
  "nextSteps": ["<paso concreto 1>", "<paso 2>", "<paso 3>"]
}

Sé específico, técnico y accionable. El shareText debe ser autocontenido para que un agente pueda entender el contexto sin ver el video.`;

function selectFrames(frames: string[]): string[] {
  if (frames.length <= 8) return frames;
  return frames.filter((_, i) => i % Math.ceil(frames.length / 8) === 0).slice(0, 8);
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeWithClaude(frames: string[], exerciseLabel: string): Promise<string> {
  const imageBlocks = frames.map(frame => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: frame.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        ...imageBlocks,
        { type: 'text', text: ANALYSIS_PROMPT(exerciseLabel, frames.length) },
      ],
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');
  return textBlock.text;
}

async function analyzeWithGemini(frames: string[], exerciseLabel: string): Promise<string> {
  const imageParts = frames.map(frame => ({
    inlineData: {
      mimeType: 'image/jpeg' as const,
      data: frame.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const response = await genai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        role: 'user',
        parts: [
          ...imageParts,
          { text: ANALYSIS_PROMPT(exerciseLabel, frames.length) },
        ],
      },
    ],
  });

  const text = response.text;
  if (!text) throw new Error('No text response from Gemini');
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { frames, exercise, provider = 'claude' } = body as {
      frames: string[];
      exercise: Exercise;
      provider?: Provider;
    };

    if (!frames || frames.length === 0)
      return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
    if (!exercise)
      return NextResponse.json({ error: 'No exercise specified' }, { status: 400 });

    const exerciseLabel = EXERCISE_LABELS[exercise] || exercise;
    const selectedFrames = selectFrames(frames);

    let rawText: string;
    if (provider === 'gemini') {
      if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
      }
      rawText = await analyzeWithGemini(selectedFrames, exerciseLabel);
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
      }
      rawText = await analyzeWithClaude(selectedFrames, exerciseLabel);
    }

    let analysisData;
    try {
      analysisData = parseJson(rawText);
    } catch {
      return NextResponse.json({ error: `Failed to parse ${provider} response`, raw: rawText }, { status: 500 });
    }

    const summary = analysisData.positives?.[0]?.text || `${exerciseLabel} analysis`;
    const session = saveSession({
      exercise,
      date: new Date().toISOString(),
      score: analysisData.score,
      summary,
      shareText: analysisData.shareText,
      framesData: frames,
      analysisData,
      provider,
    });

    return NextResponse.json({ session, analysisData });
  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
