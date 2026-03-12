import { supabase, getUserId } from './supabase';

export * from './training-types';
import { Routine, WeekLog, MuscleVolume } from './training-types';

// ── Internal helpers ───────────────────────────────────────────────────────────


function rowToRoutine(row: Record<string, unknown>): Routine {
  return {
    id: row.id as string,
    name: row.name as string,
    weekCount: row.week_count as number,
    hasDeload: (row.has_deload as boolean) ?? false,
    deloadPercentage: (row.deload_percentage as number) ?? 50,
    startDate: row.start_date as string,
    days: (row.days as Routine['days']) ?? [],
    oneRMs: (row.one_rms as Record<string, number>) ?? {},
    rawText: (row.raw_text as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function rowToWeekLog(row: Record<string, unknown>): WeekLog {
  return {
    id: row.id as string,
    routineId: row.routine_id as string,
    weekNumber: row.week_number as number,
    isDeload: (row.is_deload as boolean) ?? false,
    days: (row.days as WeekLog['days']) ?? [],
    createdAt: row.created_at as string,
  };
}

// ── Routine CRUD ───────────────────────────────────────────────────────────────

export async function getRoutines(username: string): Promise<Routine[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToRoutine);
}

export async function getRoutine(username: string, routineId: string): Promise<Routine | null> {
  const userId = await getUserId(username);
  if (!userId) return null;

  const { data } = await supabase
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .eq('user_id', userId)
    .single();

  return data ? rowToRoutine(data) : null;
}

export async function saveRoutine(
  username: string,
  data: Omit<Routine, 'id' | 'createdAt'>
): Promise<Routine> {
  const userId = await getUserId(username);
  if (!userId) throw new Error(`User not found: ${username}`);

  const { data: row, error } = await supabase
    .from('routines')
    .insert({
      user_id: userId,
      name: data.name,
      week_count: data.weekCount,
      has_deload: data.hasDeload,
      deload_percentage: data.deloadPercentage,
      start_date: data.startDate,
      days: data.days,
      one_rms: data.oneRMs,
      raw_text: data.rawText ?? null,
    })
    .select()
    .single();

  if (error || !row) throw new Error(error?.message ?? 'Failed to save routine');
  return rowToRoutine(row);
}

export async function updateRoutine(
  username: string,
  routineId: string,
  patch: Partial<Routine>
): Promise<boolean> {
  const userId = await getUserId(username);
  if (!userId) return false;

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.weekCount !== undefined) update.week_count = patch.weekCount;
  if (patch.hasDeload !== undefined) update.has_deload = patch.hasDeload;
  if (patch.deloadPercentage !== undefined) update.deload_percentage = patch.deloadPercentage;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.days !== undefined) update.days = patch.days;
  if (patch.oneRMs !== undefined) update.one_rms = patch.oneRMs;
  if (patch.rawText !== undefined) update.raw_text = patch.rawText;

  const { error } = await supabase
    .from('routines')
    .update(update)
    .eq('id', routineId)
    .eq('user_id', userId);

  return !error;
}

export async function deleteRoutine(username: string, routineId: string): Promise<boolean> {
  const userId = await getUserId(username);
  if (!userId) return false;

  // week_logs cascade on delete via FK, no need to delete manually
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId)
    .eq('user_id', userId);

  return !error;
}

// ── WeekLog CRUD ───────────────────────────────────────────────────────────────

export async function getRoutineWeekLogs(username: string, routineId: string): Promise<WeekLog[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('week_logs')
    .select('*')
    .eq('routine_id', routineId)
    .eq('user_id', userId)
    .order('week_number', { ascending: true });

  return (data ?? []).map(rowToWeekLog);
}

export async function getWeekLog(
  username: string,
  routineId: string,
  weekNumber: number
): Promise<WeekLog | null> {
  const userId = await getUserId(username);
  if (!userId) return null;

  const { data } = await supabase
    .from('week_logs')
    .select('*')
    .eq('routine_id', routineId)
    .eq('user_id', userId)
    .eq('week_number', weekNumber)
    .single();

  return data ? rowToWeekLog(data) : null;
}

export async function saveWeekLog(
  username: string,
  data: Omit<WeekLog, 'id' | 'createdAt'>
): Promise<WeekLog> {
  const userId = await getUserId(username);
  if (!userId) throw new Error(`User not found: ${username}`);

  const { data: row, error } = await supabase
    .from('week_logs')
    .upsert(
      {
        routine_id: data.routineId,
        user_id: userId,
        week_number: data.weekNumber,
        is_deload: data.isDeload,
        days: data.days,
      },
      { onConflict: 'routine_id,week_number' }
    )
    .select()
    .single();

  if (error || !row) throw new Error(error?.message ?? 'Failed to save week log');
  return rowToWeekLog(row);
}

export async function getAllWeekLogs(username: string): Promise<WeekLog[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('week_logs')
    .select('*')
    .eq('user_id', userId);

  return (data ?? []).map(rowToWeekLog);
}

// ── Volume ─────────────────────────────────────────────────────────────────────

export function calcWeekVolume(routine: Routine, weekLog: WeekLog): MuscleVolume {
  const vol: MuscleVolume = { push: 0, pull: 0, legs: 0, core: 0, skill: 0, other: 0 };

  for (const dayLog of weekLog.days) {
    const routineDay = routine.days.find(d => d.id === dayLog.dayId);
    if (!routineDay) continue;
    for (const blockLog of dayLog.blocks) {
      const routineBlock = routineDay.blocks.find(b => b.id === blockLog.blockId);
      if (!routineBlock) continue;
      for (const exLog of blockLog.exercises) {
        const routineEx = routineBlock.exercises.find(e => e.id === exLog.exerciseId);
        if (!routineEx) continue;
        const group = routineEx.muscleGroup;
        for (const set of exLog.sets) {
          if (!set.completed) continue;
          vol[group] += (set.weight > 0 ? set.weight : 1) * set.reps;
        }
      }
    }
  }

  return vol;
}
