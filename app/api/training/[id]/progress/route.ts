import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getRoutine, getRoutineWeekLogs, calcWeekVolume, MuscleVolume } from '@/lib/training';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const routine = await getRoutine(username, params.id);
    if (!routine) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });

    const logs = await getRoutineWeekLogs(username, params.id);

    const weekVolumes: Array<{ weekNumber: number; isDeload: boolean; volume: MuscleVolume }> = logs.map(log => ({
      weekNumber: log.weekNumber,
      isDeload: log.isDeload,
      volume: calcWeekVolume(routine, log),
    }));

    const exerciseProgress: Record<string, { weekNumber: number; maxWeight: number; totalReps: number }[]> = {};

    for (const log of logs) {
      for (const dayLog of log.days) {
        const routineDay = routine.days.find(d => d.id === dayLog.dayId);
        if (!routineDay) continue;
        for (const blockLog of dayLog.blocks) {
          const routineBlock = routineDay.blocks.find(b => b.id === blockLog.blockId);
          if (!routineBlock) continue;
          for (const exLog of blockLog.exercises) {
            const routineEx = routineBlock.exercises.find(e => e.id === exLog.exerciseId);
            if (!routineEx || !routineEx.isProgressive) continue;
            const completedSets = exLog.sets.filter(s => s.completed && s.weight > 0);
            if (!completedSets.length) continue;
            const maxWeight = Math.max(...completedSets.map(s => s.weight));
            const totalReps = completedSets.reduce((sum, s) => sum + s.reps, 0);
            if (!exerciseProgress[routineEx.name]) exerciseProgress[routineEx.name] = [];
            exerciseProgress[routineEx.name].push({ weekNumber: log.weekNumber, maxWeight, totalReps });
          }
        }
      }
    }

    return NextResponse.json({ weekVolumes, exerciseProgress });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
