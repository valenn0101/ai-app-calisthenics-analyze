'use client';

import { useState } from 'react';
import { AnalysisResult as AnalysisResultType } from '@/lib/storage';

interface AnalysisResultProps {
  data: AnalysisResultType;
  exercise: string;
  frames?: string[];
  frameLabels?: string[];
  onFrameHighlight: (frameIndex: number) => void;
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

function FrameThumb({ frame, label, onClick }: { frame: string; label: string; onClick: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        onClick={() => { setExpanded(true); onClick(); }}
        className="block rounded overflow-hidden border border-blue-400/40 hover:border-blue-400 active:scale-95 transition-all"
        title={`${label} — toca para ampliar`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frame} alt={label} className="object-cover" style={{ width: 96, height: 64 }} />
        <div className="bg-black/70 text-center py-0.5">
          <span className="text-[10px] font-mono text-blue-300">{label}</span>
        </div>
      </button>
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setExpanded(false)}>
          <div className="relative w-full max-w-xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame} alt={label} className="w-full rounded-lg border border-blue-400/40" />
            <button onClick={() => setExpanded(false)} className="absolute top-2 right-2 text-white bg-black/70 hover:bg-black px-3 py-1.5 rounded text-xs font-mono">
              ✕ cerrar
            </button>
            <div className="absolute bottom-2 left-2 text-xs font-mono text-blue-300 bg-black/70 px-2 py-1 rounded">
              {label}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AnalysisResult({ data, exercise, frames = [], frameLabels = [], onFrameHighlight, improvement, previousScore }: AnalysisResultProps) {
  const scoreColor =
    data.score >= 8 ? 'text-green-400' :
    data.score >= 6 ? 'text-yellow-400' :
    data.score >= 4 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="space-y-6">
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

      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${data.score >= 8 ? 'bg-green-400' : data.score >= 6 ? 'bg-yellow-400' : data.score >= 4 ? 'bg-orange-400' : 'bg-red-400'}`}
          style={{ width: `${data.score * 10}%` }}
        />
      </div>

      {data.positives.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">✓ Puntos Positivos</h3>
          <ul className="space-y-3">
            {data.positives.map((p, i) => {
              const ref = p.frameRef;
              const hasFrame = ref !== undefined && ref !== null && !!frames[ref];
              const label = frameLabels[ref!] ?? `f${ref! + 1}`;
              return (
                <li key={i} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                    <span className="text-sm text-gray-200">{p.text}</span>
                  </div>
                  {hasFrame && (
                    <div className="pl-4">
                      <FrameThumb frame={frames[ref!]} label={label} onClick={() => onFrameHighlight(ref!)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data.corrections.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">⚠ Correcciones</h3>
          <ul className="space-y-2">
            {data.corrections
              .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
              .map((c, i) => {
                const ref = c.frameRef;
                const hasFrame = ref !== undefined && ref !== null && !!frames[ref];
                const label = frameLabels[ref!] ?? `f${ref! + 1}`;
                return (
                  <li key={i} className={`border rounded p-3 space-y-2 ${priorityColors[c.priority]}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono flex-shrink-0 font-bold mt-0.5">{priorityLabels[c.priority]}</span>
                      <span className="text-sm flex-1">{c.text}</span>
                    </div>
                    {hasFrame && (
                      <FrameThumb frame={frames[ref!]} label={label} onClick={() => onFrameHighlight(ref!)} />
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

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
