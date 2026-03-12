import { NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const username = getUsername();
  if (!username) return NextResponse.json({ user: null }, { status: 401 });

  const { data } = await supabase
    .from('users')
    .select('username, display_name')
    .eq('username', username)
    .single();

  if (!data) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({
    user: { username: data.username, displayName: data.display_name },
  });
}
