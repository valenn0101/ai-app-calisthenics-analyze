import fs from 'fs';
import path from 'path';
export type { GoalCategory, Goal } from './goals-types';
export { GOAL_CATEGORY_LABELS } from './goals-types';
import type { GoalCategory, Goal } from './goals-types';

function goalsPath(username: string) {
  return path.join(process.cwd(), 'data', 'users', username, 'goals.json');
}
function ensureDir(username: string) {
  const d = path.join(process.cwd(), 'data', 'users', username);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function readJson(p: string): Goal[] {
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return []; }
}
function writeJson(p: string, data: Goal[]) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

export function getGoals(username: string): Goal[] {
  ensureDir(username);
  return readJson(goalsPath(username)).sort(
    (a, b) => Number(a.achieved) - Number(b.achieved) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addGoal(username: string, text: string, category: GoalCategory, targetDate?: string): Goal {
  ensureDir(username);
  const goals = readJson(goalsPath(username));
  const goal: Goal = {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    category,
    targetDate,
    achieved: false,
    createdAt: new Date().toISOString(),
  };
  goals.unshift(goal);
  writeJson(goalsPath(username), goals);
  return goal;
}

export function updateGoal(username: string, goalId: string, patch: Partial<Goal>): boolean {
  const goals = readJson(goalsPath(username));
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx === -1) return false;
  goals[idx] = { ...goals[idx], ...patch };
  if (patch.achieved && !goals[idx].achievedDate) {
    goals[idx].achievedDate = new Date().toISOString();
  }
  writeJson(goalsPath(username), goals);
  return true;
}

export function deleteGoal(username: string, goalId: string): boolean {
  const goals = readJson(goalsPath(username));
  const next = goals.filter(g => g.id !== goalId);
  if (next.length === goals.length) return false;
  writeJson(goalsPath(username), next);
  return true;
}
