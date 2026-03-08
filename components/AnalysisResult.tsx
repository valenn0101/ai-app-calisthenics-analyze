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
  s >= 8 ? 'text-emerald-400' : s >= 6 ? 'text-amber-400' : s >= 4 ? 'text-orange-400' : 'text-red-400';

const scoreBg = (s: number) =>
  s >= 8 ? 'bg-emerald-400' : s >= 6 ? 'bg-amber-400' : s >= 4 ? 'bg-orange-400' : 'bg-red-400';

const priorityDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
};

const priorityBorder: Record<string, string> = {
  high: 'border-l-red-500/50',
  medium: 'border-l-amber-500/50',
  low: 'border-l-sky-500/50',
};

const priorityLabel: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const priorityText: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-sky-400',
};

function FrameThumb({ frame, timeRef }: { frame: string; timeRef: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="block rounded-lg overflow-hidden border border-white/[0.08] hover:border-white/[0.18] active:scale-95 transition-all group"
        title={`@ ${timeRef}s — ampliar`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame} alt={`@ ${timeRef}s`} className="object-cover" style={{ width: 96, height: 60 }} />
        <div className="bg-black/60 text-center py-0.5 group-hover:bg-black/80 transition-colors">
          <span className="text-[9px] font-mono text-gray-400">@{timeRef}s</span>
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
            <div className="absolute inset-0 flex items-end justify-between p-3 pointer-events-none">
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
    <div className="space-y-8">

      {/* ── Score ── */}
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <div className={`text-6xl font-light tracking-tighter leading-none ${sc}`}>
            {data.score}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-1">/ 10</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-1">{exercise}</div>
          <div className="text-base text-gray-200 leading-snug">{data.phase}</div>
          {improvement !== undefined && previousScore !== undefined && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-mono ${
              improvement > 0 ? 'text-emerald-400' : improvement < 0 ? 'text-red-400' : 'text-gray-500'
            }`}>
              <span>{improvement > 0 ? '↑' : improvement < 0 ? '↓' : '—'}</span>
              <span>{Math.abs(improvement).toFixed(1)} pts vs anterior</span>
              <span className="text-gray-600">({previousScore}/10)</span>
            </div>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden -mt-4">
        <div
          className={`h-full rounded-full transition-all duration-700 ${sb}`}
          style={{ width: `${data.score * 10}%` }}
        />
      </div>

      {/* ── 2-col grid: positives + corrections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Positives */}
        {data.positives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-3.5 bg-emerald-500/60 rounded-full" />
              <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Positivos</h3>
            </div>
            <ul className="space-y-3">
              {data.positives.map((p, i) => {
                const frame = p.timeRef != null ? timeRefFrames.get(p.timeRef) : undefined;
                return (
                  <li key={i} className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 text-xs mt-0.5 flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-300 leading-snug">{p.text}</span>
                      {p.timeRef != null && (
                        <span className="text-[9px] font-mono text-gray-600 flex-shrink-0 mt-0.5">@{p.timeRef}s</span>
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

        {/* Corrections */}
        {data.corrections.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-3.5 bg-red-500/60 rounded-full" />
              <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Correcciones</h3>
            </div>
            <ul className="space-y-2">
              {sortedCorrections.map((c, i) => {
                const frame = c.timeRef != null ? timeRefFrames.get(c.timeRef) : undefined;
                const verification = c.timeRef != null ? verifyMap.get(c.timeRef) : undefined;
                return (
                  <li
                    key={i}
                    className={`border-l-2 pl-3 py-2 space-y-2 ${priorityBorder[c.priority]}`}
                  >
                    {/* Priority + text + timeRef */}
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDot[c.priority]}`} />
                        <span className={`text-[9px] font-mono ${priorityText[c.priority]}`}>
                          {priorityLabel[c.priority]}
                        </span>
                      </div>
                      <span className="text-sm text-gray-300 leading-snug flex-1">{c.text}</span>
                      {c.timeRef != null && (
                        <span className="text-[9px] font-mono text-gray-600 flex-shrink-0 mt-0.5">@{c.timeRef}s</span>
                      )}
                    </div>

                    {/* Frame thumbnail */}
                    {frame && c.timeRef != null && (
                      <FrameThumb frame={frame} timeRef={c.timeRef} />
                    )}

                    {/* Verification badge */}
                    {verification && (
                      <div className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 text-[10px] font-mono rounded-md px-2 py-1.5 border ${
                        verification.confirmed
                          ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400'
                          : 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400'
                      }`}>
                        <span className="font-medium">
                          {verification.confirmed ? '✓ Confirmado' : '↻ Revisado'}
                        </span>
                        <span className="text-gray-500">·</span>
                        <span className="text-gray-500">confianza {verification.confidence}</span>
                        {verification.revisedTimeRef != null && (
                          <>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-400">→ @{verification.revisedTimeRef}s</span>
                          </>
                        )}
                        <div className="w-full text-gray-500 mt-0.5 leading-relaxed">
                          {verification.observation}
                        </div>
                        {!verification.confirmed && verification.revisedCorrection && (
                          <div className="w-full text-gray-300 leading-relaxed">
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
      </div>

      {/* ── Verification summary ── */}
      {verificationResult && (
        <div className="flex items-start gap-4 border border-white/[0.07] rounded-xl p-4">
          <div className="text-center flex-shrink-0">
            <div className={`text-3xl font-light tabular-nums ${
              verificationResult.accuracy >= 80 ? 'text-emerald-400' :
              verificationResult.accuracy >= 60 ? 'text-amber-400' : 'text-red-400'
            }`}>{verificationResult.accuracy}%</div>
            <div className="text-[9px] font-mono text-gray-600 mt-0.5 uppercase tracking-wider">Precisión</div>
          </div>
          <div className="border-l border-white/[0.07] pl-4 flex-1">
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Verificación</div>
            <p className="text-xs text-gray-400 leading-relaxed">{verificationResult.summary}</p>
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
                ? 'border-white/[0.05] text-gray-600 cursor-not-allowed'
                : 'border-white/[0.09] text-gray-300 hover:border-white/[0.18] hover:text-white'
            }`}
          >
            {verifyState === 'verifying' ? (
              <span className="animate-pulse">Verificando frames con Gemini...</span>
            ) : (
              `Verificar ${correctionsWithFrameCount} correcciones con Gemini`
            )}
          </button>
          {verifyState === 'error' && verifyError && (
            <p className="text-xs text-red-400 font-mono mt-2 text-center">{verifyError}</p>
          )}
        </div>
      )}

      {/* ── Cues ── */}
      {data.cues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3.5 bg-gray-600 rounded-full" />
            <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Cues Técnicos</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.cues.map((cue, i) => (
              <span
                key={i}
                className="text-xs font-mono text-gray-300 bg-white/[0.04] border border-white/[0.07] px-2.5 py-1 rounded-lg"
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
            <div className="w-1 h-3.5 bg-gray-600 rounded-full" />
            <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Próximos Pasos</h3>
          </div>
          <ol className="space-y-2">
            {data.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-400 leading-snug">
                <span className="font-mono text-gray-600 flex-shrink-0 w-4 text-right">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
