import fs from 'fs';
import path from 'path';

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

function getUserChatsPath(username: string): string {
  return path.join(process.cwd(), 'data', 'users', username, 'chats.json');
}

function ensureDir(username: string) {
  const dir = path.join(process.cwd(), 'data', 'users', username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readChats(username: string): SavedChat[] {
  ensureDir(username);
  const p = getUserChatsPath(username);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveChat(
  username: string,
  exercise: string,
  score: number,
  messages: ChatMessage[]
): SavedChat {
  ensureDir(username);
  const chats = readChats(username);

  const firstUserMsg = messages.find(m => m.role === 'user')?.content ?? '';
  const title = firstUserMsg.length > 50
    ? firstUserMsg.slice(0, 47) + '...'
    : firstUserMsg || `${exercise} · conversación`;

  const saved: SavedChat = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    exercise,
    score,
    date: new Date().toISOString(),
    messages,
    messageCount: messages.length,
  };

  chats.unshift(saved);
  fs.writeFileSync(getUserChatsPath(username), JSON.stringify(chats, null, 2), 'utf-8');
  return saved;
}

export function deleteChat(username: string, chatId: string): boolean {
  const chats = readChats(username);
  const next = chats.filter(c => c.id !== chatId);
  if (next.length === chats.length) return false;
  fs.writeFileSync(getUserChatsPath(username), JSON.stringify(next, null, 2), 'utf-8');
  return true;
}

export function getAllChats(username: string): SavedChat[] {
  return readChats(username);
}
