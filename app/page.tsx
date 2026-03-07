'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import FrameStrip from '@/components/FrameStrip';
import AnalysisResult from '@/components/AnalysisResult';
import SharePanel from '@/components/SharePanel';
import { Exercise, Provider, AnalysisResult as AnalysisResultType } from '@/lib/storage';

const EXERCISES: { value: Exercise; label: string }[] = [
  { value: 'muscle_up', label: 'Muscle Up' },
  { value: 'pull_up', label: 'Pull Up' },
  { value: 'push_up', label: 'Push Up' },
  { value: 'dip', label: 'Dip' },
  { value: 'planche', label: 'Planche' },
  { value: 'l_sit', label: 'L-Sit' },
];

type AppState = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';

export default function Home() {
  const [exercise, setExercise] = useState<Exercise>('muscle_up');
  const [provider, setProvider] = useState<Provider>('claude');
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [highlightedFrames, setHighlightedFrames] = useState<Set<number>>(new Set());
  const [appState, setAppState] = useState<AppState>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResultType | null>(null);
  const [sessionMeta, setSessionMeta] = useState<{ improvement?: number; previousScore?: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [activePanel, setActivePanel] = useState<'analysis' | 'share'>('analysis');
  const [videoSrc, setVideoSrc] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const extractFrames = useCallback((file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      video.src = url;
      setVideoSrc(url);

      video.onloadedmetadata = () => {
        const duration = video.duration;
        const targetFrames = Math.min(16, Math.max(8, Math.floor(duration * 2)));
        const interval = duration / targetFrames;
        const extractedFrames: string[] = [];
        let currentFrame = 0;

        canvas.width = 640;
        canvas.height = 360;

        const seekNext = () => {
          if (currentFrame >= targetFrames) {
            URL.revokeObjectURL(url);
            resolve(extractedFrames);
            return;
          }
          video.currentTime = currentFrame * interval;
        };

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          extractedFrames.push(dataUrl);
          currentFrame++;
          seekNext();
        };

        video.onerror = () => reject(new Error('Error loading video'));
        seekNext();
      };
    });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFrames([]);
    setSelectedFrames(new Set());
    setHighlightedFrames(new Set());
    setAnalysis(null);
    setError('');
    setAppState('extracting');

    try {
      const extracted = await extractFrames(file);
      setFrames(extracted);
      setAppState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error extrayendo frames');
      setAppState('error');
    }
  };

  const handleAnalyze = async () => {
    if (frames.length === 0) return;
    setAppState('analyzing');
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, exercise, provider }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setAnalysis(data.analysisData);
      setSessionMeta({
        improvement: data.session.improvement,
        previousScore: data.session.previousScore,
      });

      // Auto-highlight referenced frames
      const refs = new Set<number>();
      data.analysisData.positives?.forEach((p: { frameRef?: number }) => {
        if (p.frameRef !== undefined && p.frameRef !== null) refs.add(p.frameRef);
      });
      data.analysisData.corrections?.forEach((c: { frameRef?: number }) => {
        if (c.frameRef !== undefined && c.frameRef !== null) refs.add(c.frameRef);
      });
      setHighlightedFrames(refs);
      setSelectedFrames(refs);
      setAppState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en análisis');
      setAppState('error');
    }
  };

  const toggleFrame = (i: number) => {
    setSelectedFrames(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleFrameHighlight = (frameIndex: number) => {
    setHighlightedFrames(new Set([frameIndex]));
    setSelectedFrames(prev => {
      const next = new Set(prev);
      next.add(frameIndex);
      return next;
    });
    document.getElementById('frame-strip')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const isLoading = appState === 'extracting' || appState === 'analyzing';

  return (
    <main className="min-h-screen bg-[#060609] text-white">
      {/* Hidden video + canvas for frame extraction */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-mono font-bold text-white tracking-tight">
              Form<span className="text-violet-500">Check</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">calistenia · análisis de técnica</p>
          </div>
          <Link
            href="/history"
            className="text-xs font-mono text-gray-400 hover:text-violet-400 border border-gray-700 hover:border-violet-500/50 px-3 py-1.5 rounded transition-all"
          >
            Historial →
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Provider Selector */}
        <div>
          <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
            Modelo de IA
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            {([
              { value: 'claude' as Provider, label: 'Claude Opus 4.6', color: 'violet' },
              { value: 'gemini' as Provider, label: 'Gemini 3 Flash Preview', color: 'blue' },
            ] as const).map(p => (
              <button
                key={p.value}
                onClick={() => setProvider(p.value)}
                className={`flex-1 text-xs font-mono py-2 px-3 rounded border transition-all ${
                  provider === p.value
                    ? p.color === 'violet'
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                      : 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload + Exercise Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exercise Selector */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
              Ejercicio
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXERCISES.map(ex => (
                <button
                  key={ex.value}
                  onClick={() => setExercise(ex.value)}
                  className={`text-xs font-mono py-2 px-2 rounded border transition-all ${
                    exercise === ex.value
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Video Upload */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
              Video
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                frames.length > 0
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {appState === 'extracting' ? (
                <div className="text-sm text-gray-400 font-mono animate-pulse">
                  Extrayendo frames...
                </div>
              ) : frames.length > 0 ? (
                <div className="text-sm text-violet-400 font-mono">
                  ✓ {frames.length} frames extraídos
                  <div className="text-xs text-gray-500 mt-1">Click para cambiar video</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">▶</div>
                  <div className="text-sm text-gray-400 font-mono">Subir video</div>
                  <div className="text-xs text-gray-600 mt-1">mp4, mov, webm...</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Frame Strip */}
        {frames.length > 0 && (
          <div id="frame-strip">
            <FrameStrip
              frames={frames}
              selectedFrames={selectedFrames}
              highlightedFrames={highlightedFrames}
              onToggle={toggleFrame}
            />
          </div>
        )}

        {/* Analyze Button */}
        {frames.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className={`w-full py-3 px-6 rounded font-mono font-bold text-sm transition-all ${
              isLoading
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {appState === 'analyzing' ? (
              <span className="animate-pulse">
                Analizando con {provider === 'gemini' ? 'Gemini' : 'Claude'}...
              </span>
            ) : (
              'Analizar Técnica'
            )}
          </button>
        )}

        {/* Error */}
        {appState === 'error' && error && (
          <div className="border border-red-500/30 bg-red-500/5 rounded p-3">
            <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        )}

        {/* Analysis + Share */}
        {analysis && appState === 'done' && (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              {(['analysis', 'share'] as const).map(panel => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  className={`flex-1 py-3 text-xs font-mono uppercase tracking-wider transition-all ${
                    activePanel === panel
                      ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {panel === 'analysis' ? 'Análisis' : 'Compartir con Agente'}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {activePanel === 'analysis' ? (
                <AnalysisResult
                  data={analysis}
                  exercise={EXERCISES.find(e => e.value === exercise)?.label || exercise}
                  frames={frames}
                  onFrameHighlight={handleFrameHighlight}
                  improvement={sessionMeta?.improvement}
                  previousScore={sessionMeta?.previousScore}
                />
              ) : (
                <SharePanel
                  shareText={analysis.shareText}
                  frames={frames}
                  selectedFrames={selectedFrames}
                />
              )}
            </div>
          </div>
        )}

        {/* Video preview */}
        {videoSrc && frames.length > 0 && (
          <div className="flex justify-center">
            <video
              src={videoSrc}
              controls
              className="rounded border border-gray-800"
              style={{ maxHeight: 180, maxWidth: '100%' }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
