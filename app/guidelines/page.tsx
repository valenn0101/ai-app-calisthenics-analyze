'use client';

import NavBar from '@/components/NavBar';

function Swatch({ bg, label, desc }: { bg: string; label: string; desc: string }) {
  return (
    <div className="space-y-2">
      <div className={`h-12 rounded-xl ${bg}`} />
      <div>
        <p className="text-[11px] font-mono text-foreground">{label}</p>
        <p className="text-[10px] text-[var(--muted)]">{desc}</p>
      </div>
    </div>
  );
}

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-12">

        {/* ── Title ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Sistema de Diseño</p>
          <h1 className="text-3xl font-light text-foreground">Guidelines</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed max-w-xl">
            Documentación del sistema visual de FormCheck. Filosofía: <strong className="text-foreground">&ldquo;Moderno Atlético&rdquo;</strong> — minimalista, preciso, donde los datos son los protagonistas.
          </p>
        </div>

        {/* ── Filosofía ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Identidad y Filosofía
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: 'Minimalismo', desc: 'Sin ornamentación excesiva. Cada elemento tiene un propósito funcional.' },
              { title: 'Datos primero', desc: 'Kilos, repeticiones, segundos, puntuaciones. Son los protagonistas reales.' },
              { title: 'Contexto con color', desc: 'No usamos color para decorar, sino para comunicar estado y significado.' },
            ].map(item => (
              <div key={item.title} className="border border-[var(--border-color)] rounded-xl bg-surface p-4">
                <p className="text-sm font-medium text-foreground mb-1">{item.title}</p>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Modos ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Modos de Color
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-zinc-700 rounded-2xl bg-zinc-950 p-5 space-y-2">
              <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Premium Dark Mode</p>
              <p className="text-xl font-medium text-zinc-50">Zinc 950/900</p>
              <p className="text-xs text-zinc-400">Profundo y elegante. Para sesiones nocturnas en el gimnasio.</p>
            </div>
            <div className="border border-zinc-200 rounded-2xl bg-zinc-50 p-5 space-y-2">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Modo Día</p>
              <p className="text-xl font-medium text-zinc-900">Zinc 50/100</p>
              <p className="text-xs text-zinc-500">Claro y contrastado. Para análisis en escritorio.</p>
            </div>
          </div>
          <p className="text-[10px] font-mono text-[var(--muted)]">
            Usa el ☀/☾ en la barra de navegación para cambiar de modo. La preferencia se guarda localmente.
          </p>
        </section>

        {/* ── Tipografía ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Tipografía
          </h2>
          <div className="space-y-4">
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5 space-y-2">
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Inter — Sans-serif</p>
              <p className="text-3xl font-light text-foreground">Títulos y texto general</p>
              <p className="text-base text-foreground">Para encabezados, párrafos y la mayoría del contenido. Limpia y legible.</p>
              <p className="text-sm text-[var(--muted)]">font-light / font-normal / font-medium — según jerarquía</p>
            </div>
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-5 space-y-2">
              <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Geist Mono — Monoespaciada</p>
              <p className="text-3xl font-mono font-light text-foreground">BLOQUE 1 · 87.5kg · 8.4/10</p>
              <p className="text-sm font-mono text-[var(--muted)]">Para etiquetas técnicas, métricas numéricas y datos de entrenamiento</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['BLOQUE POTENCIA', 'SEM 3 DE 6', '@ 2.4s', '12 reps'].map(ex => (
                  <span key={ex} className="text-[10px] font-mono bg-surface-2 border border-[var(--border-color)] px-2 py-1 rounded-lg text-foreground">
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Paleta ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Paleta de Colores Semántica
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-zinc-800 border border-zinc-700" />
              <p className="text-[11px] font-mono text-foreground">Zinc</p>
              <p className="text-[10px] text-[var(--muted)]">Estructura. Fondos, bordes, textos neutros.</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-emerald-500" />
              <p className="text-[11px] font-mono text-foreground">Esmeralda</p>
              <p className="text-[10px] text-[var(--muted)]">Éxito, progreso, acciones primarias, series completadas.</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-indigo-500" />
              <p className="text-[11px] font-mono text-foreground">Índigo</p>
              <p className="text-[10px] text-[var(--muted)]">Inteligencia. Coach IA, análisis, bloques de Potencia.</p>
            </div>
            <div className="space-y-2">
              <div className="h-12 rounded-xl bg-rose-500" />
              <p className="text-[11px] font-mono text-foreground">Rosa/Rojo</p>
              <p className="text-[10px] text-[var(--muted)]">Alertas, correcciones críticas, bloques de Fuerza Máxima.</p>
            </div>
          </div>

          {/* Secondary */}
          <div className="grid grid-cols-3 gap-3">
            <Swatch bg="bg-sky-500/20 border border-sky-500/30" label="Sky" desc="Descarga, prioridad baja" />
            <Swatch bg="bg-amber-500/20 border border-amber-500/30" label="Amber" desc="Prioridad media, advertencias" />
            <Swatch bg="bg-emerald-500/[0.06] border border-emerald-500/20" label="Esmeralda suave" desc="Fondo de series completadas" />
          </div>
        </section>

        {/* ── Componentes por vista ── */}
        <section className="space-y-6">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Componentes por Vista
          </h2>

          {/* Dashboard */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--muted)] uppercase">1. Dashboard — Centro de mando</p>
            <div className="border-2 border-emerald-500/40 bg-emerald-500/[0.05] rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">Próximo entrenamiento</p>
              <p className="text-lg font-medium text-foreground">Lunes · Empuje + Core</p>
              <p className="text-xs font-mono text-[var(--muted)]">3 bloques · 9 ejercicios</p>
              <div className="inline-flex items-center gap-2 bg-emerald-500 text-white text-sm font-medium rounded-xl px-4 py-2">
                Iniciar sesión →
              </div>
            </div>
            <p className="text-[10px] text-[var(--muted)]">El borde doble esmeralda y el botón lleno invitan a la acción inmediata.</p>
          </div>

          {/* Workout */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--muted)] uppercase">2. Entrenamiento — Serie completada</p>
            <div className="border border-[var(--border-color)] rounded-xl bg-surface p-4 space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <input type="checkbox" checked readOnly className="w-4 h-4 accent-emerald-500" />
                <span className="text-[10px] font-mono text-[var(--muted)] w-5 text-center">1</span>
                <span className="text-sm font-mono text-emerald-400 w-16 text-center">87.5</span>
                <span className="text-xs text-[var(--muted)]">kg</span>
                <span className="text-xs text-[var(--muted)]">×</span>
                <span className="text-sm font-mono text-emerald-400 w-12 text-center">8</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-transparent">
                <input type="checkbox" readOnly className="w-4 h-4 accent-emerald-500" />
                <span className="text-[10px] font-mono text-[var(--muted)] w-5 text-center">2</span>
                <span className="text-sm font-mono text-foreground w-16 text-center border border-[var(--border-color)] bg-surface rounded-lg py-1 text-center">87.5</span>
                <span className="text-xs text-[var(--muted)]">kg × </span>
                <span className="text-sm font-mono text-foreground w-12 text-center border border-[var(--border-color)] bg-surface rounded-lg py-1 text-center">—</span>
              </div>
            </div>
            <p className="text-[10px] text-[var(--muted)]">Al completar una serie, toda la fila se tiñe de esmeralda.</p>
          </div>

          {/* Block types */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--muted)] uppercase">3. Tipos de Bloque</p>
            <div className="space-y-2">
              <div className="border-l-2 border-indigo-500 pl-3 py-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">Bloque A</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">POTENCIA</span>
              </div>
              <div className="border-l-2 border-rose-500 pl-3 py-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-rose-400 uppercase tracking-widest">Bloque B</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-rose-500/10 text-rose-400 border-rose-500/20">FUERZA MÁX.</span>
              </div>
              <div className="border-l-2 border-emerald-500 pl-3 py-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Bloque C</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">HIPERTROFIA</span>
              </div>
            </div>
          </div>

          {/* Analysis */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--muted)] uppercase">4. Análisis — Correcciones con prioridad</p>
            <div className="space-y-2">
              <div className="border-l-2 border-rose-500/60 pl-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 text-xs font-bold">✕</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-rose-500/10 text-rose-400 border-rose-500/20">CRÍTICO</span>
                  <span className="text-[9px] font-mono text-[var(--muted)]">@1.2s</span>
                </div>
                <p className="text-sm text-foreground">Cadera demasiado baja en la fase de transición</p>
              </div>
              <div className="border-l-2 border-amber-500/60 pl-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-rose-400 text-xs font-bold">✕</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">MEDIA</span>
                </div>
                <p className="text-sm text-foreground">Codos ligeramente separados del cuerpo</p>
              </div>
            </div>
          </div>

          {/* Coach IA */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-[var(--muted)] uppercase">5. Coach IA — Mini-tarjeta en chat</p>
            <div className="border border-[var(--border-color)] rounded-2xl bg-surface p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[9px] text-white font-mono">✦</span>
                </div>
                <div className="space-y-2 flex-1">
                  <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider">Coach IA</p>
                  <div className="bg-surface border border-[var(--border-color)] rounded-2xl rounded-tl-sm px-3 py-2.5">
                    <p className="text-sm text-foreground">Te sugiero agregar este bloque de trabajo auxiliar:</p>
                  </div>
                  <div className="bg-indigo-500/[0.08] border border-indigo-500/20 rounded-xl p-3">
                    <p className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest mb-1">Bloque sugerido</p>
                    <p className="text-sm font-medium text-foreground">Ring Dips con pausa</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">Fuerza de empuje + estabilidad escapular</p>
                    <p className="text-xs font-mono text-indigo-300 mt-1">4 × 6 reps @ RPE 8 · pausa 2s arriba</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--muted)]">La IA puede generar tarjetas estructuradas dentro del chat usando el formato <code className="font-mono text-[10px]">---CARD---</code>.</p>
          </div>
        </section>

        {/* ── Espaciado y bordes ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest border-b border-[var(--border-color)] pb-2">
            Tokens de Espaciado y Bordes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { radius: 'rounded-lg', label: 'rounded-lg', desc: 'Chips, badges' },
              { radius: 'rounded-xl', label: 'rounded-xl', desc: 'Inputs, botones' },
              { radius: 'rounded-2xl', label: 'rounded-2xl', desc: 'Tarjetas' },
              { radius: 'rounded-full', label: 'rounded-full', desc: 'Avatares, dots' },
            ].map(item => (
              <div key={item.label} className="text-center space-y-2">
                <div className={`h-10 bg-surface border border-[var(--border-color)] ${item.radius}`} />
                <p className="text-[10px] font-mono text-foreground">{item.label}</p>
                <p className="text-[9px] text-[var(--muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
