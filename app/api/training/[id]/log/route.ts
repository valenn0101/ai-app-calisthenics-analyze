import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getWeekLog, getRoutineWeekLogs, saveWeekLog } from '@/lib/training';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const week = searchParams.get('week');

  if (week) {
    const log = getWeekLog(username, params.id, parseInt(week));
    return NextResponse.json({ log: log ?? null });
  }

  const logs = getRoutineWeekLogs(username, params.id);
  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  const log = saveWeekLog(username, {
    routineId: params.id,
    weekNumber: body.weekNumber,
    isDeload: body.isDeload ?? false,
    days: body.days ?? [],
  });

  return NextResponse.json({ log });
}
