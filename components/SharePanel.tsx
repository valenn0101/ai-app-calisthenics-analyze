'use client';

import { useState } from 'react';

interface SharePanelProps {
  shareText: string;
  frames: string[];
  selectedFrames: Set<number>;
}

export default function SharePanel({ shareText, frames, selectedFrames }: SharePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFrames = () => {
    const indices = selectedFrames.size > 0
      ? Array.from(selectedFrames)
      : frames.map((_, i) => i);

    indices.forEach(i => {
      const frame = frames[i];
      if (!frame) return;
      const a = document.createElement('a');
      a.href = frame;
      a.download = `frame-${i + 1}.jpg`;
      a.click();
    });
  };

  const handleDownloadAll = () => {
    const data = {
      shareText,
      exportedAt: new Date().toISOString(),
      frameCount: frames.length,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formcheck-share-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            Texto para agente
          </h3>
          <button
            onClick={handleCopy}
            className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
              copied
                ? 'border-green-500 text-green-400 bg-green-500/10'
                : 'border-gray-600 text-gray-400 hover:border-violet-500 hover:text-violet-400'
            }`}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-3 max-h-40 overflow-y-auto">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
            {shareText}
          </pre>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleDownloadFrames}
          disabled={frames.length === 0}
          className="flex-1 text-sm font-mono py-2 px-3 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          ↓ Frames {selectedFrames.size > 0 ? `(${selectedFrames.size})` : `(todos)`}
        </button>
        <button
          onClick={handleDownloadAll}
          className="flex-1 text-sm font-mono py-2 px-3 rounded border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 transition-all"
        >
          ↓ Export JSON
        </button>
      </div>

      {selectedFrames.size === 0 && frames.length > 0 && (
        <p className="text-xs text-gray-500 font-mono">
          Seleccioná frames en el strip para descargarlos individualmente
        </p>
      )}
    </div>
  );
}
