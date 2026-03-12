'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Routine } from '@/lib/training-types';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const ROUTINE_START = '===RUTINA GENERADA===';
const ROUTINE_END = '===FIN RUTINA===';

function extractRoutine(content: string): string | null {
  const s = content.indexOf(ROUTINE_START);
  const e = content.indexOf(ROUTINE_END);
  if (s === -1 || e === -1) return null;
  return content.slice(s + ROUTINE_START.length, e).trim();
}

// ── Block-type badge ───────────────────────────────────────────────────────────

const BLOCK_BADGE: Record<string, string> = {
  FUERZA: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  POTENCIA: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  HIPERTROFIA: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  ACCESORIO: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  HABILIDAD: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  ACONDICIONAMIENTO: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  CALENTAMIENTO: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  GENERAL: 'bg-white/5 text-gray-500 border-white/10',
};

// ── Routine text renderer ──────────────────────────────────────────────────────

function RoutineBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="font-mono text-xs text-gray-300 leading-relaxed space-y-0.5">
      {lines.map((line, i) => {
        const match = line.match(/^\[([A-ZÁÉÍÓÚÑ]+)\]/);
        if (match) {
          const badge = BLOCK_BADGE[match[1]] ?? BLOCK_BADGE.GENERAL;
          return (
            <div key={i} className="flex items-center gap-2 mt-3 first:mt-0">
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono tracking-widest flex-shrink-0 ${badge}`}>
                {match[1]}
              </span>
              <span className="text-gray-400 text-[10px]">{line.slice(match[0].length).trim()}</span>
            </div>
          );
        }
        if (/^(LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO|DOMINGO)/i.test(line.trim())) {
          return <div key={i} className="text-white font-semibold text-[11px] mt-4 first:mt-0 tracking-wide border-b border-white/[0.06] pb-1">{line}</div>;
        }
        return <div key={i} className={line.trim() === '' ? 'h-1' : 'pl-1'}>{line || '\u00A0'}</div>;
      })}
    </div>
  );
}

// ── Model message ──────────────────────────────────────────────────────────────

function ModelMessage({ content, onSave }: { content: string; onSave?: (text: string) => void }) {
  const routineText = extractRoutine(content);

  if (routineText) {
    const before = content.slice(0, content.indexOf(ROUTINE_START)).trim();
    const after = content.slice(content.indexOf(ROUTINE_END) + ROUTINE_END.length).trim();
    return (
      <div className="space-y-3">
        {before && <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{before}</p>}
        <div className="border border-emerald-500/25 rounded-xl bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">Rutina generada</span>
            {onSave && (
              <button
                onClick={() => onSave(routineText)}
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                Guardar como nueva rutina →
              </button>
            )}
          </div>
          <RoutineBlock text={routineText} />
        </div>
        {after && <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{after}</p>}
      </div>
    );
  }

  return <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{content}</p>;
}

// ── Save modal ─────────────────────────────────────────────────────────────────

function SaveModal({
  routineText,
  baseRoutine,
  onClose,
  onSaved,
}: {
  routineText: string;
  baseRoutine: Routine;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const next = new Date();
  next.setMonth(next.getMonth() + 1, 1);

  const [period, setPeriod] = useState(
    next.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  );
  const [startDate, setStartDate] = useState(next.toISOString().split('T')[0]);
  const [weekCount, setWeekCount] = useState(baseRoutine.weekCount);
  const [hasDeload, setHasDeload] = useState(baseRoutine.hasDeload);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const parseRes = await fetch('/api/training/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: routineText }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al analizar');

      const saveRes = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: period.trim() || 'Rutina evolucionada',
          weekCount,
          hasDeload,
          deloadPercentage: baseRoutine.deloadPercentage,
          days: parseData.days,
          oneRMs: baseRoutine.oneRMs,
          startDate,
          rawText: routineText,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar');

      onSaved(saveData.routine.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#111116] border border-white/[0.1] rounded-2xl p-5 space-y-4">
        <div className="text-sm font-light tracking-widest">Guardar nueva rutina</div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-600">Nombre / período</label>
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="Ej: Mayo 2026"
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-600">Fecha de inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-gray-600">Semanas</label>
            <div className="flex gap-1">
              {[3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setWeekCount(n)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono border transition-all ${weekCount === n ? 'bg-white text-black border-white' : 'border-white/[0.08] text-gray-400'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Semana de descarga</span>
            <button
              onClick={() => setHasDeload(!hasDeload)}
              style={{ width: 40, height: 22 }}
              className={`rounded-full border relative transition-all flex-shrink-0 ${hasDeload ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${hasDeload ? 'right-0.5 bg-black' : 'left-0.5 bg-gray-500'}`} />
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-white/[0.08] text-gray-400 text-sm rounded-xl hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-all"
          >
            {saving ? <span className="font-mono text-xs text-gray-500 animate-pulse">Guardando...</span> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EvolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveText, setSaveText] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/training/${id}`)
      .then(r => r.json())
      .then(d => { if (d.routine) setRoutine(d.routine); });
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendToAI = useCallback(async (history: Message[]) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/training/evolve/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId: id, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessages(prev => [...prev, { role: 'model', content: data.content }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al conectar');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Trigger greeting once routine is ready
  useEffect(() => {
    if (!routine || messages.length > 0) return;
    setLoading(true);
    fetch('/api/training/evolve/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: id, messages: [] }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.content) setMessages([{ role: 'model', content: data.content }]);
        else setError(data.error || 'Error');
      })
      .catch(() => setError('Error al iniciar'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const updated: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(updated);
    await sendToAI(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  const lastRoutineText = [...messages].reverse().find(m => extractRoutine(m.content));

  if (!routine) return (
    <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center">
      <span className="text-gray-600 text-xs font-mono animate-pulse">Cargando rutina...</span>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.07] flex-shrink-0">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link
            href={`/training/${id}`}
            className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all"
          >
            ← Volver
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-light tracking-widest">Evolucionar rutina</div>
            <div className="text-[10px] text-gray-600 font-mono truncate">{routine.name}</div>
          </div>
          {lastRoutineText && (
            <button
              onClick={() => setSaveText(extractRoutine(lastRoutineText.content))}
              className="flex-shrink-0 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              Guardar rutina →
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
          {messages.length === 0 && loading && (
            <div className="flex items-center justify-center h-32">
              <span className="text-gray-700 text-xs font-mono animate-pulse">Iniciando sesión de coaching...</span>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-mono mt-0.5
                ${msg.role === 'user' ? 'bg-white/10 text-gray-300' : 'bg-white/[0.05] text-gray-600 border border-white/[0.08]'}`}
              >
                {msg.role === 'user' ? 'Tú' : 'IA'}
              </div>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3
                ${msg.role === 'user'
                  ? 'bg-white/[0.08] rounded-tr-sm'
                  : 'bg-[#111116] border border-white/[0.06] rounded-tl-sm'
                }`}
              >
                {msg.role === 'model'
                  ? <ModelMessage content={msg.content} onSave={setSaveText} />
                  : <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                }
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[9px] font-mono text-gray-600 mt-0.5">IA</div>
              <div className="bg-[#111116] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400 font-mono text-center py-2">{error}</p>}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-white/[0.07] bg-[#0C0C10]">
        <div className="max-w-3xl mx-auto px-5 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
              rows={1}
              disabled={loading}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-white/[0.20] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none resize-none leading-relaxed disabled:opacity-40 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-25 hover:bg-gray-100 transition-all"
              aria-label="Enviar"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-gray-700 font-mono mt-2 text-center">
            Contexto de rutina y progresión incluido · cuando estés listo pedile que genere la rutina
          </p>
        </div>
      </div>

      {/* Save modal */}
      {saveText && (
        <SaveModal
          routineText={saveText}
          baseRoutine={routine}
          onClose={() => setSaveText(null)}
          onSaved={newId => router.push(`/training/${newId}`)}
        />
      )}
    </main>
  );
}
