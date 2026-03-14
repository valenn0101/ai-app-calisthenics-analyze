'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AnalysisResult, VerificationResult } from '@/lib/storage';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

interface ChatPanelProps {
  exercise: string;
  analysis: AnalysisResult;
  verification?: VerificationResult | null;
}

const SUGGESTIONS = [
  '¿Cómo corrijo el error de mayor prioridad?',
  '¿Qué drills me recomiendas para mejorar?',
  '¿Por qué ese score y cómo subirlo?',
  'Explica la fase del movimiento detectada',
];

// Parse structured card blocks from model responses.
// Format: ---CARD---\nTITLE: ...\nSUBTITLE: ...\nDETAIL: ...\n---END---
function parseMessageContent(content: string) {
  const parts: Array<{ type: 'text' | 'card'; content: string; title?: string; subtitle?: string; detail?: string }> = [];
  const cardRegex = /---CARD---\n([\s\S]*?)---END---/g;
  let lastIndex = 0;
  let match;

  while ((match = cardRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: 'text', content: text });
    }
    const cardContent = match[1];
    const titleMatch = cardContent.match(/TITLE:\s*(.+)/);
    const subtitleMatch = cardContent.match(/SUBTITLE:\s*(.+)/);
    const detailMatch = cardContent.match(/DETAIL:\s*(.+)/);
    parts.push({
      type: 'card',
      content: cardContent,
      title: titleMatch?.[1]?.trim(),
      subtitle: subtitleMatch?.[1]?.trim(),
      detail: detailMatch?.[1]?.trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex).trim();
  if (remaining) parts.push({ type: 'text', content: remaining });
  if (parts.length === 0) parts.push({ type: 'text', content });

  return parts;
}

export default function ChatPanel({ exercise, analysis, verification }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError('');
    const userMsg: Message = { id: `${Date.now()}-u`, role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          exercise,
          analysis,
          verification,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}-m`, role: 'model', content: data.message },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el coach.');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSave = async () => {
    if (messages.length === 0 || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const res = await fetch('/api/chats/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          exercise,
          score: analysis.score,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaveState('saved');
    } catch {
      setSaveState('idle');
      setError('No se pudo guardar la conversación.');
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 520 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] text-white font-mono">✦</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Coach IA · {exercise}
              </p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs text-foreground bg-surface hover:bg-surface-2 border border-[var(--border-color)] px-3 py-2.5 rounded-xl transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start gap-2'}`}>
              {m.role === 'model' && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[9px] text-white font-mono">✦</span>
                </div>
              )}
              <div className={`max-w-[82%] ${m.role === 'user' ? '' : 'space-y-2'}`}>
                {m.role === 'model' && (
                  <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider mb-1">Coach IA</p>
                )}
                {m.role === 'user' ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap px-3 py-2.5 rounded-2xl rounded-tr-sm bg-surface border border-[var(--border-color)] text-foreground">
                    {m.content}
                  </div>
                ) : (
                  parseMessageContent(m.content).map((part, i) => (
                    part.type === 'card' ? (
                      <div key={i} className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl p-3">
                        {part.title && (
                          <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest mb-1">
                            Bloque sugerido
                          </p>
                        )}
                        {part.title && <p className="text-sm font-medium text-foreground">{part.title}</p>}
                        {part.subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{part.subtitle}</p>}
                        {part.detail && <p className="text-xs font-mono text-indigo-300 mt-1">{part.detail}</p>}
                      </div>
                    ) : (
                      <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap px-3 py-2.5 rounded-2xl rounded-tl-sm bg-surface border border-[var(--border-color)] text-foreground">
                        {part.content}
                      </div>
                    )
                  ))
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] text-white font-mono">✦</span>
            </div>
            <div className="bg-surface border border-[var(--border-color)] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center h-3">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

        <div ref={bottomRef} />
      </div>

      {/* Save bar */}
      {messages.length > 0 && (
        <div className="py-2 flex items-center justify-between border-t border-[var(--border-color)]">
          <button
            onClick={handleSave}
            disabled={saveState !== 'idle'}
            className={`text-[10px] font-mono transition-colors ${
              saveState === 'saved'
                ? 'text-emerald-500'
                : saveState === 'saving'
                ? 'text-[var(--muted)] animate-pulse'
                : 'text-[var(--muted)] hover:text-foreground'
            }`}
          >
            {saveState === 'saved'
              ? '✓ Conversación guardada'
              : saveState === 'saving'
              ? 'Guardando...'
              : '↓ Guardar conversación'}
          </button>

          {saveState === 'saved' && (
            <Link
              href="/chats"
              className="text-[10px] font-mono text-[var(--muted)] hover:text-foreground transition-colors"
            >
              Ver guardadas →
            </Link>
          )}
        </div>
      )}

      {/* Input */}
      <div className="pt-2 border-t border-[var(--border-color)] flex-shrink-0">
        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta al coach..."
            disabled={loading}
            className="flex-1 bg-surface border border-[var(--border-color)] focus:border-indigo-500/50 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium rounded-xl disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
