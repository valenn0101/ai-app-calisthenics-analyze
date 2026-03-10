import fs from 'fs';
import path from 'path';

export * from './training-types';
import { Routine, WeekLog, MuscleVolume } from './training-types';

// ── File paths ─────────────────────────────────────────────────────────────────

function userDir(username: string) {
  return path.join(process.cwd(), 'data', 'users', username);
}
function ensureDir(username: string) {
  const d = userDir(username);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function routinesPath(username: string) { return path.join(userDir(username), 'routines.json'); }
function weekLogsPath(username: string) { return path.join(userDir(username), 'weeklogs.json'); }

function readJson<T>(p: string): T[] {
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
}
function writeJson(p: string, data: unknown) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Routine CRUD ───────────────────────────────────────────────────────────────

export function getRoutines(username: string): Routine[] {
  ensureDir(username);
  return readJson<Routine>(routinesPath(username));
}

export function getRoutine(username: string, routineId: string): Routine | null {
  return getRoutines(username).find(r => r.id === routineId) ?? null;
}

export function saveRoutine(
  username: string,
  data: Omit<Routine, 'id' | 'createdAt'>
): Routine {
  ensureDir(username);
  const routines = getRoutines(username);
  const routine: Routine = {
    ...data,
    id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  routines.unshift(routine);
  writeJson(routinesPath(username), routines);
  return routine;
}

export function updateRoutine(username: string, routineId: string, patch: Partial<Routine>): boolean {
  const routines = getRoutines(username);
  const idx = routines.findIndex(r => r.id === routineId);
  if (idx === -1) return false;
  routines[idx] = { ...routines[idx], ...patch };
  writeJson(routinesPath(username), routines);
  return true;
}

export function deleteRoutine(username: string, routineId: string): boolean {
  const routines = getRoutines(username);
  const next = routines.filter(r => r.id !== routineId);
  if (next.length === routines.length) return false;
  writeJson(routinesPath(username), next);
  const logs = getAllWeekLogs(username).filter(l => l.routineId !== routineId);
  writeJson(weekLogsPath(username), logs);
  return true;
}

// ── WeekLog CRUD ───────────────────────────────────────────────────────────────

export function getAllWeekLogs(username: string): WeekLog[] {
  ensureDir(username);
  return readJson<WeekLog>(weekLogsPath(username));
}

export function getRoutineWeekLogs(username: string, routineId: string): WeekLog[] {
  return getAllWeekLogs(username)
    .filter(l => l.routineId === routineId)
    .sort((a, b) => a.weekNumber - b.weekNumber);
}

export function getWeekLog(username: string, routineId: string, weekNumber: number): WeekLog | null {
  return getAllWeekLogs(username).find(
    l => l.routineId === routineId && l.weekNumber === weekNumber
  ) ?? null;
}

export function saveWeekLog(
  username: string,
  data: Omit<WeekLog, 'id' | 'createdAt'>
): WeekLog {
  ensureDir(username);
  const logs = getAllWeekLogs(username);
  const existingIdx = logs.findIndex(
    l => l.routineId === data.routineId && l.weekNumber === data.weekNumber
  );

  const log: WeekLog = {
    ...data,
    id: existingIdx >= 0 ? logs[existingIdx].id : `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: existingIdx >= 0 ? logs[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) { logs[existingIdx] = log; } else { logs.push(log); }
  writeJson(weekLogsPath(username), logs);
  return log;
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
