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
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center px-5">
      <div className="w-full max-w-sm space-y-10">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-2xl font-light tracking-widest text-white">
            FORM<span className="text-gray-400">CHECK</span>
          </div>
          <p className="text-[11px] font-mono text-gray-600 tracking-wider">
            Análisis de técnica · Gemini
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-gray-600 uppercase tracking-widest">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-gray-600 uppercase tracking-widest">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 font-mono text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all mt-2"
          >
            {loading ? (
              <span className="text-gray-500 font-mono text-xs tracking-wider animate-pulse">
                Verificando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-700 font-mono">
          Acceso restringido
        </p>
      </div>
    </main>
  );
}
