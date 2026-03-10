'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RoutineDay, RoutineExercise, MuscleGroup, MUSCLE_LABELS } from '@/lib/training-types';

type Phase = 'config' | 'parse' | 'onerms' | 'saving';

const MUSCLE_OPTIONS: MuscleGroup[] = ['push', 'pull', 'legs', 'core', 'skill', 'other'];

interface ParsedResult {
  days: RoutineDay[];
}

export default function NewRoutinePage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('config');

  // Step 1 — config
  const [name, setName] = useState('');
  const [weekCount, setWeekCount] = useState(4);
  const [hasDeload, setHasDeload] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 2 — parse
  const [routineText, setRoutineText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [, setParsed] = useState<ParsedResult | null>(null);

  // Step 3 — editing muscleGroup/isProgressive overrides
  const [editedDays, setEditedDays] = useState<RoutineDay[]>([]);

  // Step 4 — 1RMs
  const [oneRMs, setOneRMs] = useState<Record<string, string>>({});

  const [saveError, setSaveError] = useState('');

  async function handleParse() {
    if (!routineText.trim()) return;
    setParsing(true);
    setParseError('');
    try {
      const res = await fetch('/api/training/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: routineText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setParsed({ days: data.days });
      setEditedDays(data.days);
      setPhase('parse');
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Error al parsear');
    } finally {
      setParsing(false);
    }
  }

  function updateExercise(dayIdx: number, blockIdx: number, exIdx: number, patch: Partial<RoutineExercise>) {
    setEditedDays(prev => {
      const next = prev.map(d => ({ ...d, blocks: d.blocks.map(b => ({ ...b, exercises: [...b.exercises] })) }));
      Object.assign(next[dayIdx].blocks[blockIdx].exercises[exIdx], patch);
      return next;
    });
  }

  function progressiveExercises(): RoutineExercise[] {
    if (!editedDays.length) return [];
    return editedDays
      .flatMap(d => d.blocks.flatMap(b => b.exercises))
      .filter(e => e.isProgressive);
  }

  async function handleSave() {
    setPhase('saving');
    setSaveError('');
    try {
      const oneRMsParsed: Record<string, number> = {};
      for (const [name, val] of Object.entries(oneRMs)) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) oneRMsParsed[name] = n;
      }

      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          weekCount,
          hasDeload,
          deloadPercentage: 50,
          days: editedDays,
          oneRMs: oneRMsParsed,
          startDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      router.push(`/training/${data.routine.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar');
      setPhase('onerms');
    }
  }

  const canProceedConfig = name.trim().length > 0;

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/training" className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all">
            ← Rutinas
          </Link>
          <div>
            <div className="text-sm font-light tracking-widest text-white">Nueva rutina</div>
            <div className="text-[10px] text-gray-600 font-mono">
              {phase === 'config' ? 'Paso 1 de 3 · Configuración' : phase === 'parse' ? 'Paso 2 de 3 · Revisar estructura' : 'Paso 3 de 3 · 1RM opcionales'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* ── STEP 1: Config + Text ──────────────────────────────── */}
        {(phase === 'config' || phase === 'parse') && (
          <>
            {/* Config */}
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5 space-y-4">
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Configuración</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Nombre de la rutina</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Torso Calistenia Mayo 2026"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Semanas de entrenamiento</label>
                  <div className="flex gap-2">
                    {[3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => setWeekCount(n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all ${weekCount === n ? 'bg-white text-black border-white' : 'border-white/[0.08] text-gray-400 hover:border-white/[0.18]'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Fecha de inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs text-gray-300">Semana de descarga</div>
                    <div className="text-[10px] font-mono text-gray-600">50% del peso habitual · al final del bloque</div>
                  </div>
                  <button
                    onClick={() => setHasDeload(!hasDeload)}
                    className={`w-10 h-5.5 rounded-full border transition-all relative ${hasDeload ? 'bg-white border-white' : 'bg-transparent border-white/[0.20]'}`}
                    style={{ height: 22 }}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${hasDeload ? 'left-[calc(100%-18px)] bg-black' : 'left-0.5 bg-gray-500'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Routine text */}
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5 space-y-3">
              <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Pegar rutina</div>
              <p className="text-xs text-gray-500">
                Pega el texto de tu rutina semanal. Gemini identificará los días, bloques y ejercicios automáticamente.
              </p>
              <textarea
                value={routineText}
                onChange={e => setRoutineText(e.target.value)}
                placeholder="LUNES — TORSO A&#10;1. Skill MU 4-5 × 1-2 reps...&#10;..."
                rows={12}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.15] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors resize-y font-mono"
              />
              {parseError && <p className="text-xs text-red-400 font-mono">{parseError}</p>}
              <button
                onClick={handleParse}
                disabled={parsing || !canProceedConfig || !routineText.trim()}
                className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                {parsing ? <span className="text-gray-500 animate-pulse font-mono text-xs">Analizando con Gemini...</span> : 'Analizar rutina →'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Review parsed ─────────────────────────────── */}
        {phase === 'parse' && editedDays.length > 0 && (
          <div className="border border-white/[0.07] rounded-2xl bg-[#111116] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                Estructura detectada · {editedDays.length} días
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">✓ Parseado</span>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {editedDays.map((day, di) => (
                <div key={day.id} className="px-5 py-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{day.dayName}</span>
                    <div className="text-sm text-white">{day.title}</div>
                  </div>

                  {day.blocks.map((block, bi) => (
                    <div key={block.id} className="pl-3 border-l border-white/[0.07] space-y-2">
                      <div className="text-[10px] font-mono text-gray-600">
                        {block.label ? `Bloque ${block.label}` : 'Bloque'}{block.isSuperset ? ' · Superserie' : ''}
                      </div>
                      {block.exercises.map((ex, ei) => (
                        <div key={ex.id} className="flex flex-wrap items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-200">{ex.name}</div>
                            <div className="text-[9px] font-mono text-gray-600">{ex.setsScheme}</div>
                          </div>
                          {/* Muscle group selector */}
                          <select
                            value={ex.muscleGroup}
                            onChange={e => updateExercise(di, bi, ei, { muscleGroup: e.target.value as MuscleGroup })}
                            className="text-[9px] font-mono bg-white/[0.04] border border-white/[0.08] text-gray-300 rounded-lg px-2 py-1 outline-none"
                          >
                            {MUSCLE_OPTIONS.map(g => (
                              <option key={g} value={g}>{MUSCLE_LABELS[g]}</option>
                            ))}
                          </select>
                          {/* Progressive toggle */}
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ex.isProgressive}
                              onChange={e => updateExercise(di, bi, ei, { isProgressive: e.target.checked })}
                              className="w-3 h-3 accent-white"
                            />
                            <span className="text-[9px] font-mono text-gray-500">Progresivo</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setPhase('onerms')}
                className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 transition-all"
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 1RMs ──────────────────────────────────────── */}
        {phase === 'onerms' && (
          <div className="border border-white/[0.07] rounded-2xl bg-[#111116] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">1RM Opcionales</div>
              <p className="text-xs text-gray-500 mt-1">
                Para ejercicios progresivos, ingresa tu 1RM estimado (kg) y calcularemos el peso recomendado por semana. Podés dejarlo vacío y completarlo luego.
              </p>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {progressiveExercises().length === 0 && (
                <div className="px-5 py-6 text-xs text-gray-600 font-mono text-center">
                  No hay ejercicios marcados como progresivos
                </div>
              )}
              {progressiveExercises().map(ex => (
                <div key={ex.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200">{ex.name}</div>
                    <div className="text-[9px] font-mono text-gray-600">{MUSCLE_LABELS[ex.muscleGroup]}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="2.5"
                      placeholder="—"
                      value={oneRMs[ex.name] ?? ''}
                      onChange={e => setOneRMs(prev => ({ ...prev, [ex.name]: e.target.value }))}
                      className="w-20 bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-lg px-3 py-1.5 text-sm text-white text-right outline-none transition-colors"
                    />
                    <span className="text-[10px] font-mono text-gray-600">kg</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/[0.06] space-y-2">
              {saveError && <p className="text-xs text-red-400 font-mono">{saveError}</p>}
              <button
                onClick={handleSave}
                className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 transition-all"
              >
                Crear rutina
              </button>
            </div>
          </div>
        )}

        {phase === 'saving' && (
          <div className="text-center py-20 text-gray-500 text-sm font-mono animate-pulse">
            Guardando rutina...
          </div>
        )}
      </div>
    </main>
  );
}
