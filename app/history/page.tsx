'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProgressChart from '@/components/ProgressChart';
import { SessionRecord, Exercise } from '@/lib/storage';

const EXERCISES: { value: Exercise; label: string }[] = [
  { value: 'muscle_up', label: 'Muscle Up' },
  { value: 'pull_up', label: 'Pull Up' },
  { value: 'push_up', label: 'Push Up' },
  { value: 'dip', label: 'Dip' },
  { value: 'planche', label: 'Planche' },
  { value: 'l_sit', label: 'L-Sit' },
];

export default function HistoryPage() {
  const [selectedExercise, setSelectedExercise] = useState<Exercise | 'all'>('all');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [chartSessions, setChartSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSessions(); }, [selectedExercise]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const url = selectedExercise === 'all'
        ? '/api/history'
        : `/api/history?exercise=${selectedExercise}`;
      const res = await fetch(url);
      const data = await res.json();
      setSessions(data.sessions || []);

      // For chart: sort chronologically
      const sorted = [...(data.sessions || [])].sort(
        (a: SessionRecord, b: SessionRecord) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setChartSessions(sorted);
    } catch {
      setSessions([]);
      setChartSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const exerciseLabel = (ex: Exercise) =>
    EXERCISES.find(e => e.value === ex)?.label || ex;

  const avgScore = sessions.length > 0
    ? (sessions.reduce((s, r) => s + r.score, 0) / sessions.length).toFixed(1)
    : null;

  const bestScore = sessions.length > 0
    ? Math.max(...sessions.map(s => s.score))
    : null;

  const latestSession = sessions.length > 0 ? sessions[0] : null;

  return (
    <main className="min-h-screen bg-[#060609] text-white">
      <header className="border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono font-bold text-white tracking-tight">
              Form<span className="text-violet-500">Check</span>
              <span className="text-gray-500 font-normal ml-2">/ Historial</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">progresión de técnica</p>
          </div>
          <Link
            href="/"
            className="text-xs font-mono text-gray-400 hover:text-violet-400 border border-gray-700 hover:border-violet-500/50 px-3 py-1.5 rounded transition-all"
          >
            ← Analizar
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedExercise('all')}
            className={`text-xs font-mono py-1.5 px-3 rounded border transition-all ${
              selectedExercise === 'all'
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            Todos
          </button>
          {EXERCISES.map(ex => (
            <button
              key={ex.value}
              onClick={() => setSelectedExercise(ex.value)}
              className={`text-xs font-mono py-1.5 px-3 rounded border transition-all ${
                selectedExercise === ex.value
                  ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-gray-500 font-mono py-16 animate-pulse">
            Cargando historial...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-600 font-mono text-sm mb-4">
              No hay sesiones registradas
            </div>
            <Link
              href="/"
              className="text-xs font-mono text-violet-400 border border-violet-500/30 px-4 py-2 rounded hover:bg-violet-500/10 transition-all"
            >
              Comenzar análisis →
            </Link>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-mono font-bold text-violet-400">{sessions.length}</div>
                <div className="text-xs text-gray-500 font-mono uppercase mt-1">Sesiones</div>
              </div>
              <div className="border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-mono font-bold text-blue-400">{avgScore}</div>
                <div className="text-xs text-gray-500 font-mono uppercase mt-1">Score Prom.</div>
              </div>
              <div className="border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-mono font-bold text-green-400">{bestScore}</div>
                <div className="text-xs text-gray-500 font-mono uppercase mt-1">Mejor</div>
              </div>
            </div>

            {/* Progress Chart */}
            {selectedExercise !== 'all' && chartSessions.length > 0 && (
              <div className="border border-gray-800 rounded-lg p-4">
                <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-4">
                  Progresión — {exerciseLabel(selectedExercise as Exercise)}
                </h2>
                <ProgressChart
                  sessions={chartSessions}
                  exercise={exerciseLabel(selectedExercise as Exercise)}
                />
              </div>
            )}

            {/* Latest comparison */}
            {latestSession && latestSession.previousScore !== undefined && (
              <div className={`border rounded-lg p-4 ${
                (latestSession.improvement ?? 0) >= 0
                  ? 'border-green-500/20 bg-green-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              }`}>
                <div className="text-xs font-mono text-gray-400 uppercase mb-2">Última sesión vs anterior</div>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-mono font-bold">
                    {latestSession.previousScore} → {latestSession.score}
                  </div>
                  <div className={`text-lg font-mono ${(latestSession.improvement ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(latestSession.improvement ?? 0) > 0 ? '+' : ''}{latestSession.improvement?.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">{exerciseLabel(latestSession.exercise)}</div>
                </div>
              </div>
            )}

            {/* Session List */}
            <div className="space-y-2">
              <h2 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                Sesiones ({sessions.length})
              </h2>
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="border border-gray-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-900/50 transition-all text-left"
                  >
                    <div className={`text-xl font-mono font-bold w-10 text-center ${
                      session.score >= 8 ? 'text-green-400' :
                      session.score >= 6 ? 'text-yellow-400' :
                      session.score >= 4 ? 'text-orange-400' :
                      'text-red-400'
                    }`}>
                      {session.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">
                        {exerciseLabel(session.exercise)}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {new Date(session.date).toLocaleString('es')} · {session.analysisData.phase}
                      </div>
                    </div>
                    {session.improvement !== undefined && (
                      <div className={`text-xs font-mono flex-shrink-0 ${
                        session.improvement > 0 ? 'text-green-400' :
                        session.improvement < 0 ? 'text-red-400' :
                        'text-gray-500'
                      }`}>
                        {session.improvement > 0 ? '+' : ''}{session.improvement.toFixed(1)}
                      </div>
                    )}
                    <div className="text-gray-600 text-xs flex-shrink-0">
                      {expandedSession === session.id ? '▲' : '▼'}
                    </div>
                  </button>

                  {expandedSession === session.id && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                      {/* Corrections summary */}
                      {session.analysisData.corrections.length > 0 && (
                        <div>
                          <div className="text-xs font-mono text-gray-500 uppercase mb-2">Correcciones</div>
                          <ul className="space-y-1">
                            {session.analysisData.corrections
                              .sort((a, b) => {
                                const order = { high: 0, medium: 1, low: 2 };
                                return order[a.priority] - order[b.priority];
                              })
                              .map((c, i) => (
                                <li key={i} className="text-xs text-gray-300 flex gap-2">
                                  <span className={
                                    c.priority === 'high' ? 'text-red-400' :
                                    c.priority === 'medium' ? 'text-yellow-400' :
                                    'text-green-400'
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
                            <span key={i} className="text-xs font-mono text-violet-300 bg-violet-900/20 border border-violet-500/20 px-2 py-0.5 rounded">
                              {cue}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Next Steps */}
                      {session.analysisData.nextSteps.length > 0 && (
                        <div>
                          <div className="text-xs font-mono text-gray-500 uppercase mb-2">Próximos Pasos</div>
                          <ol className="space-y-1">
                            {session.analysisData.nextSteps.map((step, i) => (
                              <li key={i} className="text-xs text-gray-400 flex gap-2">
                                <span className="font-mono text-gray-600">{i + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Frames */}
                      {session.framesData.length > 0 && (
                        <div>
                          <div className="text-xs font-mono text-gray-500 uppercase mb-2">
                            Frames ({session.framesData.length})
                          </div>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {session.framesData.slice(0, 8).map((frame, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={frame}
                                alt={`Frame ${i + 1}`}
                                className="flex-shrink-0 rounded border border-gray-700 object-cover"
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
      </div>
    </main>
  );
}
