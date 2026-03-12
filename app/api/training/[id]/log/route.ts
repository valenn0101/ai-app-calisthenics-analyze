import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getWeekLog, getRoutineWeekLogs, saveWeekLog } from '@/lib/training';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const week = searchParams.get('week');

    if (week) {
      const log = await getWeekLog(username, params.id, parseInt(week));
      return NextResponse.json({ log: log ?? null });
    }

    const logs = await getRoutineWeekLogs(username, params.id);
    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    const log = await saveWeekLog(username, {
      routineId: params.id,
      weekNumber: body.weekNumber,
      isDeload: body.isDeload ?? false,
      days: body.days ?? [],
    });

    return NextResponse.json({ log });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al guardar' }, { status: 500 });
  }
}
