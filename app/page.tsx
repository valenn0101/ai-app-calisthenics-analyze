'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import FrameStrip from '@/components/FrameStrip';
import AnalysisResult from '@/components/AnalysisResult';
import ChatPanel from '@/components/ChatPanel';
import SharePanel from '@/components/SharePanel';
import { AnalysisResult as AnalysisResultType, VerificationResult } from '@/lib/storage';

type AppState = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';
type VerifyState = 'idle' | 'verifying' | 'done' | 'error';
type Panel = 'analysis' | 'chat' | 'share';

export default function Home() {
  const [exercise, setExercise] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [highlightedFrames, setHighlightedFrames] = useState<Set<number>>(new Set());
  const [appState, setAppState] = useState<AppState>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResultType | null>(null);
  const [sessionMeta, setSessionMeta] = useState<{ improvement?: number; previousScore?: number } | null>(null);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState<Panel>('analysis');
  const [videoSrc, setVideoSrc] = useState('');

  const [timeRefFrames, setTimeRefFrames] = useState<Map<number, string>>(new Map());
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState('');

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
        setVideoDuration(video.duration);
        const duration = video.duration;
        const targetFrames = Math.min(16, Math.max(8, Math.floor(duration * 2)));
        const interval = duration / targetFrames;
        const extractedFrames: string[] = [];
        let currentFrame = 0;

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

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
          extractedFrames.push(canvas.toDataURL('image/jpeg', 0.9));
          currentFrame++;
          seekNext();
        };

        video.onerror = () => reject(new Error('Error loading video'));
        seekNext();
      };
    });
  }, []);

  const captureFramesAtTimes = useCallback(async (times: number[]): Promise<Map<number, string>> => {
    if (!videoFile || times.length === 0) return new Map();

    const url = URL.createObjectURL(videoFile);
    const tempVideo = document.createElement('video');
    tempVideo.src = url;
    tempVideo.muted = true;

    await new Promise<void>(resolve => {
      tempVideo.onloadedmetadata = () => resolve();
    });

    const canvas = canvasRef.current!;
    canvas.width = tempVideo.videoWidth || 1280;
    canvas.height = tempVideo.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    const result = new Map<number, string>();

    for (const time of times) {
      const clampedTime = Math.min(time, tempVideo.duration - 0.05);
      await new Promise<void>(resolve => {
        tempVideo.onseeked = () => {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          result.set(time, canvas.toDataURL('image/jpeg', 0.92));
          resolve();
        };
        tempVideo.currentTime = clampedTime;
      });
    }

    URL.revokeObjectURL(url);
    return result;
  }, [videoFile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFrames([]);
    setSelectedFrames(new Set());
    setHighlightedFrames(new Set());
    setAnalysis(null);
    setTimeRefFrames(new Map());
    setVerificationResult(null);
    setVerifyState('idle');
    setError('');
    setAppState('extracting');

    try {
      setVideoFile(file);
      const extracted = await extractFrames(file);
      setFrames(extracted);
      setAppState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error extrayendo frames');
      setAppState('error');
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile || !exercise.trim()) return;
    setAppState('analyzing');
    setError('');
    setAnalysis(null);
    setTimeRefFrames(new Map());
    setVerificationResult(null);
    setVerifyState('idle');
    setActivePanel('analysis');

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('exercise', exercise.trim());
      formData.append('videoDuration', videoDuration.toString());
      formData.append('framesJson', JSON.stringify(frames));

      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      setAnalysis(data.analysisData);
      setSessionMeta({ improvement: data.session.improvement, previousScore: data.session.previousScore });
      setAppState('done');

      const allTimeRefs: number[] = [];
      const seen = new Set<number>();
      const collect = (items: { timeRef?: number | null }[]) =>
        items?.forEach(item => {
          if (item.timeRef != null && !seen.has(item.timeRef)) {
            seen.add(item.timeRef);
            allTimeRefs.push(item.timeRef);
          }
        });

      collect(data.analysisData.positives ?? []);
      collect(data.analysisData.corrections ?? []);

      if (frames.length > 0 && videoDuration > 0) {
        const refs = new Set<number>();
        for (const t of allTimeRefs) {
          refs.add(Math.min(Math.round((t / videoDuration) * (frames.length - 1)), frames.length - 1));
        }
        setHighlightedFrames(refs);
        setSelectedFrames(refs);
      }

      if (allTimeRefs.length > 0) {
        const captured = await captureFramesAtTimes(allTimeRefs);
        setTimeRefFrames(captured);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en análisis');
      setAppState('error');
    }
  };

  const handleVerify = async () => {
    if (!analysis || timeRefFrames.size === 0) return;
    const correctionsWithFrame = analysis.corrections.filter(
      c => c.timeRef != null && timeRefFrames.has(c.timeRef)
    );
    if (!correctionsWithFrame.length) return;

    setVerifyState('verifying');
    setVerifyError('');
    setVerificationResult(null);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: correctionsWithFrame.map(c => timeRefFrames.get(c.timeRef!)!),
          corrections: correctionsWithFrame,
          exercise: exercise.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setVerificationResult(data);
      setVerifyState('done');
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Error en verificación');
      setVerifyState('error');
    }
  };

  const toggleFrame = (i: number) => {
    setSelectedFrames(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const isLoading = appState === 'extracting' || appState === 'analyzing';
  const correctionsWithFrame = analysis?.corrections.filter(
    c => c.timeRef != null && timeRefFrames.has(c.timeRef)
  ) ?? [];

  const PANELS: { id: Panel; label: string }[] = [
    { id: 'analysis', label: 'Análisis' },
    { id: 'chat', label: 'Coach' },
    { id: 'share', label: 'Compartir' },
  ];

  return (
    <main className="min-h-screen bg-[#0C0C10] text-white">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Header ── */}
      <header className="border-b border-white/[0.07]">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-base font-light tracking-widest text-white">
              FORM<span className="text-gray-400">CHECK</span>
            </div>
            <div className="text-[10px] text-gray-600 tracking-wider mt-0.5">Análisis de técnica · Gemini</div>
          </div>
          <Link
            href="/history"
            className="text-[11px] font-mono text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.18] px-3 py-1.5 rounded-lg transition-all"
          >
            Historial
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">

        {/* ── Exercise + Upload ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Exercise input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-gray-600 uppercase tracking-widest">
              Ejercicio
            </label>
            <input
              type="text"
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              placeholder="Muscle Up, Pull Up, Planche..."
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-white/[0.22] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 outline-none transition-colors"
            />
          </div>

          {/* Video upload */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono text-gray-600 uppercase tracking-widest">
              Video
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border rounded-xl py-3 px-4 cursor-pointer transition-all flex items-center gap-3 ${
                frames.length > 0
                  ? 'border-white/[0.14] bg-white/[0.03]'
                  : 'border-white/[0.07] border-dashed hover:border-white/[0.14]'
              }`}
            >
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-gray-500 text-sm">
                {appState === 'extracting' ? (
                  <span className="animate-spin">◌</span>
                ) : frames.length > 0 ? '✓' : '▶'}
              </div>
              <div className="min-w-0">
                {appState === 'extracting' ? (
                  <div className="text-xs text-gray-400 animate-pulse">Extrayendo frames...</div>
                ) : frames.length > 0 ? (
                  <>
                    <div className="text-xs text-white">{frames.length} frames · {videoDuration.toFixed(1)}s</div>
                    <div className="text-[10px] text-gray-600">Click para cambiar</div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-gray-400">Subir video</div>
                    <div className="text-[10px] text-gray-600">mp4 · mov · webm</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Frame strip ── */}
        {frames.length > 0 && (
          <FrameStrip
            frames={frames}
            selectedFrames={selectedFrames}
            highlightedFrames={highlightedFrames}
            onToggle={toggleFrame}
          />
        )}

        {/* ── Analyze button ── */}
        {frames.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !exercise.trim()}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
              isLoading || !exercise.trim()
                ? 'bg-white/[0.05] text-gray-600 cursor-not-allowed'
                : 'bg-white text-black hover:bg-gray-100 active:scale-[0.99]'
            }`}
          >
            {appState === 'analyzing' ? (
              <span className="text-gray-500 animate-pulse text-xs font-mono tracking-wider">
                Analizando con Gemini...
              </span>
            ) : (
              'Analizar técnica'
            )}
          </button>
        )}

        {/* ── Error ── */}
        {appState === 'error' && error && (
          <div className="border border-red-500/20 bg-red-500/[0.04] rounded-xl px-4 py-3">
            <p className="text-xs text-red-400 font-mono">{error}</p>
          </div>
        )}

        {/* ── Results panel ── */}
        {analysis && appState === 'done' && (
          <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-[#111116]">

            {/* Tabs */}
            <div className="flex border-b border-white/[0.07]">
              {PANELS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setActivePanel(p.id)}
                  className={`flex-1 py-3.5 text-[11px] font-mono uppercase tracking-wider transition-all ${
                    activePanel === p.id
                      ? 'text-white border-b border-white/50'
                      : 'text-gray-600 hover:text-gray-300'
                  }`}
                >
                  {p.label}
                  {p.id === 'chat' && (
                    <span className="ml-1.5 text-[8px] text-gray-600 align-middle">IA</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-5 sm:p-6">
              {activePanel === 'analysis' && (
                <AnalysisResult
                  data={analysis}
                  exercise={exercise}
                  timeRefFrames={timeRefFrames}
                  verificationResult={verificationResult}
                  improvement={sessionMeta?.improvement}
                  previousScore={sessionMeta?.previousScore}
                  onVerify={handleVerify}
                  verifyState={verifyState}
                  verifyError={verifyError}
                  correctionsWithFrameCount={correctionsWithFrame.length}
                />
              )}

              {activePanel === 'chat' && (
                <ChatPanel
                  exercise={exercise}
                  analysis={analysis}
                  verification={verificationResult}
                />
              )}

              {activePanel === 'share' && (
                <SharePanel
                  shareText={analysis.shareText}
                  frames={frames}
                  selectedFrames={selectedFrames}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Video player ── */}
        {videoSrc && frames.length > 0 && (
          <div className="flex justify-center pt-2">
            <video
              src={videoSrc}
              controls
              className="rounded-xl border border-white/[0.07] max-h-44 max-w-full"
            />
          </div>
        )}
      </div>
    </main>
  );
}
