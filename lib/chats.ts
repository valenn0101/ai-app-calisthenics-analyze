import { supabase, getUserId } from './supabase';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface SavedChat {
  id: string;
  title: string;
  exercise: string;
  score: number;
  date: string;
  messages: ChatMessage[];
  messageCount: number;
}


function rowToChat(row: Record<string, unknown>): SavedChat {
  return {
    id: row.id as string,
    title: row.title as string,
    exercise: (row.exercise as string) ?? '',
    score: (row.score as number) ?? 0,
    date: row.created_at as string,
    messages: (row.messages as ChatMessage[]) ?? [],
    messageCount: (row.message_count as number) ?? 0,
  };
}

export async function saveChat(
  username: string,
  exercise: string,
  score: number,
  messages: ChatMessage[]
): Promise<SavedChat> {
  const userId = await getUserId(username);
  if (!userId) throw new Error(`User not found: ${username}`);

  const firstUserMsg = messages.find(m => m.role === 'user')?.content ?? '';
  const title = firstUserMsg.length > 50
    ? firstUserMsg.slice(0, 47) + '...'
    : firstUserMsg || `${exercise} · conversación`;

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title,
      exercise,
      score,
      messages,
      message_count: messages.length,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save chat');
  return rowToChat(data);
}

export async function getAllChats(username: string): Promise<SavedChat[]> {
  const userId = await getUserId(username);
  if (!userId) return [];

  const { data } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map(rowToChat);
}

export async function deleteChat(username: string, chatId: string): Promise<boolean> {
  const userId = await getUserId(username);
  if (!userId) return false;

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', userId);

  return !error;
}
