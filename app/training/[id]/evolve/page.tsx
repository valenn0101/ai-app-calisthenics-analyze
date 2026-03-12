'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Routine } from '@/lib/training-types';

export default function EvolvePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [goals, setGoals] = useState('');
  const [period, setPeriod] = useState('');
  const [weekCount, setWeekCount] = useState(4);
  const [hasDeload, setHasDeload] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => {
    fetch(`/api/training/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.routine) {
          setRoutine(d.routine);
          setWeekCount(d.routine.weekCount);
          setHasDeload(d.routine.hasDeload);
          // Default start date: 1st of next month
          const next = new Date();
          next.setMonth(next.getMonth() + 1, 1);
          setStartDate(next.toISOString().split('T')[0]);
          setPeriod(next.toLocaleDateString('es', { month: 'long', year: 'numeric' }));
        }
      });
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError('');
    setGeneratedText('');
    try {
      const res = await fetch('/api/training/evolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId: id, goals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setGeneratedText(data.text);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error al generar');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generatedText.trim()) return;
    setSaving(true);
    try {
      // Parse the generated text
      const parseRes = await fetch('/api/training/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: generatedText }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || 'Error al analizar');

      // Save as new routine
      const saveRes = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: period.trim() || `Rutina evolucionada`,
          weekCount,
          hasDeload,
          deloadPercentage: 50,
          days: parseData.days,
          oneRMs: routine?.oneRMs ?? {},  // carry over 1RMs from previous routine
          startDate,
          rawText: generatedText,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Error al guardar');

      router.push(`/training/${saveData.routine.id}`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error al guardar');
      setSaving(false);
    }
  }

  if (!routine) return (
    <main className="min-h-screen bg-[#0C0C10] flex items-center justify-center">
      <span className="text-gray-600 text-xs font-mono animate-pulse">Cargando...</span>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link href={`/training/${id}`} className="text-[11px] font-mono text-gray-600 hover:text-white border border-white/[0.07] px-3 py-1.5 rounded-lg transition-all">
            ← Volver
          </Link>
          <div>
            <div className="text-sm font-light tracking-widest">Evolucionar rutina</div>
            <div className="text-[10px] text-gray-600 font-mono">Basada en: {routine.name}</div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-4">

        {/* Goals input */}
        <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5 space-y-3">
          <div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Objetivos para el próximo mes</div>
            <p className="text-xs text-gray-600 mt-1">
              Indicá qué querés lograr o mejorar. Gemini los incorporará en la rutina generada.
            </p>
          </div>
          <textarea
            value={goals}
            onChange={e => setGoals(e.target.value)}
            placeholder="Ej: Quiero lograr el Muscle Up limpio sin cajón al menos 1 vez. También aumentar el press plano a 120kg. Mantener la frecuencia de 3 días/semana..."
            rows={4}
            className="w-full bg-white/[0.02] border border-white/[0.07] focus:border-white/[0.15] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none resize-none leading-relaxed"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-30 transition-all"
          >
            {generating ? (
              <span className="font-mono text-xs text-gray-500 animate-pulse">Generando con Gemini...</span>
            ) : 'Generar rutina evolucionada'}
          </button>
          {genError && <p className="text-xs text-red-400 font-mono">{genError}</p>}
        </div>

        {/* Generated text (editable) */}
        {generatedText && (
          <>
            <div className="border border-emerald-500/20 rounded-2xl bg-[#111116] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Rutina generada · podés editarla</div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-[10px] font-mono text-gray-600 hover:text-white transition-colors disabled:opacity-40"
                >
                  Regenerar
                </button>
              </div>
              <textarea
                value={generatedText}
                onChange={e => setGeneratedText(e.target.value)}
                rows={20}
                className="w-full bg-white/[0.02] border border-white/[0.06] focus:border-white/[0.14] rounded-xl px-4 py-3 text-sm text-gray-200 outline-none resize-y font-mono leading-relaxed"
              />
            </div>

            {/* Config for new routine */}
            <div className="border border-white/[0.07] rounded-2xl bg-[#111116] p-5 space-y-4">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Configuración de la nueva rutina</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Período</label>
                  <input
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    placeholder="Ej: Mayo 2026"
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-700 outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-2.5 text-sm text-white outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-600">Semanas</label>
                  <div className="flex gap-1">
                    {[3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => setWeekCount(n)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-mono border transition-all ${weekCount === n ? 'bg-white text-black border-white' : 'border-white/[0.08] text-gray-400'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-300">Semana de descarga</div>
                  <div className="text-[10px] font-mono text-gray-600">50% de carga</div>
                </div>
                <button
                  onClick={() => setHasDeload(!hasDeload)}
                  style={{ width: 40, height: 22 }}
                  className={`rounded-full border relative transition-all flex-shrink-0 ${hasDeload ? 'bg-white border-white' : 'bg-transparent border-white/[0.20]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${hasDeload ? 'right-0.5 bg-black' : 'left-0.5 bg-gray-500'}`} />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-100 disabled:opacity-30 transition-all"
              >
                {saving ? <span className="font-mono text-xs text-gray-500 animate-pulse">Guardando...</span> : 'Guardar como nueva rutina'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
