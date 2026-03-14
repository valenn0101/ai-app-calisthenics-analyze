'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import type { Routine, RoutineDay } from '@/lib/training-types';

interface DashboardData {
  displayName: string;
  routine: Routine | null;
  currentWeek: number | null;
  nextDay: RoutineDay | null;
  completedDays: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function weekProgress(startDate: string, weekCount: number) {
  const start = new Date(startDate);
  const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  return Math.min(Math.max(diff + 1, 1), weekCount);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => {
        if (r.status === 401) { router.replace('/login'); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <div className="flex items-center justify-center h-[60vh]">
          <span className="text-[var(--muted)] font-mono text-xs animate-pulse">Cargando...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { displayName, routine, currentWeek, nextDay, completedDays } = data;
  const totalWeeks = routine ? routine.weekCount + (routine.hasDeload ? 1 : 0) : 0;
  const isDeload = routine?.hasDeload && currentWeek === totalWeeks;
  const currentW = routine && currentWeek ? weekProgress(routine.startDate, routine.weekCount) : 0;
  const progressPct = routine ? Math.round(currentW / routine.weekCount * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-2xl mx-auto px-5 py-8 space-y-6">

        {/* ── Saludo ──────────────────────────────────────────── */}
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">
            {greeting()}
          </p>
          <h1 className="text-3xl font-light text-foreground">
            Hola, <span className="font-medium">{displayName}</span>
          </h1>
        </div>

        {/* ── Próximo entrenamiento (tarjeta prominente) ───────── */}
        {routine && currentWeek ? (
          <>
            {nextDay ? (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/[0.05] p-6 space-y-4">
                <div>
                  <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">
                    Próximo entrenamiento
                  </p>
                  <h2 className="text-xl font-medium text-foreground mt-1">
                    {nextDay.dayName}
                    {nextDay.title && <span className="text-[var(--muted)] font-normal"> · {nextDay.title}</span>}
                  </h2>
                  <p className="text-xs font-mono text-[var(--muted)] mt-1">
                    {nextDay.blocks.length} bloque{nextDay.blocks.length !== 1 ? 's' : ''} ·{' '}
                    {nextDay.blocks.reduce((n, b) => n + b.exercises.length, 0)} ejercicios
                  </p>
                </div>
                <Link
                  href={`/training/${routine.id}?week=${currentWeek}`}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors"
                >
                  Iniciar sesión →
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-color)] bg-surface p-6">
                <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Semana completada</p>
                <p className="text-sm text-[var(--muted)] mt-1">Todos los días registrados. Buen trabajo.</p>
              </div>
            )}

            {/* Progreso del mesociclo */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">{routine.name}</p>
                  <p className={`text-base font-medium mt-0.5 ${isDeload ? 'text-sky-400' : 'text-foreground'}`}>
                    {isDeload ? 'Semana de descarga' : `Semana ${currentW} de ${routine.weekCount}`}
                  </p>
                </div>
                <span className="text-2xl font-mono font-light text-emerald-500">{progressPct}%</span>
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono text-[var(--muted)]">
                  {completedDays} de {routine.days.length} días completados esta semana
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-8 text-center space-y-3">
            <p className="text-sm text-[var(--muted)]">Sin rutina activa</p>
            <Link
              href="/training/new"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors"
            >
              Crear primera rutina
            </Link>
          </div>
        )}

        {/* ── Accesos rápidos ──────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/" className="rounded-xl border border-[var(--border-color)] bg-surface hover:bg-surface-2 p-4 text-center transition-colors group">
            <p className="text-lg mb-1">◎</p>
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest group-hover:text-foreground transition-colors">Análisis</p>
          </Link>
          <Link href="/training" className="rounded-xl border border-[var(--border-color)] bg-surface hover:bg-surface-2 p-4 text-center transition-colors group">
            <p className="text-lg mb-1">◫</p>
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest group-hover:text-foreground transition-colors">Rutinas</p>
          </Link>
          <Link href="/history" className="rounded-xl border border-[var(--border-color)] bg-surface hover:bg-surface-2 p-4 text-center transition-colors group">
            <p className="text-lg mb-1">▤</p>
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest group-hover:text-foreground transition-colors">Historial</p>
          </Link>
        </div>

      </main>
    </div>
  );
}
