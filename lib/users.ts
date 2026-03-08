export interface User {
  username: string;
  password: string;
  displayName: string;
}

export const USERS: User[] = [
  { username: 'valentin', password: '997', displayName: 'Valentín' },
];

export function verifyCredentials(username: string, password: string): User | null {
  return (
    USERS.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    ) ?? null
  );
}
