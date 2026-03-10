import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getRoutines, saveRoutine } from '@/lib/training';

export async function GET() {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  return NextResponse.json({ routines: getRoutines(username) });
}

export async function POST(req: NextRequest) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();
  if (!body.name || !body.days?.length) {
    return NextResponse.json({ error: 'name y days requeridos' }, { status: 400 });
  }

  const routine = saveRoutine(username, {
    name: body.name,
    weekCount: body.weekCount ?? 4,
    hasDeload: body.hasDeload ?? false,
    deloadPercentage: body.deloadPercentage ?? 50,
    days: body.days,
    oneRMs: body.oneRMs ?? {},
    startDate: body.startDate ?? new Date().toISOString().split('T')[0],
  });

  return NextResponse.json({ routine });
}
