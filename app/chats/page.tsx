'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { SavedChat } from '@/lib/chats';

const scoreColor = (s: number) =>
  s >= 8 ? 'text-emerald-500' : s >= 6 ? 'text-amber-400' : s >= 4 ? 'text-orange-400' : 'text-rose-400';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function ChatsPage() {
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/chats')
      .then(r => r.json())
      .then(d => setChats(d.chats ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (chatId: string) => {
    setDeleting(chatId);
    await fetch(`/api/chats?id=${chatId}`, { method: 'DELETE' });
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (expanded === chatId) setExpanded(null);
    setDeleting(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-3">

        <h1 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-4">
          Conversaciones guardadas
        </h1>

        {loading && (
          <div className="text-center py-16 text-[var(--muted)] text-xs font-mono animate-pulse">
            Cargando conversaciones...
          </div>
        )}

        {!loading && chats.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <p className="text-2xl">✦</p>
            <p className="text-sm text-[var(--muted)]">Sin conversaciones guardadas</p>
            <p className="text-xs text-[var(--muted)] font-mono">
              Analiza un ejercicio y guarda el chat con el coach
            </p>
            <Link
              href="/"
              className="inline-block mt-2 text-xs text-foreground bg-surface hover:bg-surface-2 border border-[var(--border-color)] px-4 py-2 rounded-lg transition-colors"
            >
              Ir al análisis
            </Link>
          </div>
        )}

        {chats.map(chat => (
          <div
            key={chat.id}
            className="border border-[var(--border-color)] rounded-2xl overflow-hidden bg-surface"
          >
            {/* Header row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-2 transition-colors"
              onClick={() => setExpanded(expanded === chat.id ? null : chat.id)}
            >
              {/* Score */}
              <div className="flex-shrink-0 text-center w-10">
                <div className={`text-xl font-light tabular-nums font-mono ${scoreColor(chat.score)}`}>
                  {chat.score}
                </div>
                <div className="text-[9px] font-mono text-[var(--muted)]">/10</div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-0.5">
                  {chat.exercise}
                </p>
                <p className="text-sm text-foreground truncate">{chat.title}</p>
                <p className="text-[10px] font-mono text-[var(--muted)] mt-0.5">
                  {formatDate(chat.date)} · {chat.messageCount} mensajes
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(chat.id); }}
                  disabled={deleting === chat.id}
                  className="text-[10px] font-mono text-[var(--muted)] hover:text-rose-400 transition-colors disabled:opacity-40 px-2 py-1"
                  title="Eliminar"
                >
                  {deleting === chat.id ? '...' : '✕'}
                </button>
                <span className="text-[var(--muted)] text-xs">{expanded === chat.id ? '▴' : '▾'}</span>
              </div>
            </div>

            {/* Expanded messages */}
            {expanded === chat.id && (
              <div className="border-t border-[var(--border-color)] px-5 py-4 space-y-3 max-h-[520px] overflow-y-auto scrollbar-thin">
                {chat.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
                    {m.role === 'model' && (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-[9px] text-white font-mono">✦</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] text-sm leading-relaxed whitespace-pre-wrap px-3 py-2.5 rounded-2xl border border-[var(--border-color)] bg-surface ${
                        m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'
                      } text-foreground`}
                    >
                      {m.role === 'model' && (
                        <p className="text-[9px] font-mono text-indigo-400 mb-1 uppercase tracking-wider">Coach IA</p>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
