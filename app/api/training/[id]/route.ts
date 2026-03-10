import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getRoutine, deleteRoutine, updateRoutine } from '@/lib/training';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const routine = getRoutine(username, params.id);
    if (!routine) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });
    return NextResponse.json({ routine });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const patch = await req.json();
    const ok = updateRoutine(username, params.id, patch);
    if (!ok) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const ok = deleteRoutine(username, params.id);
    if (!ok) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
