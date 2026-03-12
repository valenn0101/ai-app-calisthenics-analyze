// ── Types shared between client and server ─────────────────────────────────────

export type MuscleGroup = 'push' | 'pull' | 'legs' | 'core' | 'skill' | 'other';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  push: 'Empuje',
  pull: 'Tracción',
  legs: 'Piernas',
  core: 'Core',
  skill: 'Skill',
  other: 'Otro',
};

export type BlockType = 'strength' | 'power' | 'hypertrophy' | 'accessory' | 'skill' | 'conditioning' | 'warmup' | 'other';

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  strength: 'Fuerza',
  power: 'Potencia',
  hypertrophy: 'Hipertrofia',
  accessory: 'Accesorio',
  skill: 'Habilidad',
  conditioning: 'Acondicionamiento',
  warmup: 'Calentamiento',
  other: 'General',
};

export interface RoutineExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  setsScheme: string;
  notes: string;
  isProgressive: boolean;
}

export interface RoutineBlock {
  id: string;
  label: string;
  blockType: BlockType;
  exercises: RoutineExercise[];
  isSuperset: boolean;
  restNotes: string;
}

export interface RoutineDay {
  id: string;
  dayName: string;
  title: string;
  blocks: RoutineBlock[];
}

export interface Routine {
  id: string;
  name: string;
  weekCount: number;
  hasDeload: boolean;
  deloadPercentage: number;
  days: RoutineDay[];
  oneRMs: Record<string, number>;
  createdAt: string;
  startDate: string;
  rawText?: string;   // original free-text the user wrote
}

export interface SetEntry {
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetEntry[];
}

export interface BlockLog {
  blockId: string;
  exercises: ExerciseLog[];
}

export interface DayLog {
  dayId: string;
  date: string;
  completed: boolean;
  blocks: BlockLog[];
  notes: string;
}

export interface WeekLog {
  id: string;
  routineId: string;
  weekNumber: number;
  isDeload: boolean;
  days: DayLog[];
  createdAt: string;
}

export interface MuscleVolume {
  push: number;
  pull: number;
  legs: number;
  core: number;
  skill: number;
  other: number;
}

// ── Pure helpers (no server deps) ──────────────────────────────────────────────

const REP_PERCENTAGES: [number, number][] = [
  [1, 100], [2, 95], [3, 90], [4, 88], [5, 86],
  [6, 83], [7, 80], [8, 77], [10, 74], [12, 70], [15, 65],
];

export function estimateWeight(oneRM: number, reps: number): number {
  let best = REP_PERCENTAGES[0];
  for (const entry of REP_PERCENTAGES) {
    if (Math.abs(entry[0] - reps) < Math.abs(best[0] - reps)) best = entry;
  }
  return Math.round((oneRM * best[1]) / 100 / 2.5) * 2.5;
}

export function weeklyEstimate(oneRM: number, reps: number, weekNum: number, totalWeeks: number): number {
  const base = estimateWeight(oneRM, reps);
  const factor = 0.90 + 0.10 * ((weekNum - 1) / Math.max(totalWeeks - 1, 1));
  return Math.round((base * factor) / 2.5) * 2.5;
}

export function parseSetsCount(scheme: string): number {
  const m = scheme.match(/^(\d+)/);
  return m ? parseInt(m[1]) : 3;
}
