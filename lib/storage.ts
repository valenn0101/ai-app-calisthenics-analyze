import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

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
  shareText: string;
  framesData: string[];
  analysisData: AnalysisResult;
  previousScore?: number;
  improvement?: number;
}

function getUserDir(username: string): string {
  return path.join(process.cwd(), 'data', 'users', username);
}

function getJsonPath(username: string): string {
  return path.join(getUserDir(username), 'sessions.json');
}

function getExcelPath(username: string): string {
  return path.join(getUserDir(username), 'sessions.xlsx');
}

function ensureUserDir(username: string) {
  const dir = getUserDir(username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readSessions(username: string): SessionRecord[] {
  ensureUserDir(username);
  const p = getJsonPath(username);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveSession(
  session: Omit<SessionRecord, 'id' | 'previousScore' | 'improvement'>,
  username: string
): SessionRecord {
  ensureUserDir(username);
  const sessions = readSessions(username);

  const previousSessions = sessions
    .filter(s => s.exercise === session.exercise)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const previousScore = previousSessions.length > 0 ? previousSessions[0].score : undefined;
  const improvement = previousScore !== undefined ? session.score - previousScore : undefined;

  const newSession: SessionRecord = {
    ...session,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    previousScore,
    improvement,
  };

  sessions.push(newSession);
  fs.writeFileSync(getJsonPath(username), JSON.stringify(sessions, null, 2), 'utf-8');

  try {
    writeExcel(sessions, username);
  } catch {
    // Excel write may fail if file is open
  }

  return newSession;
}

function writeExcel(sessions: SessionRecord[], username: string) {
  const rows = sessions.map(s => ({
    ID: s.id,
    Exercise: s.exercise,
    Date: s.date,
    Score: s.score,
    PreviousScore: s.previousScore ?? '',
    Improvement: s.improvement !== undefined ? (s.improvement > 0 ? `+${s.improvement}` : `${s.improvement}`) : '',
    Phase: s.analysisData.phase,
    Summary: s.summary,
    Positives: s.analysisData.positives.map(p => p.text).join(' | '),
    Corrections: s.analysisData.corrections.map(c => `[${c.priority.toUpperCase()}${c.timeRef != null ? ` @${c.timeRef}s` : ''}] ${c.text}`).join(' | '),
    Cues: s.analysisData.cues.join(' | '),
    NextSteps: s.analysisData.nextSteps.join(' | '),
    ShareText: s.shareText,
    FrameCount: s.framesData.length,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 8 },
    { wch: 13 }, { wch: 12 }, { wch: 16 }, { wch: 40 },
    { wch: 60 }, { wch: 80 }, { wch: 60 }, { wch: 60 },
    { wch: 80 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sessions');

  const exercises = Array.from(new Set(sessions.map(s => s.exercise)));
  for (const ex of exercises) {
    const exRows = rows.filter(r => r.Exercise === ex);
    const exWs = XLSX.utils.json_to_sheet(exRows);
    XLSX.utils.book_append_sheet(wb, exWs, ex.slice(0, 31));
  }
  XLSX.writeFile(wb, getExcelPath(username));
}

export function getSessionsByExercise(exercise: Exercise, username: string): SessionRecord[] {
  return readSessions(username)
    .filter(s => s.exercise === exercise)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getAllSessions(username: string): SessionRecord[] {
  return readSessions(username).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
