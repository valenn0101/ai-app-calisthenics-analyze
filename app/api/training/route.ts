import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getRoutines, saveRoutine } from '@/lib/training';

export async function GET() {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    return NextResponse.json({ routines: await getRoutines(username) });
  } catch (e) {
    console.error('GET /api/training error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    if (!body.name || !body.days?.length) {
      return NextResponse.json({ error: 'name y days requeridos' }, { status: 400 });
    }

    const routine = await saveRoutine(username, {
      name: body.name,
      weekCount: body.weekCount ?? 4,
      hasDeload: body.hasDeload ?? false,
      deloadPercentage: body.deloadPercentage ?? 50,
      days: body.days,
      oneRMs: body.oneRMs ?? {},
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      rawText: body.rawText,
    });

    return NextResponse.json({ routine });
  } catch (e) {
    console.error('POST /api/training error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al guardar' }, { status: 500 });
  }
}
