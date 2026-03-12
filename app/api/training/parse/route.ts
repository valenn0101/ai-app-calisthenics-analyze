import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getUsername } from '@/lib/auth';
import { MODEL_PARSE } from '@/lib/models';
import { RoutineDay, MuscleGroup, BlockType } from '@/lib/training';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const PARSE_PROMPT = (text: string) => `\
Eres un parser de rutinas de entrenamiento. Analiza el texto y devuelve ÚNICAMENTE un JSON válido sin markdown.

Estructura exacta requerida:
{
  "days": [
    {
      "id": "day-${uid()}",
      "dayName": "LUNES",
      "title": "TORSO A (Fuerza + MU prioritario)",
      "blocks": [
        {
          "id": "block-${uid()}",
          "label": "1",
          "blockType": "strength",
          "isSuperset": false,
          "restNotes": "Descanso amplio",
          "exercises": [
            {
              "id": "ex-${uid()}",
              "name": "Skill MU",
              "muscleGroup": "skill",
              "setsScheme": "4-5 × 1-2",
              "notes": "Si una se ensucia, paras.",
              "isProgressive": false
            }
          ]
        }
      ]
    }
  ]
}

Reglas:
- muscleGroup: "push" (press banca, press militar, fondos, dips), "pull" (dominadas, remo, bíceps), "legs" (sentadilla, peso muerto, zancadas), "core" (L-sit, leg raises, rueda abdominal), "skill" (muscle up, planche, front lever, technische habilidades), "other"
- blockType: clasifica el tipo de bloque:
  "strength"       → 1-5 reps, alta intensidad, orientado a fuerza máxima/SNC
  "power"          → explosividad, pliometría, velocidad de ejecución
  "hypertrophy"    → 6-15 reps, volumen moderado-alto, tiempo bajo tensión
  "accessory"      → ejercicios de apoyo, trabajo aislado, corrección de debilidades
  "skill"          → habilidad técnica (MU, planche, front lever, isométricos de skill)
  "conditioning"   → circuitos, AMRAP, densidad de trabajo cardiovascular
  "warmup"         → activación, movilidad, calentamiento previo
  "other"          → bloques mixtos o que no encajan en otra categoría
  Si el texto tiene etiqueta [FUERZA]/[HIPERTROFIA]/[ACCESORIO]/etc., úsala directamente.
- isProgressive: true si el ejercicio tipicamente usa carga externa que puede progresar semana a semana (press banca, dominadas lastradas, sentadillas, fondos lastrados, remo). false para skill work, isométricos, calentamiento
- isSuperset: true solo si el bloque contiene 2+ ejercicios realizados consecutivamente sin descanso entre ellos
- label: número o letra del bloque según el texto. Si no hay, usa índice
- Cada "Bloque X" o sección numerada es un RoutineBlock
- Si hay varias opciones ("elige uno como principal") → trata el primero como ejercicio principal, el segundo como variante separada en el mismo bloque con nota
- setsScheme: extrae la estructura de series y repeticiones del texto, ej: "4 × 3", "4 × 4-6", "3 × 20-30s", "4-5 × 1-2"
- notes: cualquier indicación técnica o de ejecución relevante

Rutina a parsear:
${text}`;

export async function POST(req: NextRequest) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY no configurada' }, { status: 500 });
  }

  const { text } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: 'Texto requerido' }, { status: 400 });
  }

  const response = await genai.models.generateContent({
    model: MODEL_PARSE,
    contents: [{ role: 'user', parts: [{ text: PARSE_PROMPT(text) }] }],
  });

  const raw = (response.text ?? '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: { days: RoutineDay[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Gemini no devolvió JSON válido', raw }, { status: 500 });
  }

  // Ensure all IDs are unique and present
  const days: RoutineDay[] = (parsed.days ?? []).map((day, di) => ({
    ...day,
    id: day.id || `day-${di}-${uid()}`,
    blocks: (day.blocks ?? []).map((block, bi) => ({
      ...block,
      id: block.id || `block-${di}-${bi}-${uid()}`,
      blockType: (block.blockType as BlockType) || 'other',
      exercises: (block.exercises ?? []).map((ex, ei) => ({
        ...ex,
        id: ex.id || `ex-${di}-${bi}-${ei}-${uid()}`,
        muscleGroup: (ex.muscleGroup as MuscleGroup) || 'other',
      })),
    })),
  }));

  return NextResponse.json({ days });
}
