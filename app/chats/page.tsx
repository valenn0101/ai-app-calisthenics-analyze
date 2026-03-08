'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SavedChat } from '@/lib/chats';

const scoreColor = (s: number) =>
  s >= 8 ? 'text-emerald-400' : s >= 6 ? 'text-amber-400' : s >= 4 ? 'text-orange-400' : 'text-red-400';

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
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.18] px-3 py-1.5 rounded-lg transition-all"
          >
            ← Volver
          </Link>
          <div>
            <div className="text-sm font-light tracking-widest text-white">
              FORM<span className="text-gray-400">CHECK</span>
            </div>
            <div className="text-[10px] text-gray-600 font-mono">Conversaciones guardadas</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-3">

        {loading && (
          <div className="text-center py-16 text-gray-600 text-xs font-mono animate-pulse">
            Cargando conversaciones...
          </div>
        )}

        {!loading && chats.length === 0 && (
          <div className="text-center py-20 space-y-3">
            <div className="text-gray-600 text-4xl">💬</div>
            <p className="text-sm text-gray-500">Sin conversaciones guardadas</p>
            <p className="text-xs text-gray-700 font-mono">
              Analiza un ejercicio y guarda el chat con el coach
            </p>
            <Link
              href="/"
              className="inline-block mt-2 text-xs text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.09] px-4 py-2 rounded-lg transition-colors"
            >
              Ir al análisis
            </Link>
          </div>
        )}

        {chats.map(chat => (
          <div
            key={chat.id}
            className="border border-white/[0.07] rounded-2xl overflow-hidden bg-[#111116]"
          >
            {/* Header row */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpanded(expanded === chat.id ? null : chat.id)}
            >
              {/* Score */}
              <div className="flex-shrink-0 text-center w-10">
                <div className={`text-xl font-light tabular-nums ${scoreColor(chat.score)}`}>
                  {chat.score}
                </div>
                <div className="text-[9px] font-mono text-gray-600">/10</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-0.5">
                  {chat.exercise}
                </div>
                <div className="text-sm text-gray-200 truncate">{chat.title}</div>
                <div className="text-[10px] font-mono text-gray-600 mt-0.5">
                  {formatDate(chat.date)} · {chat.messageCount} mensajes
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(chat.id); }}
                  disabled={deleting === chat.id}
                  className="text-[10px] font-mono text-gray-700 hover:text-red-400 transition-colors disabled:opacity-40 px-2 py-1"
                  title="Eliminar"
                >
                  {deleting === chat.id ? '...' : '✕'}
                </button>
                <span className="text-gray-600 text-xs">{expanded === chat.id ? '▴' : '▾'}</span>
              </div>
            </div>

            {/* Expanded messages */}
            {expanded === chat.id && (
              <div className="border-t border-white/[0.07] px-5 py-4 space-y-3 max-h-[520px] overflow-y-auto">
                {chat.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'model' && (
                      <div className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/[0.10] flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                        <span className="text-[8px] text-gray-400 font-mono">C</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] text-sm leading-relaxed whitespace-pre-wrap px-3 py-2.5 rounded-2xl ${
                        m.role === 'user'
                          ? 'bg-white/[0.07] text-gray-100 border border-white/[0.09] rounded-tr-sm'
                          : 'bg-white/[0.03] text-gray-200 border border-white/[0.05] rounded-tl-sm'
                      }`}
                    >
                      {m.role === 'model' && (
                        <div className="text-[9px] font-mono text-gray-600 mb-1 uppercase tracking-wider">Coach</div>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
