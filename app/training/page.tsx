'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Routine } from '@/lib/training-types';
import { Goal, GoalCategory } from '@/lib/goals-types';

// ── Goals re-export for client (no fs import) ─────────────────────────────────
// GOAL_CATEGORY_LABELS is imported from lib/goals which uses fs.
// We duplicate the labels here to avoid importing a server module on the client.
const CAT_LABELS: Record<GoalCategory, string> = {
  skill: 'Habilidad',
  strength: 'Fuerza',
  endurance: 'Resistencia',
  body: 'Composición',
  other: 'General',
};

const CAT_OPTIONS: GoalCategory[] = ['skill', 'strength', 'endurance', 'body', 'other'];

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

  // Goal form
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

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all">
              ← Inicio
            </Link>
            <div>
              <div className="text-sm font-light tracking-widest">FORM<span className="text-gray-400">CHECK</span></div>
              <div className="text-[10px] text-gray-600 font-mono">Entrenamiento</div>
            </div>
          </div>
          <Link
            href="/training/new"
            className="text-[11px] font-mono text-black bg-white hover:bg-gray-100 px-4 py-2 rounded-lg transition-all"
          >
            + Nueva rutina
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-8">

        {/* ── RUTINA ACTUAL ─────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Rutina actual</div>

          {loadingRoutines && (
            <div className="text-xs text-gray-700 font-mono animate-pulse py-4">Cargando...</div>
          )}

          {!loadingRoutines && !current && (
            <div className="border border-dashed border-white/[0.10] rounded-2xl p-8 text-center space-y-3">
              <p className="text-sm text-gray-500">Sin rutina activa</p>
              <Link
                href="/training/new"
                className="inline-block text-xs text-black bg-white hover:bg-gray-100 px-5 py-2.5 rounded-xl transition-all"
              >
                Crear primera rutina
              </Link>
            </div>
          )}

          {current && (
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] overflow-hidden">
              <div className="px-5 py-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-0.5">
                      {current.weekCount} sem{current.hasDeload ? ' + descarga' : ''} · desde {formatDate(current.startDate)}
                    </div>
                    <h2 className="text-lg font-light text-white">{current.name}</h2>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link
                      href={`/training/${current.id}/evolve`}
                      className="text-[11px] font-mono text-gray-400 hover:text-white border border-white/[0.07] hover:border-white/[0.18] px-3 py-1.5 rounded-lg transition-all"
                    >
                      Evolucionar →
                    </Link>
                    <Link
                      href={`/training/${current.id}`}
                      className="text-[11px] font-mono text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.09] px-3 py-1.5 rounded-lg transition-all"
                    >
                      Ver detalle
                    </Link>
                  </div>
                </div>

                {/* Week progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[9px] font-mono text-gray-600">
                    <span>Semana {weekProgress(current.startDate, current.weekCount)} de {current.weekCount}</span>
                    <span>{Math.round(weekProgress(current.startDate, current.weekCount) / current.weekCount * 100)}%</span>
                  </div>
                  <div className="h-0.5 bg-white/[0.06] rounded-full">
                    <div
                      className="h-full bg-white/40 rounded-full transition-all"
                      style={{ width: `${Math.min(weekProgress(current.startDate, current.weekCount) / current.weekCount * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Days preview */}
              <div className="border-t border-white/[0.05] px-5 py-3 flex gap-4 overflow-x-auto">
                {current.days.map(day => (
                  <div key={day.id} className="flex-shrink-0 min-w-0">
                    <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">{day.dayName}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{day.title}</div>
                    <div className="text-[9px] text-gray-700 mt-0.5">
                      {day.blocks.reduce((n, b) => n + b.exercises.length, 0)} ejercicios
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── OBJETIVOS ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Objetivos</div>
            <button
              onClick={() => setShowGoalForm(v => !v)}
              className="text-[11px] font-mono text-gray-500 hover:text-white transition-colors"
            >
              {showGoalForm ? 'Cancelar' : '+ Agregar'}
            </button>
          </div>

          {/* Add goal form */}
          {showGoalForm && (
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-4 space-y-3">
              <input
                value={goalText}
                onChange={e => setGoalText(e.target.value)}
                placeholder="Ej: Muscle Up limpio × 3 repeticiones"
                onKeyDown={e => e.key === 'Enter' && addGoal()}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors"
              />
              <div className="flex gap-2">
                <div className="flex gap-1.5 flex-1 overflow-x-auto">
                  {CAT_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setGoalCategory(c)}
                      className={`flex-shrink-0 text-[10px] font-mono px-2.5 py-1.5 rounded-lg border transition-all ${goalCategory === c ? 'bg-white text-black border-white' : 'border-white/[0.08] text-gray-500 hover:text-gray-300'}`}
                    >
                      {CAT_LABELS[c]}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={goalTarget}
                  onChange={e => setGoalTarget(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] text-gray-400 outline-none"
                />
              </div>
              <button
                onClick={addGoal}
                disabled={addingGoal || !goalText.trim()}
                className="w-full py-2.5 bg-white text-black text-xs font-medium rounded-xl hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                Guardar objetivo
              </button>
            </div>
          )}

          {/* Active goals */}
          {loadingGoals && <div className="text-xs text-gray-700 font-mono animate-pulse">Cargando objetivos...</div>}
          {!loadingGoals && activeGoals.length === 0 && !showGoalForm && (
            <p className="text-xs text-gray-700 font-mono">Sin objetivos activos · agregá uno para trazar tu progreso</p>
          )}

          {activeGoals.length > 0 && (
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] divide-y divide-white/[0.05] overflow-hidden">
              {activeGoals.map(goal => (
                <div key={goal.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleGoal(goal)}
                    className="w-4 h-4 accent-emerald-400 flex-shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200">{goal.text}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-mono text-gray-600">{CAT_LABELS[goal.category]}</span>
                      {goal.targetDate && (
                        <span className="text-[9px] font-mono text-gray-700">→ {formatDate(goal.targetDate)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-gray-700 hover:text-red-400 text-xs transition-colors flex-shrink-0 px-1"
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
              <summary className="text-[10px] font-mono text-gray-700 cursor-pointer hover:text-gray-500 transition-colors list-none flex items-center gap-1">
                <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                {achievedGoals.length} objetivo{achievedGoals.length > 1 ? 's' : ''} completado{achievedGoals.length > 1 ? 's' : ''}
              </summary>
              <div className="mt-2 border border-white/[0.05] rounded-2xl bg-[#0F0F13] divide-y divide-white/[0.04] overflow-hidden">
                {achievedGoals.map(goal => (
                  <div key={goal.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => toggleGoal(goal)}
                      className="w-4 h-4 accent-emerald-400 flex-shrink-0 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-400 line-through">{goal.text}</div>
                      <div className="text-[9px] font-mono text-gray-600">
                        {CAT_LABELS[goal.category]}{goal.achievedDate ? ` · completado ${formatDate(goal.achievedDate)}` : ''}
                      </div>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="text-gray-700 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* ── HISTORIAL ─────────────────────────────────────────── */}
        {history.length > 0 && (
          <section className="space-y-3">
            <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Historial</div>
            <div className="space-y-2">
              {history.map(r => (
                <Link
                  key={r.id}
                  href={`/training/${r.id}`}
                  className="flex items-center justify-between border border-white/[0.06] rounded-xl bg-[#0F0F13] hover:bg-[#111116] px-4 py-3 transition-colors group"
                >
                  <div>
                    <div className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{r.name}</div>
                    <div className="text-[10px] font-mono text-gray-700">
                      {formatDate(r.startDate)} · {r.weekCount} semanas
                    </div>
                  </div>
                  <span className="text-gray-700 group-hover:text-gray-400 text-xs transition-colors">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
