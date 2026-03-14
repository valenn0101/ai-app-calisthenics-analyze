'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/NavBar';

export default function NewRoutinePage() {
  const router = useRouter();

  const [period, setPeriod] = useState('');           // "Abril 2026"
  const [weekCount, setWeekCount] = useState(4);
  const [hasDeload, setHasDeload] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [routineText, setRoutineText] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!routineText.trim()) { setError('Escribe tu rutina primero.'); return; }
    setSaving(true);
    setError('');

    try {
      // 1. Parse text with Gemini
      const parseRes = await fetch('/api/training/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: routineText }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al analizar la rutina');

      // 2. Save routine
      const saveRes = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: period.trim() || `Rutina ${new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })}`,
          weekCount,
          hasDeload,
          deloadPercentage: 50,
          days: parseData.days,
          oneRMs: {},
          startDate,
          rawText: routineText,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar');

      router.push(`/training/${saveData.routine.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Nueva rutina</p>
          <p className="text-xs text-[var(--muted)]">Gemini la interpreta automáticamente</p>
        </div>

        {/* Config row */}
        <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Período</label>
              <input
                value={period}
                onChange={e => setPeriod(e.target.value)}
                placeholder="Ej: Abril 2026"
                className="w-full bg-background border border-[var(--border-color)] focus:border-zinc-400 rounded-xl px-4 py-3 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-background border border-[var(--border-color)] focus:border-zinc-400 rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Semanas</label>
              <div className="flex gap-1.5">
                {[3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setWeekCount(n)}
                    className={`flex-1 py-3 rounded-xl text-xs font-mono border transition-all ${weekCount === n ? 'bg-foreground text-background border-foreground' : 'border-[var(--border-color)] text-[var(--muted)] hover:text-foreground hover:border-zinc-500'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs text-foreground">Semana de descarga</div>
              <div className="text-[10px] font-mono text-[var(--muted)]">50% de carga · al final del bloque</div>
            </div>
            <button
              onClick={() => setHasDeload(!hasDeload)}
              style={{ width: 40, height: 22 }}
              className={`rounded-full border relative transition-all flex-shrink-0 ${hasDeload ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-[var(--border-color)]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${hasDeload ? 'right-0.5 bg-white' : 'left-0.5 bg-[var(--muted)]'}`} />
            </button>
          </div>
        </div>

        {/* Routine text */}
        <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5 space-y-3">
          <div>
            <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Rutina</div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Escribí o pegá tu rutina tal como la tenés. Gemini identificará días, bloques y ejercicios.
            </p>
          </div>
          <textarea
            value={routineText}
            onChange={e => setRoutineText(e.target.value)}
            placeholder={`LUNES — TORSO A (Fuerza + MU prioritario)\n1. Skill MU 4-5 × 1-2 reps limpias\n2. Dominadas lastradas 4 × 3 (~85-90%)\n...\n\nMIÉRCOLES — MU Técnico\n...`}
            rows={18}
            className="w-full bg-background border border-[var(--border-color)] focus:border-zinc-500 rounded-xl px-4 py-3 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors resize-y font-mono leading-relaxed"
          />

          {error && (
            <div className="border border-rose-500/20 bg-rose-500/[0.05] rounded-xl px-4 py-3">
              <p className="text-xs text-rose-400 font-mono">{error}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !routineText.trim()}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl disabled:opacity-25 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <span className="font-mono text-xs animate-pulse">
                Interpretando con Gemini...
              </span>
            ) : 'Guardar rutina'}
          </button>
        </div>
      </div>
    </div>
  );
}
