import { cookies } from 'next/headers';
import { USERS, User } from './users';

export const COOKIE_NAME = 'formcheck_user';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getUser(): User | null {
  try {
    const cookieStore = cookies();
    const username = cookieStore.get(COOKIE_NAME)?.value;
    if (!username) return null;
    return USERS.find(u => u.username === username) ?? null;
  } catch {
    return null;
  }
}

export function getUsername(): string | null {
  return getUser()?.username ?? null;
}
