'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import {
  Routine, WeekLog, DayLog, BlockLog, ExerciseLog, SetEntry,
  MUSCLE_LABELS, MuscleGroup, estimateWeight, weeklyEstimate, parseSetsCount, MuscleVolume,
  BLOCK_TYPE_LABELS, BlockType,
} from '@/lib/training-types';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

const scoreColor = (kg: number, prev: number) =>
  kg > prev ? 'text-emerald-400' : kg < prev ? 'text-rose-400' : 'text-[var(--muted)]';

const BLOCK_ACCENT: Record<string, { border: string; label: string; badge: string }> = {
  power:    { border: 'border-l-2 border-indigo-500', label: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  maxStr:   { border: 'border-l-2 border-rose-500',   label: 'text-rose-400',   badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  hyper:    { border: 'border-l-2 border-emerald-500', label: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  other:    { border: 'border-l-2 border-zinc-600',   label: 'text-[var(--muted)]',  badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};


// Average max weight across non-deload weeks for a given exerciseId
function avgWeightForExercise(exerciseId: string, weekLogs: WeekLog[]): number | null {
  const maxPerWeek: number[] = [];
  for (const log of weekLogs) {
    if (log.isDeload) continue;
    let weekMax = 0;
    for (const day of log.days) {
      for (const block of day.blocks) {
        for (const ex of block.exercises) {
          if (ex.exerciseId !== exerciseId) continue;
          for (const s of ex.sets) {
            if (s.completed && s.weight > weekMax) weekMax = s.weight;
          }
        }
      }
    }
    if (weekMax > 0) maxPerWeek.push(weekMax);
  }
  if (maxPerWeek.length === 0) return null;
  return maxPerWeek.reduce((a, b) => a + b, 0) / maxPerWeek.length;
}

function buildEmptyDayLog(routine: Routine, dayId: string, prevDayLog?: DayLog): DayLog {
  const day = routine.days.find(d => d.id === dayId)!;
  return {
    dayId,
    date: new Date().toISOString().split('T')[0],
    completed: false,
    notes: '',
    blocks: day.blocks.map(block => {
      const prevBlock = prevDayLog?.blocks.find(b => b.blockId === block.id);
      return {
        blockId: block.id,
        exercises: block.exercises.map(ex => {
          const prevEx = prevBlock?.exercises.find(e => e.exerciseId === ex.id);
          const n = parseSetsCount(ex.setsScheme);
          const sets: SetEntry[] = Array.from({ length: n }, (_, i) => ({
            weight: prevEx?.sets[i]?.weight ?? 0,
            reps: prevEx?.sets[i]?.reps ?? 0,
            completed: false,
          }));
          return { exerciseId: ex.id, sets };
        }),
      } satisfies BlockLog;
    }),
  };
}

// ── main component ─────────────────────────────────────────────────────────────

export default function RoutinePage() {
  const { id } = useParams<{ id: string }>();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [weekLogs, setWeekLogs] = useState<WeekLog[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [draftLog, setDraftLog] = useState<DayLog | null>(null);
  const [saving, setSaving] = useState(false);
  const [, setSaveOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'progress'>('week');
  const [progressData, setProgressData] = useState<{
    weekVolumes: { weekNumber: number; isDeload: boolean; volume: MuscleVolume }[];
    exerciseProgress: Record<string, { weekNumber: number; maxWeight: number; totalReps: number }[]>;
  } | null>(null);

  // Load routine + all logs
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/training/${id}`).then(r => r.json()),
      fetch(`/api/training/${id}/log`).then(r => r.json()),
    ]).then(([rd, ld]) => {
      setRoutine(rd.routine ?? null);
      setWeekLogs(ld.logs ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  const loadProgress = useCallback(async () => {
    if (!id) return;
    const data = await fetch(`/api/training/${id}/progress`).then(r => r.json());
    setProgressData(data);
  }, [id]);

  useEffect(() => {
    if (view === 'progress') loadProgress();
  }, [view, loadProgress]);

  if (loading) return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <span className="text-[var(--muted)] text-xs font-mono animate-pulse">Cargando...</span>
      </div>
    </div>
  );
  if (!routine) return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-[var(--muted)] text-sm">Rutina no encontrada</p>
          <Link href="/training" className="text-xs font-mono text-[var(--muted)] hover:text-foreground">← Volver</Link>
        </div>
      </div>
    </div>
  );

  const totalWeeks = routine.weekCount + (routine.hasDeload ? 1 : 0);
  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const isDeloadWeek = (w: number) => routine.hasDeload && w === totalWeeks;

  const currentWeekLog = weekLogs.find(l => l.weekNumber === selectedWeek);
  const prevWeekLog = weekLogs.find(l => l.weekNumber === selectedWeek - 1);

  // ── open/close day logger ────────────────────────────────────────────────────
  function openDay(dayId: string) {
    if (activeDayId === dayId) { setActiveDayId(null); setDraftLog(null); return; }

    const existingDayLog = currentWeekLog?.days.find(d => d.dayId === dayId);
    const prevDayLog = prevWeekLog?.days.find(d => d.dayId === dayId);

    setActiveDayId(dayId);
    setSaveOk(false);
    setDraftLog(existingDayLog
      ? JSON.parse(JSON.stringify(existingDayLog)) // deep clone for editing
      : buildEmptyDayLog(routine!, dayId, prevDayLog));
  }

  // ── set updates ──────────────────────────────────────────────────────────────
  function updateSet(blockIdx: number, exIdx: number, setIdx: number, patch: Partial<SetEntry>) {
    setDraftLog(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as DayLog;
      Object.assign(next.blocks[blockIdx].exercises[exIdx].sets[setIdx], patch);
      return next;
    });
  }

  function addSet(blockIdx: number, exIdx: number) {
    setDraftLog(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as DayLog;
      next.blocks[blockIdx].exercises[exIdx].sets.push({ weight: 0, reps: 0, completed: false });
      return next;
    });
  }

  function removeSet(blockIdx: number, exIdx: number, setIdx: number) {
    setDraftLog(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as DayLog;
      next.blocks[blockIdx].exercises[exIdx].sets.splice(setIdx, 1);
      return next;
    });
  }

  // ── save ─────────────────────────────────────────────────────────────────────
  async function saveDay() {
    if (!draftLog) return;
    setSaving(true);

    const updatedDayLog: DayLog = { ...draftLog, completed: true };

    // Merge into currentWeekLog's days (or create new)
    const existingDays = currentWeekLog?.days ?? [];
    const otherDays = existingDays.filter(d => d.dayId !== activeDayId);
    const days = [...otherDays, updatedDayLog];

    const res = await fetch(`/api/training/${id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekNumber: selectedWeek,
        isDeload: isDeloadWeek(selectedWeek),
        days,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setWeekLogs(prev => {
        const idx = prev.findIndex(l => l.weekNumber === selectedWeek);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data.log;
          return next;
        }
        return [...prev, data.log];
      });
      setSaveOk(true);
      setActiveDayId(null);
      setDraftLog(null);
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  const prevDayLog = (dayId: string) => prevWeekLog?.days.find(d => d.dayId === dayId);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      {/* Sub-header */}
      <div className="border-b border-[var(--border-color)] bg-surface/50">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{routine.name}</p>
            <p className="text-[10px] font-mono text-[var(--muted)]">
              {routine.weekCount} sem{routine.hasDeload ? ' + descarga' : ''} · inicio {formatDate(routine.startDate)}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0 bg-surface-2 rounded-lg p-1">
            <button onClick={() => setView('week')} className={`text-[11px] font-mono px-3 py-1.5 rounded-md transition-all ${view === 'week' ? 'bg-surface text-foreground shadow-sm' : 'text-[var(--muted)] hover:text-foreground'}`}>Semanas</button>
            <button onClick={() => setView('progress')} className={`text-[11px] font-mono px-3 py-1.5 rounded-md transition-all ${view === 'progress' ? 'bg-surface text-foreground shadow-sm' : 'text-[var(--muted)] hover:text-foreground'}`}>Progreso</button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-6 space-y-5">

        {/* ── WEEK VIEW ─────────────────────────────────────────── */}
        {view === 'week' && (
          <>
            {/* Week tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {weekNumbers.map(w => {
                const isDeload = isDeloadWeek(w);
                const log = weekLogs.find(l => l.weekNumber === w);
                const completedDays = log?.days.filter(d => d.completed).length ?? 0;
                return (
                  <button
                    key={w}
                    onClick={() => { setSelectedWeek(w); setActiveDayId(null); setDraftLog(null); }}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-mono transition-all ${selectedWeek === w
                      ? isDeload ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-surface border-emerald-500/40 text-foreground'
                      : 'border-[var(--border-color)] text-[var(--muted)] hover:text-foreground'
                    }`}
                  >
                    <div>{isDeload ? 'Descarga' : `Sem ${w}`}</div>
                    {completedDays > 0 && (
                      <div className="text-[9px] text-emerald-400 mt-0.5">{completedDays}/{routine.days.length} días</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Deload note */}
            {isDeloadWeek(selectedWeek) && (
              <div className="border border-sky-500/20 bg-sky-500/[0.04] rounded-xl px-4 py-3">
                <p className="text-xs text-sky-400 font-mono">
                  Semana de descarga · {routine.deloadPercentage}% del peso habitual · recuperación activa
                </p>
              </div>
            )}

            {/* Day cards */}
            {routine.days.map((day) => {
              const dayLog = currentWeekLog?.days.find(d => d.dayId === day.id);
              const isActive = activeDayId === day.id;
              const prev = prevDayLog(day.id);

              return (
                <div key={day.id} className={`rounded-2xl overflow-hidden border transition-colors ${dayLog?.completed ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-[var(--border-color)] bg-surface'}`}>
                  {/* Day header */}
                  <button
                    onClick={() => openDay(day.id)}
                    className="w-full text-left px-5 py-4 hover:bg-white/[0.02] dark:hover:bg-white/[0.02] hover:bg-black/[0.02] transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">{day.dayName}</div>
                      <div className="text-sm font-medium text-foreground mt-0.5">{day.title}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Array.from(new Set(day.blocks.flatMap(b => b.exercises.map(e => e.muscleGroup)))).map(mg => (
                          <span key={mg} className="text-[9px] font-mono text-[var(--muted)]">{MUSCLE_LABELS[mg as MuscleGroup]}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {dayLog?.completed && (
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-emerald-500">✓ Completado</div>
                          {prev && (
                            <div className="text-[9px] font-mono text-[var(--muted)]">
                              {formatDate(dayLog.date)}
                            </div>
                          )}
                        </div>
                      )}
                      <span className="text-[var(--muted)] text-xs">{isActive ? '▴' : '▾'}</span>
                    </div>
                  </button>

                  {/* Inline day logger */}
                  {isActive && draftLog && (
                    <div className="border-t border-[var(--border-color)] px-5 py-4 space-y-5">
                      {day.blocks.map((block, bi) => {
                        const blockLog = draftLog.blocks[bi];
                        const blockType = block.blockType as BlockType | undefined;
                        const accent = BLOCK_ACCENT[blockType ?? 'other'] ?? BLOCK_ACCENT.other;
                        return (
                          <div key={block.id} className={`space-y-3 pl-3 ${accent.border}`}>
                            {/* Block header */}
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-mono uppercase tracking-widest ${accent.label}`}>
                                {block.label ? `Bloque ${block.label}` : 'Bloque'}{block.isSuperset ? ' · Superserie' : ''}
                              </span>
                              {block.blockType && block.blockType !== 'other' && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${accent.badge}`}>
                                  {BLOCK_TYPE_LABELS[block.blockType as BlockType]}
                                </span>
                              )}
                            </div>

                            {block.exercises.map((ex, ei) => {
                              const exLog: ExerciseLog = blockLog.exercises[ei];
                              const oneRM = routine.oneRMs[ex.name];
                              const prevExLog = prev?.blocks[bi]?.exercises[ei];

                              return (
                                <div key={ex.id} className="space-y-2">
                                  {/* Exercise header */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{ex.name}</p>
                                      <p className="text-[9px] font-mono text-[var(--muted)]">{ex.setsScheme}</p>
                                      {ex.notes && (
                                        <div className="mt-1.5 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-lg px-3 py-2">
                                          <p className="text-[10px] text-indigo-400 leading-relaxed">{ex.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                    {oneRM && ex.isProgressive && (
                                      <div className="text-right flex-shrink-0">
                                        <div className="text-[9px] font-mono text-gray-500">1RM: {oneRM}kg</div>
                                        <div className="text-[9px] font-mono text-amber-400">
                                          ~{weeklyEstimate(oneRM, 5, selectedWeek, routine.weekCount)}kg × 5r
                                        </div>
                                        {isDeloadWeek(selectedWeek) && (() => {
                                          const base = avgWeightForExercise(ex.id, weekLogs) ?? oneRM;
                                          const suggested = Math.round(base * (routine.deloadPercentage / 100) / 2.5) * 2.5;
                                          const fromAvg = avgWeightForExercise(ex.id, weekLogs) !== null;
                                          return (
                                            <div className="text-[9px] font-mono text-sky-400">
                                              Desc: ~{suggested}kg
                                              <span className="text-gray-600 ml-1">({fromAvg ? `prom ${Math.round(base)}kg` : `1RM`})</span>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>

                                  {/* Sets */}
                                  <div className="space-y-1.5">
                                    {exLog.sets.map((set, si) => {
                                      const prevSet = prevExLog?.sets[si];
                                      return (
                                        <div key={si} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${set.completed ? 'bg-emerald-500/10 border border-emerald-500/20' : 'border border-transparent'}`}>
                                          {/* Complete checkbox */}
                                          <input
                                            type="checkbox"
                                            checked={set.completed}
                                            onChange={e => updateSet(bi, ei, si, { completed: e.target.checked })}
                                            className="w-4 h-4 accent-emerald-500 flex-shrink-0"
                                          />
                                          <span className="text-[10px] font-mono text-[var(--muted)] w-5 text-center">{si + 1}</span>

                                          {/* Weight */}
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              step="2.5"
                                              value={set.weight || ''}
                                              onChange={e => updateSet(bi, ei, si, { weight: parseFloat(e.target.value) || 0 })}
                                              placeholder="0"
                                              className={`w-16 bg-surface border border-[var(--border-color)] focus:border-zinc-400 rounded-lg px-2 py-2 text-sm text-center outline-none transition-colors ${set.completed ? 'text-emerald-400' : 'text-foreground'}`}
                                            />
                                            <span className="text-[9px] font-mono text-[var(--muted)]">kg</span>
                                          </div>

                                          <span className="text-[var(--muted)] text-xs">×</span>

                                          {/* Reps */}
                                          <input
                                            type="number"
                                            min="0"
                                            value={set.reps || ''}
                                            onChange={e => updateSet(bi, ei, si, { reps: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                            className={`w-12 bg-surface border border-[var(--border-color)] focus:border-zinc-400 rounded-lg px-2 py-2 text-sm text-center outline-none transition-colors ${set.completed ? 'text-emerald-400' : 'text-foreground'}`}
                                          />

                                          {/* Previous week reference */}
                                          {prevSet && (prevSet.weight > 0 || prevSet.reps > 0) && (
                                            <span className={`text-[9px] font-mono ml-1 ${scoreColor(set.weight, prevSet.weight)}`}>
                                              ant: {prevSet.weight > 0 ? `${prevSet.weight}kg` : 'BW'} × {prevSet.reps}
                                            </span>
                                          )}
                                          {/* 1RM hint for this rep count */}
                                          {oneRM && ex.isProgressive && set.reps > 0 && (
                                            <span className="text-[9px] font-mono text-[var(--muted)] ml-auto">
                                              ~{estimateWeight(oneRM, set.reps)}kg
                                            </span>
                                          )}

                                          {/* Remove set */}
                                          {exLog.sets.length > 1 && (
                                            <button
                                              onClick={() => removeSet(bi, ei, si)}
                                              className="text-[var(--muted)] hover:text-rose-400 text-xs ml-1 transition-colors"
                                            >✕</button>
                                          )}
                                        </div>
                                      );
                                    })}

                                    <button
                                      onClick={() => addSet(bi, ei)}
                                      className="text-[10px] font-mono text-[var(--muted)] hover:text-foreground transition-colors pl-2"
                                    >
                                      + Añadir set
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Session notes */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-[var(--muted)]">Notas de la sesión</label>
                        <textarea
                          value={draftLog.notes}
                          onChange={e => setDraftLog(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                          placeholder="Cómo te sentiste, ajustes, observaciones..."
                          rows={2}
                          className="w-full bg-surface border border-[var(--border-color)] focus:border-zinc-400 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-[var(--muted)] outline-none resize-none transition-colors"
                        />
                      </div>

                      <button
                        onClick={saveDay}
                        disabled={saving}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl disabled:opacity-40 transition-all"
                      >
                        {saving ? <span className="font-mono text-xs animate-pulse">Guardando...</span> : 'Guardar sesión'}
                      </button>
                    </div>
                  )}

                  {/* Saved session summary (collapsed) */}
                  {!isActive && dayLog?.completed && (
                    <div className="border-t border-emerald-500/20 px-5 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {day.blocks.flatMap((block, bi) =>
                          block.exercises.map((ex, ei) => {
                            const exLog = dayLog.blocks[bi]?.exercises[ei];
                            const completedSets = exLog?.sets.filter(s => s.completed) ?? [];
                            if (!completedSets.length) return null;
                            const maxW = Math.max(...completedSets.map(s => s.weight));
                            const prevExLog = prevDayLog(day.id)?.blocks[bi]?.exercises[ei];
                            const prevMax = prevExLog ? Math.max(...(prevExLog.sets.filter(s => s.completed).map(s => s.weight) || [0])) : null;

                            return (
                              <div key={ex.id} className="space-y-0.5">
                                <p className="text-[9px] font-mono text-[var(--muted)] truncate">{ex.name}</p>
                                <p className={`text-xs font-mono ${prevMax && maxW > 0 ? scoreColor(maxW, prevMax) : 'text-foreground'}`}>
                                  {maxW > 0 ? `${maxW}kg` : 'BW'} · {completedSets.length} sets
                                </p>
                                {prevMax && maxW > 0 && maxW !== prevMax && (
                                  <p className="text-[9px] font-mono text-[var(--muted)]">ant: {prevMax}kg</p>
                                )}
                              </div>
                            );
                          }).filter(Boolean)
                        )}
                      </div>
                      {dayLog.notes && (
                        <p className="text-[10px] text-[var(--muted)] mt-2 leading-relaxed">{dayLog.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── PROGRESS VIEW ──────────────────────────────────────── */}
        {view === 'progress' && (
          <div className="space-y-5">
            {!progressData && (
              <div className="text-center py-16 text-[var(--muted)] text-xs font-mono animate-pulse">Cargando progreso...</div>
            )}

            {progressData && (
              <>
                {/* Volume per muscle group per week */}
                {progressData.weekVolumes.length > 0 && (
                  <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-4">Volumen por grupo muscular</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border-color)]">
                            <th className="text-left font-mono text-[var(--muted)] py-2 pr-4 text-[10px]">Músculo</th>
                            {progressData.weekVolumes.map(wv => (
                              <th key={wv.weekNumber} className="text-right font-mono text-[var(--muted)] py-2 px-2 text-[10px]">
                                {wv.isDeload ? 'Desc' : `S${wv.weekNumber}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {(['push', 'pull', 'legs', 'core', 'skill', 'other'] as const).map(mg => {
                            const vals = progressData.weekVolumes.map(wv => wv.volume[mg]);
                            if (vals.every(v => v === 0)) return null;
                            return (
                              <tr key={mg}>
                                <td className="font-mono text-[var(--muted)] py-2 pr-4 text-[10px]">{MUSCLE_LABELS[mg]}</td>
                                {vals.map((v, i) => {
                                  const prev = i > 0 ? vals[i - 1] : null;
                                  return (
                                    <td key={i} className={`text-right py-2 px-2 font-mono text-[10px] ${prev !== null && v !== prev ? scoreColor(v, prev) : 'text-foreground'}`}>
                                      {v > 0 ? `${v.toLocaleString()}` : '—'}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[9px] font-mono text-[var(--muted)] mt-3">Volumen = kg × reps (BW cuenta como 1kg)</p>
                  </div>
                )}

                {/* Exercise progression */}
                {Object.keys(progressData.exerciseProgress).length > 0 && (
                  <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-4">Progresión por ejercicio</p>
                    <div className="divide-y divide-[var(--border-color)]">
                      {Object.entries(progressData.exerciseProgress).map(([name, entries]) => {
                        const sorted = [...entries].sort((a, b) => a.weekNumber - b.weekNumber);
                        const max = Math.max(...sorted.map(e => e.maxWeight));
                        const first = sorted[0]?.maxWeight ?? 0;
                        const last = sorted[sorted.length - 1]?.maxWeight ?? 0;
                        const gain = last - first;
                        return (
                          <div key={name} className="py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground">{name}</p>
                              <span className={`text-xs font-mono ${gain > 0 ? 'text-emerald-500' : gain < 0 ? 'text-rose-400' : 'text-[var(--muted)]'}`}>
                                {gain > 0 ? `+${gain}kg` : gain < 0 ? `${gain}kg` : '—'}
                              </span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto scrollbar-thin">
                              {sorted.map(e => (
                                <div key={e.weekNumber} className="flex-shrink-0 text-center">
                                  <p className={`text-xs font-mono ${e.maxWeight === max ? 'text-emerald-500' : 'text-[var(--muted)]'}`}>
                                    {e.maxWeight}kg
                                  </p>
                                  <p className="text-[9px] font-mono text-[var(--muted)]">S{e.weekNumber}</p>
                                </div>
                              ))}
                            </div>
                            {/* Simple bar progression */}
                            <div className="flex gap-1 h-1 rounded-full overflow-hidden bg-surface-2">
                              {sorted.map((e, i) => (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-full ${e.maxWeight === max ? 'bg-emerald-500' : 'bg-zinc-500'}`}
                                  style={{ opacity: 0.4 + 0.6 * (e.maxWeight / max) }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {progressData.weekVolumes.length === 0 && Object.keys(progressData.exerciseProgress).length === 0 && (
                  <div className="text-center py-16 text-[var(--muted)] text-sm">
                    Sin datos registrados aún. Empieza a loguear sesiones.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
