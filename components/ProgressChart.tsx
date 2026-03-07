'use client';

import { SessionRecord } from '@/lib/storage';

interface ProgressChartProps {
  sessions: SessionRecord[];
  exercise: string;
}

export default function ProgressChart({ sessions, exercise }: ProgressChartProps) {
  if (sessions.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-600 text-sm font-mono">
        Sin datos para {exercise}
      </div>
    );
  }

  const maxScore = 10;
  const minScore = 0;
  const chartHeight = 120;
  const chartWidth = 400;
  const padding = { top: 8, bottom: 24, left: 28, right: 8 };

  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const points = sessions.map((s, i) => {
    const x = sessions.length === 1
      ? padding.left + innerW / 2
      : padding.left + (i / (sessions.length - 1)) * innerW;
    const y = padding.top + ((maxScore - s.score) / (maxScore - minScore)) * innerH;
    return { x, y, score: s.score, date: s.date, id: s.id };
  });

  // Build SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Area fill
  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`
    : '';

  // Score gridlines at 2, 4, 6, 8, 10
  const gridLines = [2, 4, 6, 8, 10];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        style={{ minWidth: 280, maxHeight: 160 }}
      >
        {/* Grid lines */}
        {gridLines.map(val => {
          const y = padding.top + ((maxScore - val) / (maxScore - minScore)) * innerH;
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerW}
                y2={y}
                stroke="#1f2937"
                strokeWidth={1}
              />
              <text
                x={padding.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#4b5563"
                fontFamily="monospace"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area */}
        {areaD && (
          <path
            d={areaD}
            fill="url(#areaGradient)"
            opacity={0.3}
          />
        )}

        {/* Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#7c3aed"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Data points */}
        {points.map((p, i) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#7c3aed"
              stroke="#060609"
              strokeWidth={2}
            />
            {/* Score label for first and last, or if few sessions */}
            {(i === 0 || i === points.length - 1 || sessions.length <= 5) && (
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize={9}
                fill="#a78bfa"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {p.score}
              </text>
            )}
          </g>
        ))}

        {/* X-axis date labels */}
        {sessions.length <= 6 && points.map((p, i) => (
          <text
            key={`date-${i}`}
            x={p.x}
            y={chartHeight - 4}
            textAnchor="middle"
            fontSize={8}
            fill="#4b5563"
            fontFamily="monospace"
          >
            {new Date(sessions[i].date).toLocaleDateString('es', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
      </svg>

      {sessions.length > 1 && (
        <div className="flex justify-between text-xs font-mono text-gray-600 mt-1">
          <span>{new Date(sessions[0].date).toLocaleDateString('es')}</span>
          <span>{new Date(sessions[sessions.length - 1].date).toLocaleDateString('es')}</span>
        </div>
      )}
    </div>
  );
}
