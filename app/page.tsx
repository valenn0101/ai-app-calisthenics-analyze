'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import FrameStrip from '@/components/FrameStrip';
import AnalysisResult from '@/components/AnalysisResult';
import SharePanel from '@/components/SharePanel';
import { Provider, AnalysisResult as AnalysisResultType } from '@/lib/storage';

type AppState = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';

export default function Home() {
  const [exercise, setExercise] = useState<string>('');
  const [provider, setProvider] = useState<Provider>('claude');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [highlightedFrames, setHighlightedFrames] = useState<Set<number>>(new Set());
  const [appState, setAppState] = useState<AppState>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResultType | null>(null);
  const [frameLabels, setFrameLabels] = useState<string[]>([]);
  const [sessionMeta, setSessionMeta] = useState<{ improvement?: number; previousScore?: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [activePanel, setActivePanel] = useState<'analysis' | 'share'>('analysis');
  const [videoSrc, setVideoSrc] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Smart frame extraction: selects key moments using motion peaks instead of uniform sampling.
  const extractFrames = useCallback(async (): Promise<string[]> => {
    const video = videoRef.current;
    const analysisCanvas = canvasRef.current;
    if (!video || !analysisCanvas) throw new Error('Video not loaded');

    const duration = video.duration;
    if (!duration || Number.isNaN(duration)) throw new Error('Video not loaded');

    const seekTo = (time: number) => new Promise<void>((resolve, reject) => {
      const clamped = Math.max(0, Math.min(duration, time));
      const cleanup = () => {
        video.onseeked = null;
        video.onerror = null;
      };
      video.onseeked = () => {
        cleanup();
        resolve();
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('Error seeking video'));
      };
      video.currentTime = clamped;
    });

    // Pass 1: low-res motion analysis.
    const sampleCount = Math.min(36, Math.max(16, Math.floor(duration * 3)));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 36;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) throw new Error('Cannot create analysis context');

    type MotionSample = { time: number; score: number };
    const samples: MotionSample[] = [];
    let prevGray: Uint8ClampedArray | null = null;

    for (let i = 0; i < sampleCount; i++) {
      const t = sampleCount === 1 ? 0 : (duration * i) / (sampleCount - 1);
      await seekTo(t);
      sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const gray = new Uint8ClampedArray(sampleCanvas.width * sampleCanvas.height);

      for (let p = 0, g = 0; p < pixels.length; p += 4, g++) {
        gray[g] = (pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114) | 0;
      }

      let score = 0;
      if (prevGray) {
        for (let k = 0; k < gray.length; k++) {
          score += Math.abs(gray[k] - prevGray[k]);
        }
        score /= gray.length;
      }
      samples.push({ time: t, score });
      prevGray = gray;
    }

    const targetFrames = Math.min(16, Math.max(8, Math.floor(duration * 1.2)));
    const keyTimes = new Set<number>();
    keyTimes.add(0);
    keyTimes.add(Math.max(0, duration - 0.001));

    // Pick strongest motion in each temporal bucket for phase coverage.
    const buckets = Math.min(6, Math.max(4, targetFrames - 2));
    for (let b = 0; b < buckets; b++) {
      const from = Math.floor((b * samples.length) / buckets);
      const to = Math.max(from + 1, Math.floor(((b + 1) * samples.length) / buckets));
      const segment = samples.slice(from, to);
      if (!segment.length) continue;
      const best = segment.reduce((acc, cur) => (cur.score > acc.score ? cur : acc));
      keyTimes.add(best.time);
    }

    // Fill remaining slots with globally top motion peaks.
    const ranked = [...samples].sort((a, b) => b.score - a.score);
    for (const s of ranked) {
      if (keyTimes.size >= targetFrames) break;
      keyTimes.add(s.time);
    }

    // Fallback to uniform fill if duplicates reduced total.
    if (keyTimes.size < targetFrames) {
      for (let i = 0; i < targetFrames; i++) {
        keyTimes.add((duration * i) / Math.max(targetFrames - 1, 1));
      }
    }

    const orderedTimes = Array.from(keyTimes)
      .map(t => Number(t.toFixed(3)))
      .sort((a, b) => a - b)
      .slice(0, targetFrames);

    // Pass 2: export selected keyframes at display resolution.
    const exportCanvas = analysisCanvas;
    exportCanvas.width = 640;
    exportCanvas.height = 360;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) throw new Error('Cannot create export context');

    const extracted: string[] = [];
    for (const t of orderedTimes) {
      await seekTo(t);
      exportCtx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
      extracted.push(exportCanvas.toDataURL('image/jpeg', 0.8));
    }

    return extracted;
  }, []);

  const extractFramesAtTimestamps = useCallback((timestamps: number[]): Promise<string[]> => {
    return new Promise((resolve) => {
      if (timestamps.length === 0) { resolve([]); return; }
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = 640;
      canvas.height = 360;
      const extracted: string[] = [];
      let i = 0;
      let done = false;

      // Safety timeout: resolve with whatever was captured so far
      const timeout = setTimeout(() => {
        if (!done) { done = true; video.onseeked = null; resolve(extracted); }
      }, 10000);

      const seekNext = () => {
        if (i >= timestamps.length) {
          if (!done) { done = true; clearTimeout(timeout); video.onseeked = null; resolve(extracted); }
          return;
        }
        video.currentTime = timestamps[i];
      };
      video.onseeked = () => {
        if (done) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        extracted.push(canvas.toDataURL('image/jpeg', 0.85));
        i++;
        seekNext();
      };
      seekNext();
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous blob URL
    if (videoRef.current?.src?.startsWith('blob:')) URL.revokeObjectURL(videoRef.current.src);

    setFrames([]);
    setSelectedFrames(new Set());
    setHighlightedFrames(new Set());
    setAnalysis(null);
    setError('');
    setVideoFile(file);

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    const video = videoRef.current!;
    video.src = url;
    video.onloadedmetadata = () => setVideoDuration(video.duration);
    setAppState('idle');
  };

  const handleAnalyze = async () => {
    if (!videoFile || !exercise.trim()) return;
    setAppState('analyzing');
    setError('');

    try {
      let res: Response;

      if (provider === 'gemini') {
        // Gemini: send video file directly, no frame extraction needed
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('exercise', exercise);
        res = await fetch('/api/analyze', { method: 'POST', body: formData });
      } else {
        // Claude: extract frames now, then send
        setAppState('extracting');
        const extracted = await extractFrames();
        setFrames(extracted);
        setAppState('analyzing');
        res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames: extracted, exercise, provider }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setSessionMeta({
        improvement: data.session.improvement,
        previousScore: data.session.previousScore,
      });

      if (provider === 'gemini' && videoFile) {
        // Extract frames at the exact timestamps Gemini identified
        const tsMap = new Map<number, number>();
        const allTs: number[] = [];
        const collect = (items: { timestamp?: number }[]) => {
          items?.forEach(item => {
            if (item.timestamp != null && !tsMap.has(item.timestamp)) {
              tsMap.set(item.timestamp, allTs.length);
              allTs.push(item.timestamp);
            }
          });
        };
        collect(data.analysisData.positives ?? []);
        collect(data.analysisData.corrections ?? []);

        const refFrames = allTs.length > 0 ? await extractFramesAtTimestamps(allTs) : [];

        // Remap timestamp → frameRef index into the newly extracted frames
        const remapped: AnalysisResultType = {
          ...data.analysisData,
          positives: data.analysisData.positives.map((p: { timestamp?: number; frameRef?: number }) => ({
            ...p,
            frameRef: p.timestamp != null ? tsMap.get(p.timestamp) : p.frameRef,
          })),
          corrections: data.analysisData.corrections.map((c: { timestamp?: number; frameRef?: number }) => ({
            ...c,
            frameRef: c.timestamp != null ? tsMap.get(c.timestamp) : c.frameRef,
          })),
        };

        setFrames(refFrames);
        setFrameLabels(allTs.map(t => `${t.toFixed(1)}s`));
        setAnalysis(remapped);
        const allIndices = new Set(allTs.map((_, i) => i));
        setHighlightedFrames(allIndices);
        setSelectedFrames(allIndices);
      } else {
        // Claude: use pre-extracted frames with frameRef indices
        setFrameLabels([]);
        setAnalysis(data.analysisData);
        const refs = new Set<number>();
        data.analysisData.positives?.forEach((p: { frameRef?: number }) => {
          if (p.frameRef != null) refs.add(p.frameRef);
        });
        data.analysisData.corrections?.forEach((c: { frameRef?: number }) => {
          if (c.frameRef != null) refs.add(c.frameRef);
        });
        setHighlightedFrames(refs);
        setSelectedFrames(refs);
      }

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
              { value: 'gemini' as Provider, label: 'Gemini 3 Flash Preview', badge: 'video nativo', color: 'blue' },
              { value: 'kimi' as Provider, label: 'Kimi K2.5', color: 'teal' },
            ] as const).map(p => (
              <button
                key={p.value}
                onClick={() => setProvider(p.value)}
                className={`flex-1 text-xs font-mono py-2 px-3 rounded border transition-all ${
                  provider === p.value
                    ? p.color === 'violet'
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                      : p.color === 'blue'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-teal-500 bg-teal-500/10 text-teal-300'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div>{p.label}</div>
                {'badge' in p && <div className="text-[10px] opacity-60 mt-0.5">{p.badge}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Upload + Exercise Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exercise Input */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
              Ejercicio
            </label>
            <input
              type="text"
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              placeholder="ej: Pull Up, Planche, Dip..."
              className="w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
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
              {videoFile ? (
                <div className="text-sm text-violet-400 font-mono">
                  ✓ {videoFile.name}
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
        {videoFile && (
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !exercise.trim()}
            className={`w-full py-3 px-6 rounded font-mono font-bold text-sm transition-all ${
              isLoading
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {appState === 'analyzing' ? (
              <span className="animate-pulse">
                {provider === 'gemini' && videoFile
                  ? 'Subiendo y analizando con Gemini...'
                  : `Analizando con ${
                    provider === 'gemini'
                      ? 'Gemini'
                      : provider === 'kimi'
                        ? 'Kimi'
                        : 'Claude'
                  }...`}
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
                  exercise={exercise}
                  frames={frames}
                  frameLabels={frameLabels}
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
