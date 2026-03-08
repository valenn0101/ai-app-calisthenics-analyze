import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions, getSessionsByExercise, Exercise } from '@/lib/storage';
import { getUsername } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const exercise = searchParams.get('exercise') as Exercise | null;

  if (exercise) {
    const sessions = getSessionsByExercise(exercise, username);
    return NextResponse.json({ sessions });
  }

  const sessions = getAllSessions(username);
  return NextResponse.json({ sessions });
}
