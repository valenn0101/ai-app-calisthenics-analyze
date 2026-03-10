'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Routine, WeekLog, DayLog, BlockLog, ExerciseLog, SetEntry,
  MUSCLE_LABELS, MuscleGroup, estimateWeight, weeklyEstimate, parseSetsCount, MuscleVolume,
} from '@/lib/training-types';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

const scoreColor = (kg: number, prev: number) =>
  kg > prev ? 'text-emerald-400' : kg < prev ? 'text-red-400' : 'text-gray-400';


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
    <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center">
      <span className="text-gray-600 text-xs font-mono animate-pulse">Cargando...</span>
    </main>
  );
  if (!routine) return (
    <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-gray-500 text-sm">Rutina no encontrada</p>
        <Link href="/training" className="text-xs font-mono text-gray-600 hover:text-white">← Volver</Link>
      </div>
    </main>
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
    <main className="min-h-screen bg-[#0C0C10] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.07]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/training" className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all flex-shrink-0">
              ← Rutinas
            </Link>
            <div className="min-w-0">
              <div className="text-xs text-gray-500 font-mono truncate">{routine.name}</div>
              <div className="text-[10px] text-gray-700 font-mono">
                {routine.weekCount} sem{routine.hasDeload ? ' + descarga' : ''} · inicio {formatDate(routine.startDate)}
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setView('week')} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all ${view === 'week' ? 'border-white/30 text-white' : 'border-white/[0.07] text-gray-600 hover:text-gray-300'}`}>Semanas</button>
            <button onClick={() => setView('progress')} className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all ${view === 'progress' ? 'border-white/30 text-white' : 'border-white/[0.07] text-gray-600 hover:text-gray-300'}`}>Progreso</button>
          </div>
        </div>
      </header>

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
                      ? isDeload ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' : 'bg-white/[0.08] border-white/30 text-white'
                      : 'border-white/[0.07] text-gray-600 hover:text-gray-300'
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
                <div key={day.id} className="border border-white/[0.07] rounded-2xl bg-[#111116] overflow-hidden">
                  {/* Day header */}
                  <button
                    onClick={() => openDay(day.id)}
                    className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">{day.dayName}</div>
                      <div className="text-sm text-white mt-0.5">{day.title}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Array.from(new Set(day.blocks.flatMap(b => b.exercises.map(e => e.muscleGroup)))).map(mg => (
                          <span key={mg} className="text-[9px] font-mono text-gray-500">{MUSCLE_LABELS[mg as MuscleGroup]}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {dayLog?.completed && (
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-emerald-400">✓ Completado</div>
                          {prev && (
                            <div className="text-[9px] font-mono text-gray-600">
                              {formatDate(dayLog.date)}
                            </div>
                          )}
                        </div>
                      )}
                      <span className="text-gray-600 text-xs">{isActive ? '▴' : '▾'}</span>
                    </div>
                  </button>

                  {/* Inline day logger */}
                  {isActive && draftLog && (
                    <div className="border-t border-white/[0.06] px-5 py-4 space-y-5">
                      {day.blocks.map((block, bi) => {
                        const blockLog = draftLog.blocks[bi];
                        return (
                          <div key={block.id} className="space-y-3">
                            {/* Block header */}
                            <div className="flex items-center gap-2">
                              <div className="w-0.5 h-4 bg-gray-700 rounded-full" />
                              <span className="text-[10px] font-mono text-gray-500 uppercase">
                                {block.label ? `Bloque ${block.label}` : 'Bloque'}{block.isSuperset ? ' · Superserie' : ''}
                              </span>
                            </div>

                            {block.exercises.map((ex, ei) => {
                              const exLog: ExerciseLog = blockLog.exercises[ei];
                              const oneRM = routine.oneRMs[ex.name];
                              const prevExLog = prev?.blocks[bi]?.exercises[ei];

                              return (
                                <div key={ex.id} className="space-y-2 pl-3">
                                  {/* Exercise header */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm text-gray-200">{ex.name}</div>
                                      <div className="text-[9px] font-mono text-gray-600">{ex.setsScheme}</div>
                                      {ex.notes && <div className="text-[9px] text-gray-700 mt-0.5 leading-relaxed">{ex.notes}</div>}
                                    </div>
                                    {oneRM && ex.isProgressive && (
                                      <div className="text-right flex-shrink-0">
                                        <div className="text-[9px] font-mono text-gray-500">1RM: {oneRM}kg</div>
                                        <div className="text-[9px] font-mono text-amber-400">
                                          ~{weeklyEstimate(oneRM, 5, selectedWeek, routine.weekCount)}kg × 5r
                                        </div>
                                        {isDeloadWeek(selectedWeek) && (
                                          <div className="text-[9px] font-mono text-sky-400">
                                            Desc: ~{Math.round(oneRM * (routine.deloadPercentage / 100) / 2.5) * 2.5}kg
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Sets */}
                                  <div className="space-y-1.5">
                                    {exLog.sets.map((set, si) => {
                                      const prevSet = prevExLog?.sets[si];
                                      return (
                                        <div key={si} className="flex items-center gap-2">
                                          {/* Complete checkbox */}
                                          <input
                                            type="checkbox"
                                            checked={set.completed}
                                            onChange={e => updateSet(bi, ei, si, { completed: e.target.checked })}
                                            className="w-3.5 h-3.5 accent-emerald-400 flex-shrink-0"
                                          />
                                          <span className="text-[10px] font-mono text-gray-600 w-5 text-center">{si + 1}</span>

                                          {/* Weight */}
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              step="2.5"
                                              value={set.weight || ''}
                                              onChange={e => updateSet(bi, ei, si, { weight: parseFloat(e.target.value) || 0 })}
                                              placeholder="0"
                                              className="w-16 bg-white/[0.04] border border-white/[0.08] focus:border-white/[0.22] rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none"
                                            />
                                            <span className="text-[9px] font-mono text-gray-600">kg</span>
                                          </div>

                                          <span className="text-gray-700 text-xs">×</span>

                                          {/* Reps */}
                                          <input
                                            type="number"
                                            min="0"
                                            value={set.reps || ''}
                                            onChange={e => updateSet(bi, ei, si, { reps: parseInt(e.target.value) || 0 })}
                                            placeholder="0"
                                            className="w-12 bg-white/[0.04] border border-white/[0.08] focus:border-white/[0.22] rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none"
                                          />

                                          {/* Previous week reference */}
                                          {prevSet && (prevSet.weight > 0 || prevSet.reps > 0) && (
                                            <span className={`text-[9px] font-mono ml-1 ${scoreColor(set.weight, prevSet.weight)}`}>
                                              ant: {prevSet.weight > 0 ? `${prevSet.weight}kg` : 'BW'} × {prevSet.reps}
                                            </span>
                                          )}
                                          {/* 1RM hint for this rep count */}
                                          {oneRM && ex.isProgressive && set.reps > 0 && (
                                            <span className="text-[9px] font-mono text-gray-600 ml-auto">
                                              ~{estimateWeight(oneRM, set.reps)}kg
                                            </span>
                                          )}

                                          {/* Remove set */}
                                          {exLog.sets.length > 1 && (
                                            <button
                                              onClick={() => removeSet(bi, ei, si)}
                                              className="text-gray-700 hover:text-red-400 text-xs ml-1 transition-colors"
                                            >✕</button>
                                          )}
                                        </div>
                                      );
                                    })}

                                    <button
                                      onClick={() => addSet(bi, ei)}
                                      className="text-[10px] font-mono text-gray-600 hover:text-white transition-colors pl-7"
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
                        <label className="text-[10px] font-mono text-gray-600">Notas de la sesión</label>
                        <textarea
                          value={draftLog.notes}
                          onChange={e => setDraftLog(prev => prev ? { ...prev, notes: e.target.value } : prev)}
                          placeholder="Cómo te sentiste, ajustes, observaciones..."
                          rows={2}
                          className="w-full bg-white/[0.03] border border-white/[0.07] focus:border-white/[0.15] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-700 outline-none resize-none"
                        />
                      </div>

                      <button
                        onClick={saveDay}
                        disabled={saving}
                        className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-all"
                      >
                        {saving ? <span className="font-mono text-xs text-gray-500 animate-pulse">Guardando...</span> : 'Guardar sesión'}
                      </button>
                    </div>
                  )}

                  {/* Saved session summary (collapsed) */}
                  {!isActive && dayLog?.completed && (
                    <div className="border-t border-white/[0.05] px-5 py-3">
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
                                <div className="text-[9px] font-mono text-gray-600 truncate">{ex.name}</div>
                                <div className={`text-xs font-mono ${prevMax && maxW > 0 ? scoreColor(maxW, prevMax) : 'text-gray-300'}`}>
                                  {maxW > 0 ? `${maxW}kg` : 'BW'} · {completedSets.length} sets
                                </div>
                                {prevMax && maxW > 0 && maxW !== prevMax && (
                                  <div className="text-[9px] font-mono text-gray-600">ant: {prevMax}kg</div>
                                )}
                              </div>
                            );
                          }).filter(Boolean)
                        )}
                      </div>
                      {dayLog.notes && (
                        <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">{dayLog.notes}</p>
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
              <div className="text-center py-16 text-gray-600 text-xs font-mono animate-pulse">Cargando progreso...</div>
            )}

            {progressData && (
              <>
                {/* Volume per muscle group per week */}
                {progressData.weekVolumes.length > 0 && (
                  <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5">
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Volumen por grupo muscular</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="text-left font-mono text-gray-600 py-2 pr-4 text-[10px]">Músculo</th>
                            {progressData.weekVolumes.map(wv => (
                              <th key={wv.weekNumber} className="text-right font-mono text-gray-600 py-2 px-2 text-[10px]">
                                {wv.isDeload ? 'Desc' : `S${wv.weekNumber}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {(['push', 'pull', 'legs', 'core', 'skill', 'other'] as const).map(mg => {
                            const vals = progressData.weekVolumes.map(wv => wv.volume[mg]);
                            if (vals.every(v => v === 0)) return null;
                            return (
                              <tr key={mg}>
                                <td className="font-mono text-gray-400 py-2 pr-4 text-[10px]">{MUSCLE_LABELS[mg]}</td>
                                {vals.map((v, i) => {
                                  const prev = i > 0 ? vals[i - 1] : null;
                                  return (
                                    <td key={i} className={`text-right py-2 px-2 font-mono text-[10px] ${prev !== null && v !== prev ? scoreColor(v, prev) : 'text-gray-300'}`}>
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
                    <p className="text-[9px] font-mono text-gray-700 mt-3">Volumen = kg × reps (BW cuenta como 1kg)</p>
                  </div>
                )}

                {/* Exercise progression */}
                {Object.keys(progressData.exerciseProgress).length > 0 && (
                  <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5">
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Progresión por ejercicio</div>
                    <div className="divide-y divide-white/[0.05]">
                      {Object.entries(progressData.exerciseProgress).map(([name, entries]) => {
                        const sorted = [...entries].sort((a, b) => a.weekNumber - b.weekNumber);
                        const max = Math.max(...sorted.map(e => e.maxWeight));
                        const first = sorted[0]?.maxWeight ?? 0;
                        const last = sorted[sorted.length - 1]?.maxWeight ?? 0;
                        const gain = last - first;
                        return (
                          <div key={name} className="py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-gray-200">{name}</div>
                              <div className={`text-xs font-mono ${gain > 0 ? 'text-emerald-400' : gain < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {gain > 0 ? `+${gain}kg` : gain < 0 ? `${gain}kg` : '—'}
                              </div>
                            </div>
                            <div className="flex gap-3 overflow-x-auto">
                              {sorted.map(e => (
                                <div key={e.weekNumber} className="flex-shrink-0 text-center">
                                  <div className={`text-xs font-mono ${e.maxWeight === max ? 'text-white' : 'text-gray-400'}`}>
                                    {e.maxWeight}kg
                                  </div>
                                  <div className="text-[9px] font-mono text-gray-600">S{e.weekNumber}</div>
                                </div>
                              ))}
                            </div>
                            {/* Simple bar progression */}
                            <div className="flex gap-1 h-1 rounded-full overflow-hidden bg-white/[0.05]">
                              {sorted.map((e, i) => (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-full ${e.maxWeight === max ? 'bg-emerald-400' : 'bg-white/20'}`}
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
                  <div className="text-center py-16 text-gray-600 text-sm">
                    Sin datos registrados aún. Empieza a loguear sesiones.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
