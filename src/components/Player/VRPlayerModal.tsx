import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import type { DriveFile, VideoFormatType } from '../../types/media';
import { FORMAT_META_MAP } from '../../utils/formatDetector';
import { PlayerControls } from './PlayerControls';
import { ThreeCanvas } from './ThreeCanvas';

interface VRPlayerModalProps {
  file: DriveFile;
  isSwReady: boolean;
  onClose: () => void;
}

export function VRPlayerModal({ file, isSwReady, onClose }: VRPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const vrTriggerRef = useRef<(() => Promise<void>) | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [format, setFormat] = useState<VideoFormatType>(file.detectedFormat);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [anaglyphEnabled, setAnaglyphEnabled] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [isWebXRSupported, setIsWebXRSupported] = useState(false);
  const [isInVR, setIsInVR] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const streamUrl = `/drive-stream/${encodeURIComponent(file.id)}?v=${reloadNonce}`;

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3200);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // ESC 키 및 스페이스바 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.paused) {
          void vid.play();
        } else {
          vid.pause();
        }
        resetHideTimer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, resetHideTimer]);

  const setVideoRefCallback = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
  }, []);

  const handleTogglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play().catch((err) => {
        setStreamError(
          err instanceof Error ? `재생 시작 실패: ${err.message}` : '영상을 재생할 수 없습니다.'
        );
      });
    } else {
      vid.pause();
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const handleSeek = useCallback(
    (time: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      vid.currentTime = time;
      setCurrentTime(time);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  const handleSkip = useCallback(
    (delta: number) => {
      const vid = videoRef.current;
      if (!vid) return;
      const next = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + delta));
      vid.currentTime = next;
      setCurrentTime(next);
      resetHideTimer();
    },
    [resetHideTimer]
  );

  const handleVolumeChange = useCallback((nextVol: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = nextVol;
    vid.muted = nextVol === 0;
    setVolume(nextVol);
    setIsMuted(nextVol === 0);
  }, []);

  const handleToggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  }, []);

  const handleToggleGyro = useCallback(async () => {
    if (
      !gyroEnabled &&
      typeof DeviceOrientationEvent !== 'undefined' &&
      'requestPermission' in DeviceOrientationEvent &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      try {
        const res = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (res !== 'granted') return;
      } catch {
        return;
      }
    }
    setGyroEnabled((prev) => !prev);
  }, [gyroEnabled]);

  const handleToggleVR = useCallback(() => {
    if (vrTriggerRef.current) {
      void vrTriggerRef.current().catch((err) => {
        setStreamError(
          err instanceof Error ? `WebXR 진입 실패: ${err.message}` : 'VR 모드를 시작할 수 없습니다.'
        );
      });
    }
  }, []);

  const updateBuffered = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.duration || vid.buffered.length === 0) return;
    const end = vid.buffered.end(vid.buffered.length - 1);
    setBufferedPercent((end / vid.duration) * 100);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* 숨겨진 HTML5 Video 스트림 소스 */}
      {isSwReady && (
        <video
          ref={setVideoRefCallback}
          src={streamUrl}
          crossOrigin="anonymous"
          playsInline
          autoPlay
          preload="auto"
          className="hidden"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            setStreamError(null);
          }}
          onCanPlay={() => {
            setIsBuffering(false);
            setStreamError(null);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => {
            setCurrentTime(e.currentTarget.currentTime);
            updateBuffered();
          }}
          onProgress={updateBuffered}
          onError={() => {
            setIsBuffering(false);
            setStreamError(
              '영상 스트리밍을 불러오는 중 오류가 발생했습니다. 네트워크 상태나 로그인 토큰 만료 여부를 확인해 주세요.'
            );
          }}
        />
      )}

      {/* 상단 HUD 헤더 */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-4 bg-gradient-to-b from-black/85 to-transparent px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                  FORMAT_META_MAP[format].badgeClass
                }`}
              >
                {FORMAT_META_MAP[format].shortLabel}
              </span>
              <h2 className="truncate text-sm font-semibold text-white sm:text-base">
                {file.name}
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              드래그로 시점 회전 · 마우스 휠로 시야각(FOV) 줌 · ESC로 닫기
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="플레이어 닫기"
            className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-slate-200 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Three.js 3D/VR 캔버스 */}
      <div className="relative flex-1 overflow-hidden">
        <ThreeCanvas
          videoElement={videoElement}
          format={format}
          anaglyphEnabled={anaglyphEnabled}
          gyroEnabled={gyroEnabled}
          onWebXRSupportChange={setIsWebXRSupported}
          onSessionStateChange={setIsInVR}
          vrTriggerRef={vrTriggerRef}
        />

        {/* 버퍼링 인디케이터 */}
        {isBuffering && !streamError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <span className="text-xs font-medium text-slate-200">
              Google Drive 스트림 연결 중...
            </span>
          </div>
        )}

        {/* 스트림 오류 안내 */}
        {streamError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
            <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/95 p-6 text-center shadow-2xl">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
              <h3 className="text-base font-semibold text-white">재생 오류</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{streamError}</p>
              <div className="mt-5 flex justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStreamError(null);
                    setIsBuffering(true);
                    setReloadNonce((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>다시 시도</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 컨트롤 HUD */}
      <PlayerControls
        visible={controlsVisible}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        bufferedPercent={bufferedPercent}
        volume={volume}
        isMuted={isMuted}
        format={format}
        anaglyphEnabled={anaglyphEnabled}
        gyroEnabled={gyroEnabled}
        isWebXRSupported={isWebXRSupported}
        isInVR={isInVR}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onSkip={handleSkip}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onFormatChange={setFormat}
        onToggleAnaglyph={() => setAnaglyphEnabled((prev) => !prev)}
        onToggleGyro={handleToggleGyro}
        onToggleVR={handleToggleVR}
      />
    </div>
  );
}
