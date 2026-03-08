'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import FrameStrip from '@/components/FrameStrip';
import AnalysisResult from '@/components/AnalysisResult';
import SharePanel from '@/components/SharePanel';
import { AnalysisResult as AnalysisResultType, VerificationResult } from '@/lib/storage';

type AppState = 'idle' | 'extracting' | 'analyzing' | 'done' | 'error';
type VerifyState = 'idle' | 'verifying' | 'done' | 'error';

export default function Home() {
  const [exercise, setExercise] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [frames, setFrames] = useState<string[]>([]);
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const [highlightedFrames, setHighlightedFrames] = useState<Set<number>>(new Set());
  const [appState, setAppState] = useState<AppState>('idle');
  const [analysis, setAnalysis] = useState<AnalysisResultType | null>(null);
  const [sessionMeta, setSessionMeta] = useState<{ improvement?: number; previousScore?: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [activePanel, setActivePanel] = useState<'analysis' | 'share'>('analysis');
  const [videoSrc, setVideoSrc] = useState<string>('');

  const [timeRefFrames, setTimeRefFrames] = useState<Map<number, string>>(new Map());
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string>('');

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

  // Capture frames at exact timeRef timestamps using the original video file
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
      setSessionMeta({
        improvement: data.session.improvement,
        previousScore: data.session.previousScore,
      });
      setAppState('done');

      // Collect all unique timeRef values
      const allTimeRefs: number[] = [];
      const seen = new Set<number>();
      const collect = (items: { timeRef?: number | null }[]) => {
        items?.forEach(item => {
          if (item.timeRef != null && !seen.has(item.timeRef)) {
            seen.add(item.timeRef);
            allTimeRefs.push(item.timeRef);
          }
        });
      };
      collect(data.analysisData.positives ?? []);
      collect(data.analysisData.corrections ?? []);

      // Highlight closest frame in FrameStrip for each timeRef
      if (frames.length > 0 && videoDuration > 0) {
        const refs = new Set<number>();
        for (const t of allTimeRefs) {
          const idx = Math.min(
            Math.round((t / videoDuration) * (frames.length - 1)),
            frames.length - 1
          );
          refs.add(idx);
        }
        setHighlightedFrames(refs);
        setSelectedFrames(refs);
      }

      // Capture exact frames at timeRef timestamps for thumbnails
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
    if (correctionsWithFrame.length === 0) return;

    setVerifyState('verifying');
    setVerifyError('');
    setVerificationResult(null);

    try {
      const framesArr = correctionsWithFrame.map(c => timeRefFrames.get(c.timeRef!)!);

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames: framesArr,
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
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const isLoading = appState === 'extracting' || appState === 'analyzing';
  const correctionsWithFrame = analysis?.corrections.filter(
    c => c.timeRef != null && timeRefFrames.has(c.timeRef)
  ) ?? [];

  return (
    <main className="min-h-screen bg-[#060609] text-white">
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

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
        {/* Upload + Exercise */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exercise input */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
              Ejercicio
            </label>
            <input
              type="text"
              value={exercise}
              onChange={e => setExercise(e.target.value)}
              placeholder="ej: Muscle Up, Pull Up, Planche..."
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
              {appState === 'extracting' ? (
                <div className="text-sm text-gray-400 font-mono animate-pulse">Extrayendo frames...</div>
              ) : frames.length > 0 ? (
                <div className="text-sm text-violet-400 font-mono">
                  ✓ {frames.length} frames · {videoDuration.toFixed(1)}s
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
            disabled={isLoading || !exercise.trim()}
            className={`w-full py-3 px-6 rounded font-mono font-bold text-sm transition-all ${
              isLoading || !exercise.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            {appState === 'analyzing' ? (
              <span className="animate-pulse">Subiendo y analizando con Gemini...</span>
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
                <>
                  <AnalysisResult
                    data={analysis}
                    exercise={exercise}
                    timeRefFrames={timeRefFrames}
                    verificationResult={verificationResult}
                    improvement={sessionMeta?.improvement}
                    previousScore={sessionMeta?.previousScore}
                  />

                  {/* Verify button */}
                  {correctionsWithFrame.length > 0 && verifyState !== 'done' && (
                    <div className="mt-6 pt-6 border-t border-gray-800">
                      <button
                        onClick={handleVerify}
                        disabled={verifyState === 'verifying'}
                        className={`w-full py-2.5 px-4 rounded font-mono text-sm border transition-all ${
                          verifyState === 'verifying'
                            ? 'border-gray-700 text-gray-500 cursor-not-allowed'
                            : 'border-blue-500/40 text-blue-300 hover:border-blue-400 hover:bg-blue-500/5'
                        }`}
                      >
                        {verifyState === 'verifying' ? (
                          <span className="animate-pulse">Verificando con Gemini...</span>
                        ) : (
                          `Verificar ${correctionsWithFrame.length} correcciones con Gemini`
                        )}
                      </button>
                      {verifyState === 'error' && verifyError && (
                        <p className="text-xs text-red-400 font-mono mt-2">{verifyError}</p>
                      )}
                    </div>
                  )}
                </>
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
