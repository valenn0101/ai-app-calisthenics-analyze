import { supabase } from './supabase';

export interface User {
  username: string;
  displayName: string;
}

export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('username, password, display_name')
    .ilike('username', username)
    .single();

  if (error || !data) return null;
  if (data.password !== password) return null;

  return { username: data.username, displayName: data.display_name };
}
