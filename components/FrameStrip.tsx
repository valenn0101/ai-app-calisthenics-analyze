'use client';

interface FrameStripProps {
  frames: string[];
  selectedFrames: Set<number>;
  highlightedFrames?: Set<number>;
  onToggle: (index: number) => void;
}

export default function FrameStrip({ frames, selectedFrames, highlightedFrames = new Set(), onToggle }: FrameStripProps) {
  if (frames.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
          Frames — {frames.length} capturados
        </span>
        <span className="text-xs text-gray-500">
          {selectedFrames.size} seleccionados
        </span>
      </div>
      {/* touch-action: pan-x lets the strip scroll horizontally on touch devices */}
      <div
        className="flex gap-2 overflow-x-auto pb-3 scrollbar-thin"
        style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {frames.map((frame, i) => {
          const isSelected = selectedFrames.has(i);
          const isHighlighted = highlightedFrames.has(i);
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              className={`relative flex-shrink-0 rounded overflow-hidden transition-all duration-150 active:scale-95 ${
                isSelected
                  ? 'ring-2 ring-violet-500 opacity-100'
                  : 'ring-1 ring-gray-700 opacity-60 hover:opacity-90'
              } ${isHighlighted ? 'ring-2 ring-blue-400 opacity-100' : ''}`}
              style={{ width: 88, height: 66, minWidth: 88 }}
              title={`Frame ${i + 1}${isHighlighted ? ' — referenciado en análisis' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
                <span className="text-[10px] font-mono text-white">{i + 1}</span>
              </div>
              {isHighlighted && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full shadow" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
