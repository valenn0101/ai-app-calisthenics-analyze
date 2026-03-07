import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { saveSession } from '@/lib/storage';

// Increase max duration for video uploads
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const kimiBaseUrl = (process.env.KIMI_BASE_URL ?? 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
const kimiModel = process.env.KIMI_MODEL ?? 'kimi-k2.5';

export type Provider = 'claude' | 'gemini' | 'kimi';

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

const KIMI_SYSTEM_PROMPT =
  'Eres un coach experto en calistenia. Analiza la técnica del ejercicio mostrado en las imágenes (frames de video). Evalúa fases del movimiento, errores biomecánicos y da recomendaciones específicas.';

// Prompt for Gemini native video — Gemini identifies exact timestamps natively
const ANALYSIS_PROMPT_VIDEO = (exerciseLabel: string) =>
  `Eres un coach experto en calistenia. Analiza la técnica de ${exerciseLabel} en este video.

DATOS DEL ATLETA:
- Peso: 86 kg (Fundamental: valora la potencia absoluta necesaria para este peso).
- Altura: 175 cm.
- Edad: 24 años.
- Objetivo: Muscle-up (Prioriza la altura del tirón y la trayectoria).

INSTRUCCIONES DE ANÁLISIS Y TIMESTAMPS:
1. ANCLAJE TEMPORAL ESTRICTO (CRÍTICO): No adivines ni calcules promedios de tiempo. Busca visualmente el momento exacto donde la barra hace contacto con el cuerpo o el momento exacto del error. 
2. FORMATO: El timestamp debe coincidir exactamente con el segundo real del video donde la acción es evidente (ej. 6.2). Si la acción ocurre en el segundo 6, no escribas 5.4.
3. EXTREMA PRECISIÓN DE TIEMPO (CRÍTICO): Los campos "timestamp" deben ser el segundo exacto con decimales (ejemplo: 1.4, 3.7) donde ocurre la acción visible. Esto es crítico porque el sistema usará estos números para que el usuario haga clic y salte a ese frame exacto en su reproductor de video. No redondees a números enteros.
4. No califiques como un juez de élite olímpica. 
5. BALANCE DE PESO: Si el atleta logra llevar la barra al esternón con 86kg de peso corporal, el score debe ser alto (7-8+), incluso si hay un ligero balanceo.
6. Valora el progreso.

Devuelve SOLAMENTE un JSON válido:
{
  "score": <número 1-10>,
  "phase": "<fase del movimiento>",
  "positives": [{"text": "<punto positivo>", "timestamp": <número decimal, ej: 2.3>}],
  "corrections": [{"text": "<corrección>", "timestamp": <número decimal, ej: 4.8>, "priority": "<high|medium|low>"}],
  "cues": ["<cue técnico 1>", "<cue 2>", "<cue 3>"],
  "shareText": "<Texto alentador. Reconoce el mérito de mover 86kg con esa explosividad antes de corregir.>",
  "raw_metrics": {
    "estimated_peak_height": "<ej: chin, chest, stomach>",
    "leg_swing_detected": <boolean>
  },
  "nextSteps": ["<paso 1>", "<paso 2>", "<paso 3>"]
}

Sé específico, técnico y empoderador.`;

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
    model: 'gemini-3.1-pro-preview',
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

// --- Kimi: OpenAI-compatible multimodal request with base64 frames ---
async function analyzeWithKimiFrames(frames: string[], exerciseLabel: string): Promise<string> {
  const content = [
    ...frames.map(frame => ({
      type: 'image_url',
      image_url: frame,
    })),
    { type: 'text', text: ANALYSIS_PROMPT_FRAMES(exerciseLabel, frames.length) },
  ];

  const response = await fetch(`${kimiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: kimiModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: KIMI_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Kimi request failed (${response.status}): ${details || response.statusText}`);
  }

  const data = await response.json();
  const contentRaw = data?.choices?.[0]?.message?.content;
  if (typeof contentRaw === 'string' && contentRaw.trim()) return contentRaw;
  if (Array.isArray(contentRaw)) {
    const text = contentRaw
      .filter((part: { type?: string; text?: string }) => part?.type === 'text' && typeof part.text === 'string')
      .map((part: { text: string }) => part.text)
      .join('\n')
      .trim();
    if (text) return text;
  }
  throw new Error('No text response from Kimi');
}

// --- Gemini: native video via File API ---
async function analyzeWithGeminiVideo(
  videoBuffer: ArrayBuffer,
  mimeType: string,
  exerciseLabel: string,
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
      model: 'gemini-3.1-pro-preview',
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType: fileInfo.mimeType!, fileUri: fileInfo.uri! } },
          { text: ANALYSIS_PROMPT_VIDEO(exerciseLabel) },
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
    let exercise: string;
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
      exercise = (formData.get('exercise') as string) || '';
      provider = 'gemini';

      if (!videoFile) {
        return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
      }

      const mimeType = videoFile.type || 'video/mp4';
      const videoBuffer = await videoFile.arrayBuffer();

      rawText = await analyzeWithGeminiVideo(videoBuffer, mimeType, exercise);

    // --- JSON: Claude, Gemini or Kimi frames ---
    } else {
      const body = await req.json();
      frames = body.frames ?? [];
      exercise = body.exercise as string;
      provider = (body.provider ?? 'claude') as Provider;

      if (!frames.length) {
        return NextResponse.json({ error: 'No frames provided' }, { status: 400 });
      }
      if (!exercise) {
        return NextResponse.json({ error: 'No exercise specified' }, { status: 400 });
      }

      const selectedFrames = selectFrames(frames);

      if (provider === 'gemini') {
        if (!process.env.GOOGLE_API_KEY) {
          return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
        }
        rawText = await analyzeWithGeminiFrames(selectedFrames, exercise);
      } else if (provider === 'kimi') {
        if (!process.env.KIMI_API_KEY) {
          return NextResponse.json({ error: 'KIMI_API_KEY not configured' }, { status: 500 });
        }
        rawText = await analyzeWithKimiFrames(selectedFrames, exercise);
      } else {
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
        }
        rawText = await analyzeWithClaude(selectedFrames, exercise);
      }
    }

    let analysisData;
    try {
      analysisData = parseJson(rawText);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: rawText }, { status: 500 });
    }

    const exerciseLabel = exercise;
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
