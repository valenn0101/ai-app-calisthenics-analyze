import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions, getSessionsByExercise, Exercise } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const exercise = searchParams.get('exercise') as Exercise | null;

  if (exercise) {
    const sessions = getSessionsByExercise(exercise);
    return NextResponse.json({ sessions });
  }

  const sessions = getAllSessions();
  return NextResponse.json({ sessions });
}
