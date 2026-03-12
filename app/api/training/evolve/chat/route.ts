import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getUsername } from '@/lib/auth';
import { getRoutine, getRoutineWeekLogs } from '@/lib/training';
import type { Routine, WeekLog } from '@/lib/training-types';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

// ── Context builders ───────────────────────────────────────────────────────────

function formatRoutineContext(routine: Routine): string {
  const lines: string[] = [`Nombre: ${routine.name}`, `Semanas: ${routine.weekCount}${routine.hasDeload ? ' (incluye descarga)' : ''}`];

  for (const day of routine.days) {
    lines.push(`\n${day.dayName} — ${day.title}`);
    for (const block of day.blocks) {
      const superset = block.isSuperset ? ' (superserie)' : '';
      lines.push(`  Bloque ${block.label}${superset}:`);
      for (const ex of block.exercises) {
        lines.push(`    · ${ex.name} — ${ex.setsScheme}${ex.notes ? ` — ${ex.notes}` : ''} [${ex.muscleGroup}${ex.isProgressive ? ', progresivo' : ''}]`);
      }
      if (block.restNotes) lines.push(`    Descanso: ${block.restNotes}`);
    }
  }
  return lines.join('\n');
}

function formatOneRMs(oneRMs: Record<string, number>): string {
  const entries = Object.entries(oneRMs).filter(([, v]) => v > 0);
  if (!entries.length) return 'Ninguno registrado.';
  return entries.map(([k, v]) => `${k}: ${v}kg`).join(', ');
}

function formatPerformanceHistory(routine: Routine, logs: WeekLog[]): string {
  if (!logs.length) return 'Sin registros previos de entrenamiento.';
  const lines: string[] = [];

  for (const log of logs.slice(-4)) { // last 4 weeks max
    lines.push(`\nSemana ${log.isDeload ? 'DESCARGA' : log.weekNumber}:`);
    for (const dayLog of log.days) {
      if (!dayLog.completed) continue;
      const routineDay = routine.days.find(d => d.id === dayLog.dayId);
      if (!routineDay) continue;
      lines.push(`  ${routineDay.dayName} (${routineDay.title}):`);
      for (const blockLog of dayLog.blocks) {
        const routineBlock = routineDay.blocks.find(b => b.id === blockLog.blockId);
        if (!routineBlock) continue;
        for (const exLog of blockLog.exercises) {
          const routineEx = routineBlock.exercises.find(e => e.id === exLog.exerciseId);
          if (!routineEx) continue;
          const completedSets = exLog.sets.filter(s => s.completed);
          if (!completedSets.length) continue;
          const setsStr = completedSets.map(s => `${s.weight > 0 ? s.weight + 'kg' : 'PC'} × ${s.reps}`).join(', ');
          lines.push(`    · ${routineEx.name}: ${setsStr}`);
        }
      }
    }
  }
  return lines.join('\n');
}

function buildSystemInstruction(routine: Routine, logs: WeekLog[]): string {
  const hasWeights = Object.values(routine.oneRMs).some(v => v > 0);

  return `Eres un coach de calistenia y entrenamiento con fuerza de élite. Tu misión es co-diseñar con el atleta una rutina evolucionada para el próximo mesiclo a través de una conversación.

═══ CONTEXTO DE LA RUTINA ACTUAL ═══

${formatRoutineContext(routine)}

═══ 1RMs DISPONIBLES ═══

${formatOneRMs(routine.oneRMs)}

═══ HISTORIAL DE RENDIMIENTO (últimas semanas) ═══

${formatPerformanceHistory(routine, logs)}

═══ INSTRUCCIONES DE COACHING ═══

TIPOS DE BLOQUE — siempre etiquetá cada bloque con su tipo entre corchetes:
  [FUERZA]          — Intensidad alta (1-5 reps), orientado a SNC y ganancia de fuerza máxima
  [POTENCIA]        — Explosividad, velocidad de ejecución, pliometría
  [HIPERTROFIA]     — Volumen moderado-alto (6-15 reps), tiempo bajo tensión
  [ACCESORIO]       — Ejercicios de apoyo, corrección de debilidades, trabajo aislado
  [HABILIDAD]       — Skill work técnico (MU, planche, front lever, etc.) — requiere frescura neural
  [ACONDICIONAMIENTO] — Circuitos, AMRAP, densidad de trabajo
  [CALENTAMIENTO]   — Activación y movilidad previas al trabajo principal
  [GENERAL]         — Bloques mixtos o que no encajan en otra categoría

CARGAS Y PROGRESIÓN:
${hasWeights
    ? `- Tenés 1RMs del atleta. Úsalos para calcular % de carga concretos (ej: "Squat 4×4 @ 87.5kg = 82% de tu 1RM de 107kg").`
    : `- No hay 1RMs registrados. Identificá los ejercicios de fuerza progresivos de la rutina actual y preguntale al atleta los pesos que movió en la última semana completada. Hacé esto en los primeros mensajes de la conversación.`
  }
- Cuando sugieras cargas, explicá el razonamiento (% de 1RM, RIR, progresión de la semana anterior)
- Para calistenia pura (PC), describí la variante progresiva (archer, ring, lastrado, etc.)

COMUNICACIÓN:
- Explicá el razonamiento detrás de CADA decisión (por qué ese ejercicio, esa carga, ese volumen)
- Si proponés cambios a la estructura de bloques, justificá (adaptación, fatiga, objetivo nuevo, etc.)
- Podés hacer preguntas para entender mejor el contexto del atleta
- Sé concreto y específico — evitá generalidades

GENERACIÓN DE LA RUTINA:
- Cuando el atleta esté listo (o lo pida explícitamente), generá la rutina evolucionada
- Usá este formato EXACTO para delimitar la rutina generada:

===RUTINA GENERADA===
[texto de la rutina]
===FIN RUTINA===

- Dentro de la rutina, cada bloque debe tener su etiqueta de tipo entre corchetes al inicio
- Incluí una nota breve debajo del bloque explicando el razonamiento
- Después de los delimitadores, podés agregar comentarios adicionales

PRIMER MENSAJE:
- Saludá brevemente al atleta
- Resumí en 2-3 líneas el estado actual de su entrenamiento (volumen, estructura, progresión)
- ${hasWeights ? 'Mencioná los 1RMs disponibles y cómo los vas a usar' : 'Preguntá los pesos de la última semana de los ejercicios de fuerza principales'}
- Preguntá: ¿Cuáles son tus objetivos para el próximo mes?`;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY no configurada' }, { status: 500 });
    }

    const { routineId, messages } = await req.json() as {
      routineId: string;
      messages: ChatMessage[];
    };

    const [routine, logs] = await Promise.all([
      getRoutine(username, routineId),
      getRoutineWeekLogs(username, routineId),
    ]);
    if (!routine) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });

    const systemInstruction = buildSystemInstruction(routine, logs);

    // Build Gemini contents — if no messages, trigger the greeting
    const contents = messages.length === 0
      ? [{ role: 'user' as const, parts: [{ text: '__START__' }] }]
      : messages.map(m => ({ role: m.role as 'user' | 'model', parts: [{ text: m.content }] }));

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro-preview-03-25',
      config: { systemInstruction },
      contents,
    });

    const content = (response.text ?? '').trim();
    if (!content) return NextResponse.json({ error: 'Sin respuesta del modelo' }, { status: 500 });

    return NextResponse.json({ content });
  } catch (e) {
    console.error('Evolve chat error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
