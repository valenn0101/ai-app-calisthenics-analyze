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
}

const priorityColors = {
  high: 'text-red-400 border-red-400/30 bg-red-400/5',
  medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
  low: 'text-green-400 border-green-400/30 bg-green-400/5',
};

const priorityLabels = {
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
};

function FrameThumb({ frame, timeRef }: { frame: string; timeRef: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="block rounded overflow-hidden border border-blue-400/40 hover:border-blue-400 active:scale-95 transition-all"
        title={`@ ${timeRef}s — toca para ampliar`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame} alt={`Frame @ ${timeRef}s`} className="object-cover" style={{ width: 96, height: 64 }} />
        <div className="bg-black/70 text-center py-0.5">
          <span className="text-[10px] font-mono text-blue-300">@{timeRef}s</span>
        </div>
      </button>
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative w-full max-w-xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame} alt={`Frame @ ${timeRef}s`} className="w-full rounded-lg border border-blue-400/40" />
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 right-2 text-white bg-black/70 hover:bg-black px-3 py-1.5 rounded text-xs font-mono"
            >
              ✕ cerrar
            </button>
            <div className="absolute bottom-2 left-2 text-xs font-mono text-blue-300 bg-black/70 px-2 py-1 rounded">
              @ {timeRef}s
            </div>
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
}: AnalysisResultProps) {
  const scoreColor =
    data.score >= 8 ? 'text-green-400' :
    data.score >= 6 ? 'text-yellow-400' :
    data.score >= 4 ? 'text-orange-400' : 'text-red-400';

  const verifyMap = new Map(
    verificationResult?.verifications.map(v => [v.timeRef, v]) ?? []
  );

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="flex items-center gap-4">
        <div className="text-center flex-shrink-0">
          <div className={`text-5xl sm:text-6xl font-mono font-bold ${scoreColor}`}>{data.score}</div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">/ 10</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-400 font-mono uppercase truncate">{exercise}</div>
          <div className="text-base sm:text-lg text-white font-medium mt-1 leading-tight">{data.phase}</div>
          {improvement !== undefined && previousScore !== undefined && (
            <div className={`text-xs sm:text-sm font-mono mt-1 ${improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {improvement > 0 ? '▲' : improvement < 0 ? '▼' : '—'} {Math.abs(improvement).toFixed(1)} vs anterior ({previousScore}/10)
            </div>
          )}
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${data.score >= 8 ? 'bg-green-400' : data.score >= 6 ? 'bg-yellow-400' : data.score >= 4 ? 'bg-orange-400' : 'bg-red-400'}`}
          style={{ width: `${data.score * 10}%` }}
        />
      </div>

      {/* Positives */}
      {data.positives.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">✓ Puntos Positivos</h3>
          <ul className="space-y-3">
            {data.positives.map((p, i) => {
              const frame = p.timeRef != null ? timeRefFrames.get(p.timeRef) : undefined;
              return (
                <li key={i} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                    <span className="text-sm text-gray-200">{p.text}</span>
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
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">⚠ Correcciones</h3>
          <ul className="space-y-2">
            {data.corrections
              .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
              .map((c, i) => {
                const frame = c.timeRef != null ? timeRefFrames.get(c.timeRef) : undefined;
                const verification = c.timeRef != null ? verifyMap.get(c.timeRef) : undefined;
                return (
                  <li key={i} className={`border rounded p-3 space-y-2 ${priorityColors[c.priority]}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono flex-shrink-0 font-bold mt-0.5">{priorityLabels[c.priority]}</span>
                      <span className="text-sm flex-1">{c.text}</span>
                      {c.timeRef != null && (
                        <span className="text-[10px] font-mono opacity-50 flex-shrink-0 mt-0.5">@{c.timeRef}s</span>
                      )}
                    </div>

                    {frame && c.timeRef != null && (
                      <FrameThumb frame={frame} timeRef={c.timeRef} />
                    )}

                    {/* Verification badge */}
                    {verification && (
                      <div className={`text-xs font-mono rounded px-2 py-1.5 border mt-1 ${
                        verification.confirmed
                          ? 'border-green-500/30 bg-green-500/5 text-green-300'
                          : 'border-orange-500/30 bg-orange-500/5 text-orange-300'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span>{verification.confirmed ? '✓ Confirmado' : '↻ Revisado'}</span>
                          <span className="opacity-50">· confianza {verification.confidence}</span>
                          {verification.revisedTimeRef != null && (
                            <span className="ml-auto text-[10px] opacity-60">→ @{verification.revisedTimeRef}s</span>
                          )}
                        </div>
                        <div className="text-gray-300 opacity-80">{verification.observation}</div>
                        {!verification.confirmed && verification.revisedCorrection && (
                          <div className="mt-1 text-white opacity-90">→ {verification.revisedCorrection}</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Verification summary */}
      {verificationResult && (
        <div className="border border-blue-500/20 bg-blue-500/5 rounded p-3 space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-blue-300 uppercase tracking-wider">Precisión del análisis</span>
            <span className="text-lg font-mono font-bold text-blue-400">{verificationResult.accuracy}%</span>
          </div>
          <p className="text-xs text-gray-400">{verificationResult.summary}</p>
        </div>
      )}

      {/* Cues */}
      {data.cues.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">◈ Cues Técnicos</h3>
          <div className="flex flex-wrap gap-2">
            {data.cues.map((cue, i) => (
              <span key={i} className="text-xs font-mono text-violet-300 bg-violet-900/30 border border-violet-500/30 px-2.5 py-1 rounded">
                {cue}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {data.nextSteps.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">→ Próximos Pasos</h3>
          <ol className="space-y-1.5">
            {data.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="font-mono text-gray-500 flex-shrink-0">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
