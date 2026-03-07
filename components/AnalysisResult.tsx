'use client';

import { AnalysisResult as AnalysisResultType } from '@/lib/storage';

interface AnalysisResultProps {
  data: AnalysisResultType;
  exercise: string;
  onFrameHighlight: (frameIndex: number) => void;
  highlightedFrame?: number;
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

export default function AnalysisResult({
  data,
  exercise,
  onFrameHighlight,
  improvement,
  previousScore,
}: AnalysisResultProps) {
  const scoreColor =
    data.score >= 8 ? 'text-green-400' :
    data.score >= 6 ? 'text-yellow-400' :
    data.score >= 4 ? 'text-orange-400' :
    'text-red-400';

  return (
    <div className="space-y-6">
      {/* Score Header */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className={`text-6xl font-mono font-bold ${scoreColor}`}>
            {data.score}
          </div>
          <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">/ 10</div>
        </div>
        <div>
          <div className="text-sm text-gray-400 font-mono uppercase">{exercise}</div>
          <div className="text-lg text-white font-medium mt-1">{data.phase}</div>
          {improvement !== undefined && previousScore !== undefined && (
            <div className={`text-sm font-mono mt-1 ${improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {improvement > 0 ? '▲' : improvement < 0 ? '▼' : '—'} {Math.abs(improvement).toFixed(1)} vs anterior ({previousScore}/10)
            </div>
          )}
        </div>
      </div>

      {/* Score Bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            data.score >= 8 ? 'bg-green-400' :
            data.score >= 6 ? 'bg-yellow-400' :
            data.score >= 4 ? 'bg-orange-400' :
            'bg-red-400'
          }`}
          style={{ width: `${data.score * 10}%` }}
        />
      </div>

      {/* Positives */}
      {data.positives.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
            ✓ Puntos Positivos
          </h3>
          <ul className="space-y-2">
            {data.positives.map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-green-400 mt-0.5 flex-shrink-0">+</span>
                <span className="text-sm text-gray-200">{p.text}</span>
                {p.frameRef !== undefined && p.frameRef !== null && (
                  <button
                    onClick={() => onFrameHighlight(p.frameRef!)}
                    className="flex-shrink-0 text-xs font-mono text-blue-400 hover:text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded"
                  >
                    f{p.frameRef + 1}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrections */}
      {data.corrections.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
            ⚠ Correcciones
          </h3>
          <ul className="space-y-2">
            {data.corrections
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.priority] - order[b.priority];
              })
              .map((c, i) => (
                <li key={i} className={`flex items-start gap-3 border rounded p-2.5 ${priorityColors[c.priority]}`}>
                  <span className="text-xs font-mono flex-shrink-0 font-bold mt-0.5">
                    {priorityLabels[c.priority]}
                  </span>
                  <span className="text-sm flex-1">{c.text}</span>
                  {c.frameRef !== undefined && c.frameRef !== null && (
                    <button
                      onClick={() => onFrameHighlight(c.frameRef!)}
                      className="flex-shrink-0 text-xs font-mono text-blue-400 hover:text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded"
                    >
                      f{c.frameRef + 1}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Cues */}
      {data.cues.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
            ◈ Cues Técnicos
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.cues.map((cue, i) => (
              <span
                key={i}
                className="text-xs font-mono text-violet-300 bg-violet-900/30 border border-violet-500/30 px-2.5 py-1 rounded"
              >
                {cue}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {data.nextSteps.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-3">
            → Próximos Pasos
          </h3>
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
