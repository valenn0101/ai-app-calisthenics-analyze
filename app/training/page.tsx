'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Routine } from '@/lib/training-types';

function weekLabel(routineId: string, startDate: string, weekCount: number, hasDeload: boolean): string {
  const start = new Date(startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(Math.floor(diffDays / 7) + 1, weekCount + (hasDeload ? 1 : 0));
  if (currentWeek <= weekCount) return `Semana ${currentWeek} de ${weekCount}`;
  if (hasDeload) return 'Semana de descarga';
  return `${weekCount} semanas completas`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function TrainingPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/training')
      .then(r => r.json())
      .then(d => setRoutines(d.routines ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta rutina y todos sus registros?')) return;
    setDeleting(id);
    await fetch(`/api/training/${id}`, { method: 'DELETE' });
    setRoutines(prev => prev.filter(r => r.id !== id));
    setDeleting(null);
  };

  const totalWeeks = (r: Routine) => r.weekCount + (r.hasDeload ? 1 : 0);

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.18] px-3 py-1.5 rounded-lg transition-all">
              ← Inicio
            </Link>
            <div>
              <div className="text-sm font-light tracking-widest text-white">
                FORM<span className="text-gray-400">CHECK</span>
              </div>
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

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-4">
        {loading && (
          <p className="text-center py-20 text-gray-600 text-xs font-mono animate-pulse">
            Cargando rutinas...
          </p>
        )}

        {!loading && routines.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <div className="text-5xl text-gray-700">🏋️</div>
            <p className="text-gray-400 text-sm">Sin rutinas creadas</p>
            <p className="text-gray-700 text-xs font-mono max-w-xs mx-auto">
              Pega tu rutina semanal y Gemini la estructura automáticamente
            </p>
            <Link
              href="/training/new"
              className="inline-block mt-3 bg-white text-black text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-all"
            >
              Crear primera rutina
            </Link>
          </div>
        )}

        {routines.map(r => (
          <div
            key={r.id}
            className="border border-white/[0.07] rounded-2xl bg-[#111116] overflow-hidden"
          >
            <div className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-0.5">
                  {r.days.length} días · {totalWeeks(r)} semanas{r.hasDeload ? ' + descarga' : ''}
                </div>
                <h2 className="text-base text-white font-light">{r.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-gray-600">
                    Desde {formatDate(r.startDate)}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {weekLabel(r.id, r.startDate, r.weekCount, r.hasDeload)}
                  </span>
                </div>
                {/* Exercises quick list */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(new Set(
                    r.days.flatMap(d => d.blocks.flatMap(b => b.exercises.map(e => e.name)))
                  )).slice(0, 6).map(name => (
                    <span key={name} className="text-[9px] font-mono text-gray-600 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded-md">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/training/${r.id}`}
                  className="text-[11px] font-mono text-white bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.09] px-3 py-1.5 rounded-lg transition-all"
                >
                  Ver →
                </Link>
                <button
                  onClick={() => handleDelete(r.id)}
                  disabled={deleting === r.id}
                  className="text-[11px] font-mono text-gray-700 hover:text-red-400 border border-white/[0.06] px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                >
                  {deleting === r.id ? '...' : '✕'}
                </button>
              </div>
            </div>

            {/* Day pills */}
            <div className="border-t border-white/[0.05] px-5 py-3 flex gap-2 overflow-x-auto">
              {r.days.map(day => (
                <div key={day.id} className="flex-shrink-0">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                    {day.dayName}
                  </span>
                  <div className="text-[9px] text-gray-700 truncate max-w-[100px]">{day.title}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
