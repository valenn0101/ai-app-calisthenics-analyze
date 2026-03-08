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
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.length === 0 ? (
          <div className="pt-6 space-y-4">
            <p className="text-xs text-gray-500 text-center tracking-wide">
              Coach disponible · {exercise}
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] px-3 py-2.5 rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          ))
        )}

        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/[0.10] flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] text-gray-400 font-mono">C</span>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.05] px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center h-3">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <div ref={bottomRef} />
      </div>

      {/* Save bar (visible when there are messages) */}
      {messages.length > 0 && (
        <div className="py-2 flex items-center justify-between border-t border-white/[0.05]">
          <button
            onClick={handleSave}
            disabled={saveState !== 'idle'}
            className={`text-[10px] font-mono transition-colors ${
              saveState === 'saved'
                ? 'text-emerald-400'
                : saveState === 'saving'
                ? 'text-gray-600 animate-pulse'
                : 'text-gray-600 hover:text-gray-300'
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
              className="text-[10px] font-mono text-gray-500 hover:text-white transition-colors"
            >
              Ver guardadas →
            </Link>
          )}
        </div>
      )}

      {/* Input */}
      <div className="pt-2 border-t border-white/[0.07] flex-shrink-0">
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
            className="flex-1 bg-white/[0.04] border border-white/[0.09] focus:border-white/[0.20] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 bg-white text-black text-xs font-medium rounded-xl hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
