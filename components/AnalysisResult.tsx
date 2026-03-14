'use client';

import { useState } from 'react';
import { AnalysisResult as AnalysisResultType, VerificationResult } from '@/lib/storage';

interface AnalysisResultProps {
  data: AnalysisResultType;
  exercise: string;
  timeRefFrames?: Map<number, string>;
  verificationResult?: VerificationResult | null;
  improvement?: number;
  previousScore?: number;
  onVerify?: () => void;
  verifyState?: 'idle' | 'verifying' | 'done' | 'error';
  verifyError?: string;
  correctionsWithFrameCount?: number;
}

const scoreColor = (s: number) =>
  s >= 8 ? 'text-emerald-500' : s >= 6 ? 'text-amber-400' : s >= 4 ? 'text-orange-400' : 'text-rose-400';

const scoreBg = (s: number) =>
  s >= 8 ? 'bg-emerald-500' : s >= 6 ? 'bg-amber-400' : s >= 4 ? 'bg-orange-400' : 'bg-rose-400';

const priorityConfig: Record<string, { border: string; dot: string; badge: string; label: string }> = {
  high:   { border: 'border-l-rose-500/60',  dot: 'bg-rose-500',  badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',  label: 'CRÍTICO' },
  medium: { border: 'border-l-amber-500/60', dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'MEDIA' },
  low:    { border: 'border-l-sky-500/60',   dot: 'bg-sky-500',   badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',    label: 'BAJA' },
};

function FrameThumb({ frame, timeRef }: { frame: string; timeRef: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="block rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-zinc-400 active:scale-95 transition-all group"
        title={`@ ${timeRef}s — ampliar`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame} alt={`@ ${timeRef}s`} className="object-cover" style={{ width: 96, height: 60 }} />
        <div className="bg-black/60 text-center py-0.5 group-hover:bg-black/80 transition-colors">
          <span className="text-[9px] font-mono text-zinc-400">@{timeRef}s</span>
        </div>
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame} alt={`@ ${timeRef}s`} className="w-full rounded-xl" />
            <div className="absolute inset-0 flex items-end p-3 pointer-events-none">
              <span className="text-xs font-mono text-white/70 bg-black/60 px-2 py-1 rounded-md">@{timeRef}s</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/70 hover:bg-black text-white rounded-full text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AnalysisResult({
  data,
  exercise,
  timeRefFrames = new Map(),
  verificationResult,
  improvement,
  previousScore,
  onVerify,
  verifyState = 'idle',
  verifyError,
  correctionsWithFrameCount = 0,
}: AnalysisResultProps) {
  const sc = scoreColor(data.score);
  const sb = scoreBg(data.score);

  const verifyMap = new Map(
    verificationResult?.verifications.map(v => [v.timeRef, v]) ?? []
  );

  const sortedCorrections = [...data.corrections].sort(
    (a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])
  );

  return (
    <div className="space-y-6">

      {/* ── Score ── */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-shrink-0">
            <div className={`text-6xl font-light tracking-tighter leading-none ${sc}`}>
              {data.score}
            </div>
            <div className="text-xs text-[var(--muted)] font-mono mt-0.5">/ 10</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-1">{exercise}</p>
            <p className="text-base text-foreground leading-snug font-medium">{data.phase}</p>
            {improvement !== undefined && previousScore !== undefined && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-mono ${
                improvement > 0 ? 'text-emerald-500' : improvement < 0 ? 'text-rose-400' : 'text-[var(--muted)]'
              }`}>
                <span>{improvement > 0 ? '↑' : improvement < 0 ? '↓' : '—'}</span>
                <span>{Math.abs(improvement).toFixed(1)} pts vs anterior</span>
                <span className="text-[var(--muted)]">({previousScore}/10)</span>
              </div>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${sb}`}
            style={{ width: `${data.score * 10}%` }}
          />
        </div>
      </div>

      {/* ── Positives ── */}
      {data.positives.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3.5 bg-emerald-500/60 rounded-full" />
            <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Positivos</h3>
          </div>
          <ul className="space-y-2">
            {data.positives.map((p, i) => {
              const frame = p.timeRef != null ? timeRefFrames.get(p.timeRef) : undefined;
              return (
                <li key={i} className="bg-emerald-500/[0.04] rounded-lg px-3 py-2 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 text-xs mt-0.5 flex-shrink-0 font-bold">✓</span>
                    <span className="text-sm text-foreground leading-snug">{p.text}</span>
                    {p.timeRef != null && (
                      <span className="text-[9px] font-mono text-[var(--muted)] flex-shrink-0 mt-0.5">@{p.timeRef}s</span>
                    )}
                  </div>
                  {frame && p.timeRef != null && (
                    <div className="pl-4">
                      <FrameThumb frame={frame} timeRef={p.timeRef} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Corrections ── */}
      {data.corrections.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3.5 bg-rose-500/60 rounded-full" />
            <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Correcciones</h3>
          </div>
          <ul className="space-y-2">
            {sortedCorrections.map((c, i) => {
              const frame = c.timeRef != null ? timeRefFrames.get(c.timeRef) : undefined;
              const verification = c.timeRef != null ? verifyMap.get(c.timeRef) : undefined;
              const config = priorityConfig[c.priority] ?? priorityConfig.low;
              return (
                <li
                  key={i}
                  className={`border-l-2 pl-3 py-2 space-y-2 ${config.border}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 text-xs mt-0.5 flex-shrink-0 font-bold">✕</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${config.badge}`}>
                          {config.label}
                        </span>
                        {c.timeRef != null && (
                          <span className="text-[9px] font-mono text-[var(--muted)]">@{c.timeRef}s</span>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-snug">{c.text}</p>
                    </div>
                  </div>

                  {frame && c.timeRef != null && (
                    <FrameThumb frame={frame} timeRef={c.timeRef} />
                  )}

                  {verification && (
                    <div className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 text-[10px] font-mono rounded-lg px-2 py-1.5 border ${
                      verification.confirmed
                        ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-500'
                        : 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400'
                    }`}>
                      <span className="font-medium">
                        {verification.confirmed ? '✓ Confirmado' : '↻ Revisado'}
                      </span>
                      <span className="text-[var(--muted)]">·</span>
                      <span className="text-[var(--muted)]">confianza {verification.confidence}</span>
                      {verification.revisedTimeRef != null && (
                        <>
                          <span className="text-[var(--muted)]">·</span>
                          <span>→ @{verification.revisedTimeRef}s</span>
                        </>
                      )}
                      <div className="w-full text-[var(--muted)] mt-0.5 leading-relaxed">
                        {verification.observation}
                      </div>
                      {!verification.confirmed && verification.revisedCorrection && (
                        <div className="w-full text-foreground leading-relaxed">
                          → {verification.revisedCorrection}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Verification summary ── */}
      {verificationResult && (
        <div className="flex items-start gap-4 border border-[var(--border-color)] rounded-xl p-4">
          <div className="text-center flex-shrink-0">
            <div className={`text-3xl font-light tabular-nums ${
              verificationResult.accuracy >= 80 ? 'text-emerald-500' :
              verificationResult.accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'
            }`}>{verificationResult.accuracy}%</div>
            <div className="text-[9px] font-mono text-[var(--muted)] mt-0.5 uppercase tracking-wider">Precisión</div>
          </div>
          <div className="border-l border-[var(--border-color)] pl-4 flex-1">
            <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mb-1">Verificación</p>
            <p className="text-xs text-foreground leading-relaxed">{verificationResult.summary}</p>
          </div>
        </div>
      )}

      {/* ── Verify button ── */}
      {onVerify && correctionsWithFrameCount > 0 && verifyState !== 'done' && (
        <div>
          <button
            onClick={onVerify}
            disabled={verifyState === 'verifying'}
            className={`w-full py-2.5 rounded-xl text-xs font-mono border transition-all ${
              verifyState === 'verifying'
                ? 'border-[var(--border-color)] text-[var(--muted)] cursor-not-allowed'
                : 'border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-500/[0.04]'
            }`}
          >
            {verifyState === 'verifying' ? (
              <span className="animate-pulse">Verificando frames con Gemini...</span>
            ) : (
              `✦ Verificar ${correctionsWithFrameCount} correcciones con IA`
            )}
          </button>
          {verifyState === 'error' && verifyError && (
            <p className="text-xs text-rose-400 font-mono mt-2 text-center">{verifyError}</p>
          )}
        </div>
      )}

      {/* ── Cues ── */}
      {data.cues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3.5 bg-indigo-500/60 rounded-full" />
            <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Cues Técnicos</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.cues.map((cue, i) => (
              <span
                key={i}
                className="text-xs font-mono text-foreground bg-surface border border-[var(--border-color)] px-2.5 py-1 rounded-lg"
              >
                {cue}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Next steps ── */}
      {data.nextSteps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3.5 bg-zinc-500/60 rounded-full" />
            <h3 className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest">Próximos Pasos</h3>
          </div>
          <ol className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground leading-snug">
                <span className="font-mono text-[var(--muted)] flex-shrink-0 w-4 text-right">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
