import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { saveSession, Exercise } from '@/lib/storage';

// Increase max duration for video uploads
export const maxDuration = 60;

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

// Prompt for frame-based analysis (Claude + Gemini frames fallback)
const ANALYSIS_PROMPT_FRAMES = (exerciseLabel: string, frameCount: number) =>
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

// Prompt for Gemini native video — includes frame timestamps so frameRef can still be used
const ANALYSIS_PROMPT_VIDEO = (exerciseLabel: string, frameCount: number, duration: number) => {
  const timestamps = Array.from({ length: frameCount }, (_, i) =>
    `frame ${i} ≈ ${(i * duration / Math.max(frameCount - 1, 1)).toFixed(1)}s`
  ).join(', ');

  return `Eres un coach experto en calistenia. Analiza la técnica de ${exerciseLabel} en este video completo.

El video tiene ${duration.toFixed(1)} segundos. Para referencias visuales, el usuario tiene estos frames extraídos: ${timestamps}.
Cuando referencies un momento específico, usa frameRef con el índice (0-${frameCount - 1}) del frame más cercano al instante que describís.

Devuelve SOLAMENTE un JSON válido con esta estructura exacta (sin texto adicional):
{
  "score": <número 1-10>,
  "phase": "<fase del movimiento detectada>",
  "positives": [
    {"text": "<punto positivo>", "frameRef": <índice 0-${frameCount - 1} o null>}
  ],
  "corrections": [
    {"text": "<corrección específica>", "frameRef": <índice o null>, "priority": "<high|medium|low>"}
  ],
  "cues": ["<cue técnico breve 1>", "<cue 2>", "<cue 3>"],
  "shareText": "<texto completo listo para compartir con agente, incluye ejercicio, score, correcciones principales y próximos pasos>",
  "nextSteps": ["<paso concreto 1>", "<paso 2>", "<paso 3>"]
}

Sé específico, técnico y accionable.`;
};

function selectFrames(frames: string[]): string[] {
  if (frames.length <= 16) return frames;
  return frames.filter((_, i) => i % Math.ceil(frames.length / 16) === 0).slice(0, 16);
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// --- Claude: frames as base64 images ---
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
        { type: 'text', text: ANALYSIS_PROMPT_FRAMES(exerciseLabel, frames.length) },
      ],
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude');
  return textBlock.text;
}

// --- Gemini: frames as inline base64 images (fallback) ---
async function analyzeWithGeminiFrames(frames: string[], exerciseLabel: string): Promise<string> {
  const imageParts = frames.map(frame => ({
    inlineData: {
      mimeType: 'image/jpeg' as const,
      data: frame.replace(/^data:image\/\w+;base64,/, ''),
    },
  }));

  const response = await genai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      role: 'user',
      parts: [
        ...imageParts,
        { text: ANALYSIS_PROMPT_FRAMES(exerciseLabel, frames.length) },
      ],
    }],
  });

  const text = response.text;
  if (!text) throw new Error('No text response from Gemini');
  return text;
}

// --- Gemini: native video via File API ---
async function analyzeWithGeminiVideo(
  videoBuffer: ArrayBuffer,
  mimeType: string,
  exerciseLabel: string,
  frameCount: number,
  videoDuration: number,
): Promise<string> {
  const blob = new Blob([videoBuffer], { type: mimeType });

  // Upload to Gemini File API
  const uploadedFile = await genai.files.upload({
    file: blob,
    config: { mimeType, displayName: 'formcheck-video' },
  });

  // Poll until ACTIVE (usually a few seconds)
  let fileInfo = await genai.files.get({ name: uploadedFile.name! });
  let attempts = 0;
  while (fileInfo.state === 'PROCESSING' && attempts < 30) {
    await new Promise(r => setTimeout(r, 1500));
    fileInfo = await genai.files.get({ name: uploadedFile.name! });
    attempts++;
  }

  if (fileInfo.state !== 'ACTIVE') {
    await genai.files.delete({ name: uploadedFile.name! }).catch(() => {});
    throw new Error(`Gemini file not ready (state: ${fileInfo.state})`);
  }

  let rawText: string;
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType: fileInfo.mimeType!, fileUri: fileInfo.uri! } },
          { text: ANALYSIS_PROMPT_VIDEO(exerciseLabel, frameCount, videoDuration) },
        ],
      }],
    });
    rawText = response.text ?? '';
  } finally {
    // Always clean up the uploaded file
    await genai.files.delete({ name: uploadedFile.name! }).catch(() => {});
  }

  if (!rawText) throw new Error('No text response from Gemini');
  return rawText;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let exercise: Exercise;
    let provider: Provider;
    let frames: string[] = [];
    let rawText: string;

    // --- Multipart: Gemini native video path ---
    if (contentType.includes('multipart/form-data')) {
      if (!process.env.GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
      }

      const formData = await req.formData();
      const videoFile = formData.get('video') as File | null;
      exercise = (formData.get('exercise') as Exercise) ?? 'muscle_up';
      provider = 'gemini';
      const frameCount = parseInt(formData.get('frameCount') as string) || 8;
      const videoDuration = parseFloat(formData.get('videoDuration') as string) || 10;

      if (!videoFile) {
        return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
      }

      const mimeType = videoFile.type || 'video/mp4';
      const videoBuffer = await videoFile.arrayBuffer();
      const exerciseLabel = EXERCISE_LABELS[exercise] || exercise;

      rawText = await analyzeWithGeminiVideo(videoBuffer, mimeType, exerciseLabel, frameCount, videoDuration);

    // --- JSON: Claude or Gemini frames ---
    } else {
      const body = await req.json();
      frames = body.frames ?? [];
      exercise = body.exercise as Exercise;
      provider = (body.provider ?? 'claude') as Provider;

      if (!frames.length) {
        return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
      }
      if (!exercise) {
        return NextResponse.json({ error: 'No exercise specified' }, { status: 400 });
      }

      const exerciseLabel = EXERCISE_LABELS[exercise] || exercise;
      const selectedFrames = selectFrames(frames);

      if (provider === 'gemini') {
        if (!process.env.GOOGLE_API_KEY) {
          return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
        }
        rawText = await analyzeWithGeminiFrames(selectedFrames, exerciseLabel);
      } else {
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
        }
        rawText = await analyzeWithClaude(selectedFrames, exerciseLabel);
      }
    }

    let analysisData;
    try {
      analysisData = parseJson(rawText);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 500 });
    }

    const exerciseLabel = EXERCISE_LABELS[exercise] || exercise;
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
