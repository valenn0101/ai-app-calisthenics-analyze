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

const DATA_DIR = path.join(process.cwd(), 'data');
const JSON_PATH = path.join(DATA_DIR, 'sessions.json');
const EXCEL_PATH = path.join(DATA_DIR, 'sessions.xlsx');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readSessions(): SessionRecord[] {
  ensureDataDir();
  if (!fs.existsSync(JSON_PATH)) return [];
  try {
    const raw = fs.readFileSync(JSON_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSession(session: Omit<SessionRecord, 'id' | 'previousScore' | 'improvement'>): SessionRecord {
  ensureDataDir();
  const sessions = readSessions();

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
  fs.writeFileSync(JSON_PATH, JSON.stringify(sessions, null, 2), 'utf-8');

  try {
    writeExcel(sessions);
  } catch {
    // Excel write may fail if file is open in another program
  }

  return newSession;
}

function writeExcel(sessions: SessionRecord[]) {
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
  XLSX.writeFile(wb, EXCEL_PATH);
}

export function getSessionsByExercise(exercise: Exercise): SessionRecord[] {
  return readSessions()
    .filter(s => s.exercise === exercise)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getAllSessions(): SessionRecord[] {
  return readSessions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
