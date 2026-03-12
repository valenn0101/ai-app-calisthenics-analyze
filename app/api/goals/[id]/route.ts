import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { updateGoal, deleteGoal } from '@/lib/goals';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const patch = await req.json();
    const ok = updateGoal(username, params.id, patch);
    if (!ok) return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const ok = deleteGoal(username, params.id);
    if (!ok) return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
