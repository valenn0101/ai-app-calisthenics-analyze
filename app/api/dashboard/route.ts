import { NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getRoutines, getRoutineWeekLogs } from '@/lib/training';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const username = getUsername();
    if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Display name
    const { data: userData } = await supabase
      .from('users')
      .select('display_name')
      .eq('username', username)
      .single();
    const displayName: string = userData?.display_name ?? username;

    // Most recent routine
    const routines = await getRoutines(username);
    if (!routines.length) {
      return NextResponse.json({ displayName, routine: null, currentWeek: null, nextDay: null, completedDays: 0 });
    }

    const routine = routines[0]; // ordered by created_at desc

    // Calculate current week from start date
    const start = new Date(routine.startDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = routine.weekCount + (routine.hasDeload ? 1 : 0);
    const currentWeek = Math.min(Math.max(Math.floor(daysDiff / 7) + 1, 1), totalWeeks);

    // Week logs to find completed days
    const weekLogs = await getRoutineWeekLogs(username, routine.id);
    const currentWeekLog = weekLogs.find(l => l.weekNumber === currentWeek);
    const completedDayIds = new Set(
      (currentWeekLog?.days ?? []).filter(d => d.completed).map(d => d.dayId)
    );
    const completedDays = completedDayIds.size;

    // Next day = first day in routine not yet completed this week
    const nextDay = routine.days.find(d => !completedDayIds.has(d.id)) ?? null;

    return NextResponse.json({ displayName, routine, currentWeek, nextDay, completedDays });
  } catch (e) {
    console.error('GET /api/dashboard error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
