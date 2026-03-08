import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { saveSession, Exercise } from '@/lib/storage';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const ANALYSIS_PROMPT = (exerciseLabel: string, duration: number) => `\
Eres un coach elite de calistenia con más de 15 años analizando biomecánica del movimiento. \
Analiza este video de ${exerciseLabel} con el máximo rigor técnico.

El video dura ${duration.toFixed(1)} segundos. Para CADA observación debes indicar el segundo exacto \
(con un decimal de precisión) donde ocurre ese momento. Estos segundos se usarán para extraer frames \
de verificación, por lo que deben ser precisos y distribuidos a lo largo del video.

Criterios de evaluación obligatorios:
- Alineación de columna y postura global
- Activación y control muscular en cada fase
- Rango de movimiento y profundidad de la repetición
- Control de la fase excéntrica (bajada)
- Timing, ritmo y fluidez del movimiento
- Posición de manos, agarre y apertura
- Compensaciones musculares y asimetrías visibles
- Estabilidad del core y posición de cadera

Devuelve SOLAMENTE un JSON válido con esta estructura exacta (sin texto adicional ni markdown):
{
  "score": <número 1-10, se permiten decimales como 7.5, sé riguroso>,
  "phase": "<fase principal detectada en el video>",
  "positives": [
    {"text": "<descripción técnica precisa del punto positivo, menciona músculo/articulación>", "timeRef": <segundo exacto con 1 decimal, ej: 1.4>}
  ],
  "corrections": [
    {
      "text": "<descripción técnica precisa y accionable, menciona qué músculo o articulación falla y cómo corregirlo>",
      "timeRef": <segundo exacto con 1 decimal donde se ve claramente el error>,
      "priority": "<high|medium|low>"
    }
  ],
  "cues": ["<cue técnico conciso, máximo 6 palabras>", "<cue 2>", "<cue 3>"],
  "shareText": "<resumen autocontenido: ejercicio, score, errores principales con segundos exactos, próximos pasos. Suficiente para que otro agente entienda sin ver el video>",
  "nextSteps": ["<paso concreto y measurable>", "<paso 2>", "<paso 3>"]
}

Reglas estrictas:
- El score debe ser honesto con criterio técnico de competición, no condescendiente
- Mínimo 2 corrections aunque la técnica sea muy buena
- Los timeRef deben estar distribuidos por el video, no todos en 0.0
- priority "high" = compromete la ejecución o puede causar lesión
- priority "medium" = afecta eficiencia o progresión
- priority "low" = detalle de refinamiento técnico`;

function parseJson(raw: string) {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeWithGemini(
  videoBuffer: ArrayBuffer,
  mimeType: string,
  exerciseLabel: string,
  videoDuration: number,
): Promise<string> {
  const blob = new Blob([videoBuffer], { type: mimeType });

  const uploadedFile = await genai.files.upload({
    file: blob,
    config: { mimeType, displayName: 'formcheck-video' },
  });

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

  let rawText = '';
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType: fileInfo.mimeType!, fileUri: fileInfo.uri! } },
          { text: ANALYSIS_PROMPT(exerciseLabel, videoDuration) },
        ],
      }],
    });
    rawText = response.text ?? '';
  } finally {
    await genai.files.delete({ name: uploadedFile.name! }).catch(() => {});
  }

  if (!rawText) throw new Error('No text response from Gemini');
  return rawText;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const videoFile = formData.get('video') as File | null;
    const exercise = (formData.get('exercise') as Exercise) || 'ejercicio';
    const videoDuration = parseFloat(formData.get('videoDuration') as string) || 10;
    const framesJson = formData.get('framesJson') as string | null;
    const framesData: string[] = framesJson ? JSON.parse(framesJson) : [];

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const mimeType = videoFile.type || 'video/mp4';
    const videoBuffer = await videoFile.arrayBuffer();

    const rawText = await analyzeWithGemini(videoBuffer, mimeType, exercise, videoDuration);

    let analysisData;
    try {
      analysisData = parseJson(rawText);
    } catch {
      return NextResponse.json({ error: 'Failed to parse Gemini response', raw: rawText }, { status: 500 });
    }

    const summary = analysisData.positives?.[0]?.text || `${exercise} analysis`;
    const session = saveSession({
      exercise,
      date: new Date().toISOString(),
      score: analysisData.score,
      summary,
      shareText: analysisData.shareText,
      framesData,
      analysisData,
    });

    return NextResponse.json({ session, analysisData });
  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
