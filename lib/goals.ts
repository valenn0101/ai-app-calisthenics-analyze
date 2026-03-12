import { supabase } from './supabase';
export type { GoalCategory, Goal } from './goals-types';
export { GOAL_CATEGORY_LABELS } from './goals-types';
import type { GoalCategory, Goal } from './goals-types';

async function getUserId(username: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();
  return data?.id ?? null;
}

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    text: row.text as string,
    category: row.category as GoalCategory,
    targetDate: (row.target_date as string) ?? undefined,
    achieved: (row.achieved as boolean) ?? false,
    achievedDate: (row.achieved_date as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getGoals(username: string): Promise<Goal[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('achieved', { ascending: true })
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToGoal);
}

export async function addGoal(
  username: string,
  text: string,
  category: GoalCategory,
  targetDate?: string
): Promise<Goal> {
  const userId = await getUserId(username);
  if (!userId) throw new Error(`User not found: ${username}`);

  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, text, category, target_date: targetDate ?? null })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to add goal');
  return rowToGoal(data);
}

export async function updateGoal(
  username: string,
  goalId: string,
  patch: Partial<Goal>
): Promise<boolean> {
  const userId = await getUserId(username);
  if (!userId) return false;

  const update: Record<string, unknown> = {};
  if (patch.text !== undefined) update.text = patch.text;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
  if (patch.achieved !== undefined) {
    update.achieved = patch.achieved;
    if (patch.achieved) update.achieved_date = new Date().toISOString();
  }

  const { error } = await supabase
    .from('goals')
    .update(update)
    .eq('id', goalId)
    .eq('user_id', userId);

  return !error;
}

export async function deleteGoal(username: string, goalId: string): Promise<boolean> {
  const userId = await getUserId(username);
  if (!userId) return false;

  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId);

  return !error;
}
