import { supabase } from './supabase';

export type Exercise = string;

export interface AnalysisResult {
  score: number;
  phase: string;
  positives: Array<{ text: string; timeRef?: number | null; frameDescription?: string | null }>;
  corrections: Array<{ text: string; timeRef?: number | null; frameDescription?: string | null; priority: 'high' | 'medium' | 'low' }>;
  cues: string[];
  shareText: string;
  nextSteps: string[];
}

export interface VerificationItem {
  timeRef: number;
  confirmed: boolean;
  confidence: 'high' | 'medium' | 'low';
  observation: string;
  revisedCorrection: string | null;
  revisedTimeRef?: number | null;
}

export interface VerificationResult {
  verifications: VerificationItem[];
  accuracy: number;
  summary: string;
}

export interface SessionRecord {
  id: string;
  exercise: Exercise;
  date: string;
  score: number;
  summary: string;
  aiSummary?: string;
  shareText: string;
  framesData: string[];
  analysisData: AnalysisResult;
  previousScore?: number;
  improvement?: number;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getUserId(username: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();
  return data?.id ?? null;
}

function rowToSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: row.id as string,
    exercise: row.exercise as string,
    date: row.created_at as string,
    score: row.score as number,
    summary: (row.summary as string) ?? '',
    aiSummary: (row.ai_summary as string) ?? undefined,
    shareText: (row.share_text as string) ?? '',
    framesData: (row.frames_data as string[]) ?? [],
    analysisData: row.analysis_data as AnalysisResult,
    previousScore: (row.previous_score as number) ?? undefined,
    improvement: (row.improvement as number) ?? undefined,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function saveSession(
  session: Omit<SessionRecord, 'id' | 'previousScore' | 'improvement'>,
  username: string
): Promise<SessionRecord> {
  const userId = await getUserId(username);
  if (!userId) throw new Error(`User not found: ${username}`);

  // Fetch previous score for this exercise
  const { data: prev } = await supabase
    .from('sessions')
    .select('score')
    .eq('user_id', userId)
    .eq('exercise', session.exercise)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const previousScore = prev?.score ?? undefined;
  const improvement = previousScore !== undefined ? session.score - previousScore : undefined;

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      exercise: session.exercise,
      score: session.score,
      previous_score: previousScore ?? null,
      improvement: improvement ?? null,
      summary: session.summary,
      ai_summary: session.aiSummary ?? null,
      share_text: session.shareText,
      frames_data: session.framesData,
      analysis_data: session.analysisData,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save session');
  return rowToSession(data);
}

export async function getAllSessions(username: string): Promise<SessionRecord[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToSession);
}

export async function getSessionsByExercise(exercise: Exercise, username: string): Promise<SessionRecord[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('exercise', exercise)
    .order('created_at', { ascending: true });

  return (data ?? []).map(rowToSession);
}

export async function readSessions(username: string): Promise<SessionRecord[]> {
  return getAllSessions(username);
}
