import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getUsername } from '@/lib/auth';
import { getRoutine, getRoutineWeekLogs } from '@/lib/training';
import type { Routine, WeekLog } from '@/lib/training-types';

export const maxDuration = 60;

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

function buildPerformanceSummary(routine: Routine, logs: WeekLog[]): string {
  if (!logs.length) return 'Sin registros previos.';

  const lines: string[] = [];

  for (const log of logs) {
    lines.push(`\nSemana ${log.isDeload ? 'descarga' : log.weekNumber}:`);
    for (const dayLog of log.days) {
      const routineDay = routine.days.find(d => d.id === dayLog.dayId);
      if (!routineDay || !dayLog.completed) continue;
      lines.push(`  ${routineDay.dayName} (${routineDay.title}):`);
      for (const blockLog of dayLog.blocks) {
        const routineBlock = routineDay.blocks.find(b => b.id === blockLog.blockId);
        if (!routineBlock) continue;
        for (const exLog of blockLog.exercises) {
          const routineEx = routineBlock.exercises.find(e => e.id === exLog.exerciseId);
          if (!routineEx) continue;
          const completedSets = exLog.sets.filter(s => s.completed);
          if (!completedSets.length) continue;
          const setsStr = completedSets.map(s => `${s.weight > 0 ? s.weight + 'kg' : 'BW'} × ${s.reps}`).join(', ');
          lines.push(`    - ${routineEx.name}: ${setsStr}`);
        }
      }
    }
  }

  return lines.join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ error: 'GOOGLE_API_KEY no configurada' }, { status: 500 });
    }

    const { routineId, goals } = await req.json() as { routineId: string; goals: string };

    const routine = await getRoutine(username, routineId);
    if (!routine) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });

    const logs = await getRoutineWeekLogs(username, routineId);
    const performanceSummary = buildPerformanceSummary(routine, logs);

    const routineSource = routine.rawText || routine.days.map(day =>
      `${day.dayName} — ${day.title}\n` +
      day.blocks.map((block, i) =>
        `${block.label || i + 1}. ${block.exercises.map(e => `${e.name} ${e.setsScheme} — ${e.notes}`).join(' + ')}`
      ).join('\n')
    ).join('\n\n');

    const prompt = `Eres un coach elite de calistenia y planificación del entrenamiento.

RUTINA ACTUAL (${routine.name}):
${routineSource}

HISTORIAL DE RENDIMIENTO:
${performanceSummary}

OBJETIVOS PARA EL PRÓXIMO MES:
${goals?.trim() || 'No especificados.'}

Genera una rutina EVOLUCIONADA para el próximo mes. La rutina debe:
- Progresar en intensidad o volumen donde los registros lo permitan
- Ajustar ejercicios y esquemas de series/reps según el rendimiento real observado
- Incorporar los objetivos indicados si los hay
- Mantener el mismo formato de texto libre que la rutina original: DÍAS en mayúsculas, bloques numerados, esquemas de series × reps, notas técnicas
- Ser realista y ejecutable, no solo teórica

Devuelve SOLO el texto de la rutina nueva, sin JSON, sin títulos extra, sin explicaciones. Empezá directamente con el primer día.`;

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-pro-preview-03-25',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = (response.text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'Gemini no generó texto' }, { status: 500 });

    return NextResponse.json({ text });
  } catch (e) {
    console.error('Evolve error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
