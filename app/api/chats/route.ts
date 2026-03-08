import { NextRequest, NextResponse } from 'next/server';
import { getUsername } from '@/lib/auth';
import { getAllChats, deleteChat } from '@/lib/chats';

export async function GET() {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  return NextResponse.json({ chats: getAllChats(username) });
}

export async function DELETE(req: NextRequest) {
  const username = getUsername();
  if (!username) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('id');
  if (!chatId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const ok = deleteChat(username, chatId);
  return NextResponse.json({ ok });
}
