import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getGoals, addGoal, GoalCategory } from '@/lib/goals';

export async function GET() {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    return NextResponse.json({ goals: await getGoals(username) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const { text, category, targetDate } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'text requerido' }, { status: 400 });
    const goal = await addGoal(username, text.trim(), (category as GoalCategory) || 'other', targetDate);
    return NextResponse.json({ goal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
