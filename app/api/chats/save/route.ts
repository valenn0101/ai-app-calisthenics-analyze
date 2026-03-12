import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { saveChat, ChatMessage } from '@/lib/chats';

export async function POST(req: NextRequest) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { messages, exercise, score } = await req.json() as {
    messages: ChatMessage[];
    exercise: string;
    score: number;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: 'No hay mensajes para guardar' }, { status: 400 });
  }

  const saved = await saveChat(username, exercise || 'ejercicio', score ?? 0, messages);
  return NextResponse.json({ chat: saved });
}
