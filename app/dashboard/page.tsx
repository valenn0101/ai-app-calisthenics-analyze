'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center">
        <span className="text-gray-700 font-mono text-xs animate-pulse">Cargando...</span>
      </main>
    );
  }

  if (!data) return null;

  const { displayName, routine, currentWeek, nextDay, completedDays } = data;
  const totalWeeks = routine ? routine.weekCount + (routine.hasDeload ? 1 : 0) : 0;
  const isDeload = routine?.hasDeload && currentWeek === totalWeeks;

  return (
    <main className="min-h-screen bg-[#0C0C10] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Greeting */}
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">
            {greeting()}
          </p>
          <h1 className="text-2xl font-light text-white">
            Hola, <span className="text-white font-normal">{displayName}</span>
          </h1>
          <p className="text-sm text-gray-500">¿Cómo estás hoy?</p>
        </div>

        {/* Training context */}
        {routine && currentWeek ? (
          <div className="space-y-3">

            {/* Week card */}
            <div className={`rounded-2xl border px-5 py-4 space-y-0.5 ${
              isDeload
                ? 'border-sky-500/20 bg-sky-500/[0.04]'
                : 'border-white/[0.07] bg-white/[0.02]'
            }`}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                {routine.name}
              </p>
              <p className={`text-lg font-light ${isDeload ? 'text-sky-300' : 'text-white'}`}>
                {isDeload ? 'Semana de descarga' : `Semana ${currentWeek} de ${routine.weekCount}`}
              </p>
              <p className="text-[11px] font-mono text-gray-600">
                {completedDays} de {routine.days.length} días completados esta semana
              </p>
            </div>

            {/* Next day */}
            {nextDay ? (
              <Link
                href={`/training/${routine.id}?week=${currentWeek}`}
                className="block rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4 hover:bg-emerald-500/[0.07] transition-colors group"
              >
                <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-600">
                  Próximo entrenamiento
                </p>
                <p className="text-base text-white mt-0.5 group-hover:text-emerald-200 transition-colors">
                  {nextDay.dayName}
                  {nextDay.title ? <span className="text-gray-500"> · {nextDay.title}</span> : null}
                </p>
                <p className="text-[10px] font-mono text-gray-700 mt-1">
                  {nextDay.blocks.length} bloque{nextDay.blocks.length !== 1 ? 's' : ''} ·{' '}
                  {nextDay.blocks.reduce((n, b) => n + b.exercises.length, 0)} ejercicios
                </p>
              </Link>
            ) : (
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                  Semana completada
                </p>
                <p className="text-sm text-gray-400 mt-0.5">Todos los días registrados. Buen trabajo.</p>
              </div>
            )}

          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-1">
              Sin rutina activa
            </p>
            <Link href="/training/new" className="text-sm text-white hover:text-gray-300 transition-colors">
              Crear una rutina →
            </Link>
          </div>
        )}

        {/* Nav links */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Link href="/" className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center hover:bg-white/[0.05] transition-colors">
            <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Análisis</p>
          </Link>
          <Link href="/training" className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center hover:bg-white/[0.05] transition-colors">
            <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Rutinas</p>
          </Link>
          <Link href="/history" className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center hover:bg-white/[0.05] transition-colors">
            <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">Historial</p>
          </Link>
        </div>

      </div>
    </main>
  );
}
