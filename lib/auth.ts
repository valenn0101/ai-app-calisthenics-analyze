import { cookies } from 'next/headers';

export const COOKIE_NAME = 'formcheck_user';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function getUsername(): string | null {
  try {
    const cookieStore = cookies();
    return cookieStore.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

// Kept for backwards compat — returns minimal object from cookie only
export function getUser(): { username: string; displayName: string } | null {
  const username = getUsername();
  if (!username) return null;
  return { username, displayName: username };
}
