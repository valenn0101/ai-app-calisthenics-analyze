'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-2xl font-semibold tracking-tight text-foreground">
            FORM<span className="text-emerald-500">CHECK</span>
          </div>
          <p className="text-[11px] font-mono text-[var(--muted)] tracking-wider">
            Análisis de técnica · Gemini
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              disabled={loading}
              className="w-full bg-surface border border-[var(--border-color)] focus:border-zinc-400 rounded-xl px-4 py-3 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-surface border border-[var(--border-color)] focus:border-zinc-400 rounded-xl px-4 py-3 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-mono text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl disabled:opacity-25 disabled:cursor-not-allowed transition-all mt-2"
          >
            {loading ? (
              <span className="font-mono text-xs tracking-wider animate-pulse">
                Verificando...
              </span>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-[var(--muted)] font-mono">
          Acceso restringido
        </p>
      </div>
    </main>
  );
}
