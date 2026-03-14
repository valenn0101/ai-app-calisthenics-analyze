'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { Routine } from '@/lib/training-types';
import { Goal, GoalCategory } from '@/lib/goals-types';

// ── Goals labels (duplicated to avoid server fs import on client) ─────────────
const CAT_LABELS: Record<GoalCategory, string> = {
  skill: 'Habilidad',
  strength: 'Fuerza',
  endurance: 'Resistencia',
  body: 'Composición',
  other: 'General',
};

const CAT_OPTIONS: GoalCategory[] = ['skill', 'strength', 'endurance', 'body', 'other'];

const CAT_COLORS: Record<GoalCategory, string> = {
  skill: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  strength: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  endurance: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  body: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function weekProgress(startDate: string, weekCount: number) {
  const start = new Date(startDate);
  const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return Math.min(Math.max(diff + 1, 1), weekCount);
}

export default function TrainingPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(true);
  const [loadingGoals, setLoadingGoals] = useState(true);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('strength');
  const [goalTarget, setGoalTarget] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);

  useEffect(() => {
    fetch('/api/training').then(r => r.json()).then(d => {
      setRoutines((d.routines ?? []).sort(
        (a: Routine, b: Routine) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    }).finally(() => setLoadingRoutines(false));

    fetch('/api/goals').then(r => r.json()).then(d => setGoals(d.goals ?? [])).finally(() => setLoadingGoals(false));
  }, []);

  const current = routines[0] ?? null;
  const history = routines.slice(1);

  async function toggleGoal(goal: Goal) {
    const newAchieved = !goal.achieved;
    setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, achieved: newAchieved } : g));
    await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ achieved: newAchieved }),
    });
  }

  async function deleteGoal(goalId: string) {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
  }

  async function addGoal() {
    if (!goalText.trim()) return;
    setAddingGoal(true);
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: goalText.trim(), category: goalCategory, targetDate: goalTarget || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setGoals(prev => [data.goal, ...prev]);
      setGoalText('');
      setGoalTarget('');
      setGoalCategory('strength');
      setShowGoalForm(false);
    }
    setAddingGoal(false);
  }

  const activeGoals = goals.filter(g => !g.achieved);
  const achievedGoals = goals.filter(g => g.achieved);

  const currentW = current ? weekProgress(current.startDate, current.weekCount) : 0;
  const progressPct = current ? Math.round(currentW / current.weekCount * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-8">

        {/* ── Rutina actual ─────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Rutina actual</h2>
            <Link
              href="/training/new"
              className="text-[11px] font-mono text-foreground bg-surface hover:bg-surface-2 border border-[var(--border-color)] px-3 py-1.5 rounded-lg transition-all"
            >
              + Nueva rutina
            </Link>
          </div>

          {loadingRoutines && (
            <div className="text-xs text-[var(--muted)] font-mono animate-pulse py-4">Cargando...</div>
          )}

          {!loadingRoutines && !current && (
            <div className="border border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm text-[var(--muted)]">Sin rutina activa</p>
              <Link
                href="/training/new"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-all"
              >
                Crear primera rutina
              </Link>
            </div>
          )}

          {current && (
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
                      {current.weekCount} sem{current.hasDeload ? ' + descarga' : ''} · desde {formatDate(current.startDate)}
                    </p>
                    <h3 className="text-lg font-medium text-foreground mt-0.5">{current.name}</h3>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      href={`/training/${current.id}/evolve`}
                      className="text-[11px] font-mono text-[var(--muted)] hover:text-foreground border border-[var(--border-color)] px-3 py-1.5 rounded-lg transition-all"
                    >
                      Evolucionar →
                    </Link>
                    <Link
                      href={`/training/${current.id}`}
                      className="text-[11px] font-mono bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      Ver detalle
                    </Link>
                  </div>
                </div>

                {/* Week progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono text-[var(--muted)]">
                    <span>Semana {currentW} de {current.weekCount}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-1 bg-surface-2 rounded-full">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(progressPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Days as horizontal chips */}
              <div className="border-t border-[var(--border-color)] px-5 py-3 flex gap-2 overflow-x-auto scrollbar-thin">
                {current.days.map(day => (
                  <div
                    key={day.id}
                    className="flex-shrink-0 rounded-lg border border-[var(--border-color)] bg-background px-3 py-2 min-w-[100px]"
                  >
                    <p className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-wider">{day.dayName}</p>
                    <p className="text-[10px] text-foreground truncate max-w-[120px] mt-0.5">{day.title}</p>
                    <p className="text-[9px] text-[var(--muted)] mt-0.5">
                      {day.blocks.reduce((n, b) => n + b.exercises.length, 0)} ejercicios
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Objetivos ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Objetivos</h2>
            <button
              onClick={() => setShowGoalForm(v => !v)}
              className="text-[11px] font-mono text-[var(--muted)] hover:text-foreground transition-colors"
            >
              {showGoalForm ? 'Cancelar' : '+ Agregar'}
            </button>
          </div>

          {/* Add goal form */}
          {showGoalForm && (
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-4 space-y-3">
              <input
                value={goalText}
                onChange={e => setGoalText(e.target.value)}
                placeholder="Ej: Muscle Up limpio × 3 repeticiones"
                onKeyDown={e => e.key === 'Enter' && addGoal()}
                className="w-full bg-background border border-[var(--border-color)] focus:border-zinc-500 rounded-xl px-4 py-3 text-sm text-foreground placeholder-[var(--muted)] outline-none transition-colors"
              />
              <div className="flex gap-2">
                <div className="flex gap-1.5 flex-1 overflow-x-auto scrollbar-thin">
                  {CAT_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setGoalCategory(c)}
                      className={`flex-shrink-0 text-[10px] font-mono px-2.5 py-1.5 rounded-lg border transition-all ${
                        goalCategory === c
                          ? CAT_COLORS[c]
                          : 'border-[var(--border-color)] text-[var(--muted)] hover:text-foreground'
                      }`}
                    >
                      {CAT_LABELS[c]}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={goalTarget}
                  onChange={e => setGoalTarget(e.target.value)}
                  className="bg-background border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-[11px] text-[var(--muted)] outline-none"
                />
              </div>
              <button
                onClick={addGoal}
                disabled={addingGoal || !goalText.trim()}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-medium rounded-xl disabled:opacity-30 transition-all"
              >
                Guardar objetivo
              </button>
            </div>
          )}

          {/* Active goals */}
          {loadingGoals && <div className="text-xs text-[var(--muted)] font-mono animate-pulse">Cargando objetivos...</div>}
          {!loadingGoals && activeGoals.length === 0 && !showGoalForm && (
            <p className="text-xs text-[var(--muted)] font-mono">Sin objetivos activos · agregá uno para trazar tu progreso</p>
          )}

          {activeGoals.length > 0 && (
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface divide-y divide-[var(--border-color)] overflow-hidden">
              {activeGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleGoal(goal)}
                    className="w-4 h-4 accent-emerald-500 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{goal.text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${CAT_COLORS[goal.category]}`}>
                        {CAT_LABELS[goal.category]}
                      </span>
                      {goal.targetDate && (
                        <span className="text-[9px] font-mono text-[var(--muted)]">→ {formatDate(goal.targetDate)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-[var(--muted)] hover:text-rose-400 text-xs transition-colors flex-shrink-0 px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Achieved goals (collapsed) */}
          {achievedGoals.length > 0 && (
            <details className="group">
              <summary className="text-[10px] font-mono text-[var(--muted)] cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                {achievedGoals.length} objetivo{achievedGoals.length > 1 ? 's' : ''} completado{achievedGoals.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-2 border border-[var(--border-color)] rounded-2xl bg-surface divide-y divide-[var(--border-color)] overflow-hidden">
                {achievedGoals.map(goal => (
                  <div key={goal.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleGoal(goal)}
                      className="w-4 h-4 accent-emerald-500 flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--muted)] line-through">{goal.text}</p>
                      <p className="text-[9px] font-mono text-[var(--muted)]">
                        {CAT_LABELS[goal.category]}{goal.achievedDate ? ` · completado ${formatDate(goal.achievedDate)}` : ''}
                      </p>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="text-[var(--muted)] hover:text-rose-400 text-xs transition-colors px-1">✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ── Historial ─────────────────────────────────────── */}
        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Historial</h2>
            <div className="space-y-2">
              {history.map(r => (
                <Link
                  key={r.id}
                  href={`/training/${r.id}`}
                  className="flex items-center justify-between border border-[var(--border-color)] rounded-xl bg-surface hover:bg-surface-2 px-4 py-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm text-foreground">{r.name}</p>
                    <p className="text-[10px] font-mono text-[var(--muted)]">
                      {formatDate(r.startDate)} · {r.weekCount} semanas
                    </p>
                  </div>
                  <span className="text-[var(--muted)] group-hover:text-foreground text-xs transition-colors">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
