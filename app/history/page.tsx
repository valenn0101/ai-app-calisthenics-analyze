'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import ProgressChart from '@/components/ProgressChart';
import { SessionRecord } from '@/lib/storage';

const scoreColor = (s: number) =>
  s >= 8 ? 'text-emerald-500' : s >= 6 ? 'text-amber-400' : s >= 4 ? 'text-orange-400' : 'text-rose-400';

export default function HistoryPage() {
  const [selectedExercise, setSelectedExercise] = useState<string>('all');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([]);
  const [chartSessions, setChartSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => { fetchSessions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (allSessions.length === 0) return;
    const filtered = selectedExercise === 'all'
      ? allSessions
      : allSessions.filter(s => s.exercise === selectedExercise);
    setSessions(filtered);
    setChartSessions([...filtered].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
  }, [selectedExercise, allSessions]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const all: SessionRecord[] = data.sessions || [];
      setAllSessions(all);

      const filtered = selectedExercise === 'all'
        ? all
        : all.filter(s => s.exercise === selectedExercise);
      setSessions(filtered);

      const sorted = [...filtered].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setChartSessions(sorted);
    } catch {
      setSessions([]);
      setAllSessions([]);
      setChartSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const avgScore = sessions.length > 0
    ? (sessions.reduce((s, r) => s + r.score, 0) / sessions.length).toFixed(1)
    : null;

  const bestScore = sessions.length > 0
    ? Math.max(...sessions.map(s => s.score))
    : null;

  const latestSession = sessions.length > 0 ? sessions[0] : null;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedExercise('all')}
            className={`text-xs font-mono py-1.5 px-3 rounded-lg border transition-all ${
              selectedExercise === 'all'
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                : 'border-[var(--border-color)] text-[var(--muted)] hover:text-foreground'
            }`}
          >
            Todos
          </button>
          {Array.from(new Set(allSessions.map(s => s.exercise))).sort().map(ex => (
            <button
              key={ex}
              onClick={() => setSelectedExercise(ex)}
              className={`text-xs font-mono py-1.5 px-3 rounded-lg border transition-all ${
                selectedExercise === ex
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                  : 'border-[var(--border-color)] text-[var(--muted)] hover:text-foreground'
              }`}
            >
              {ex}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-[var(--muted)] font-mono py-16 animate-pulse">
            Cargando historial...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-[var(--muted)] font-mono text-sm">No hay sesiones registradas</p>
            <Link
              href="/"
              className="inline-block text-xs font-mono text-foreground border border-[var(--border-color)] px-4 py-2 rounded-lg hover:bg-surface transition-all"
            >
              Comenzar análisis →
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-[var(--border-color)] rounded-xl bg-surface p-4 text-center">
                <p className="text-2xl font-mono font-light text-indigo-400">{sessions.length}</p>
                <p className="text-[10px] text-[var(--muted)] font-mono uppercase mt-1">Sesiones</p>
              </div>
              <div className="border border-[var(--border-color)] rounded-xl bg-surface p-4 text-center">
                <p className="text-2xl font-mono font-light text-sky-400">{avgScore}</p>
                <p className="text-[10px] text-[var(--muted)] font-mono uppercase mt-1">Score Prom.</p>
              </div>
              <div className="border border-[var(--border-color)] rounded-xl bg-surface p-4 text-center">
                <p className="text-2xl font-mono font-light text-emerald-500">{bestScore}</p>
                <p className="text-[10px] text-[var(--muted)] font-mono uppercase mt-1">Mejor</p>
              </div>
            </div>

            {/* Progress Chart */}
            {selectedExercise !== 'all' && chartSessions.length > 0 && (
              <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5">
                <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-4">
                  Progresión — {selectedExercise}
                </h2>
                <ProgressChart
                  sessions={chartSessions}
                  exercise={selectedExercise}
                />
              </div>
            )}

            {/* Latest comparison */}
            {latestSession && latestSession.previousScore !== undefined && (
              <div className={`border rounded-2xl p-5 ${
                (latestSession.improvement ?? 0) >= 0
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                  : 'border-rose-500/20 bg-rose-500/[0.04]'
              }`}>
                <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Última sesión vs anterior</p>
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-mono font-light text-foreground">
                    {latestSession.previousScore} → {latestSession.score}
                  </p>
                  <p className={`text-lg font-mono ${(latestSession.improvement ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {(latestSession.improvement ?? 0) > 0 ? '+' : ''}{latestSession.improvement?.toFixed(1)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{latestSession.exercise}</p>
                </div>
              </div>
            )}

            {/* Session List */}
            <div className="space-y-2">
              <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
                Sesiones ({sessions.length})
              </h2>
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="border border-[var(--border-color)] rounded-xl bg-surface overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-all text-left"
                  >
                    <div className={`text-xl font-mono font-light w-10 text-center ${scoreColor(session.score)}`}>
                      {session.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">
                        {session.exercise}
                      </p>
                      <p className="text-xs text-[var(--muted)] font-mono truncate">
                        {new Date(session.date).toLocaleString('es')} · {session.analysisData.phase}
                      </p>
                    </div>
                    {session.improvement !== undefined && (
                      <div className={`text-xs font-mono flex-shrink-0 ${
                        session.improvement > 0 ? 'text-emerald-500' :
                        session.improvement < 0 ? 'text-rose-400' :
                        'text-[var(--muted)]'
                      }`}>
                        {session.improvement > 0 ? '+' : ''}{session.improvement.toFixed(1)}
                      </div>
                    )}
                    <div className="text-[var(--muted)] text-xs flex-shrink-0">
                      {expandedSession === session.id ? '▲' : '▼'}
                    </div>
                  </button>

                  {expandedSession === session.id && (
                    <div className="border-t border-[var(--border-color)] px-4 py-4 space-y-4">
                      {/* Corrections summary */}
                      {session.analysisData.corrections.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Correcciones</p>
                          <ul className="space-y-1">
                            {session.analysisData.corrections
                              .sort((a, b) => {
                                const order = { high: 0, medium: 1, low: 2 };
                                return order[a.priority] - order[b.priority];
                              })
                              .map((c, i) => (
                                <li key={i} className="text-xs text-foreground flex gap-2">
                                  <span className={
                                    c.priority === 'high' ? 'text-rose-400' :
                                    c.priority === 'medium' ? 'text-amber-400' :
                                    'text-sky-400'
                                  }>●</span>
                                  {c.text}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {/* Cues */}
                      {session.analysisData.cues.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {session.analysisData.cues.map((cue, i) => (
                            <span key={i} className="text-xs font-mono text-foreground bg-surface border border-[var(--border-color)] px-2 py-0.5 rounded-lg">
                              {cue}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Next Steps */}
                      {session.analysisData.nextSteps.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">Próximos Pasos</p>
                          <ol className="space-y-1">
                            {session.analysisData.nextSteps.map((step, i) => (
                              <li key={i} className="text-xs text-foreground flex gap-2">
                                <span className="font-mono text-[var(--muted)]">{i + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Frames */}
                      {session.framesData.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-[var(--muted)] uppercase mb-2">
                            Frames ({session.framesData.length})
                          </p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                            {session.framesData.slice(0, 8).map((frame, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={frame}
                                alt={`Frame ${i + 1}`}
                                className="flex-shrink-0 rounded-lg border border-[var(--border-color)] object-cover"
                                style={{ width: 72, height: 54 }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
