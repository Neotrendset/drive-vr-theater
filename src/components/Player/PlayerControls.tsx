import {
  Compass,
  Eye,
  Glasses,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { VideoFormatType } from '../../types/media';
import { FORMAT_META_MAP, PLAYER_FORMAT_OPTIONS } from '../../utils/formatDetector';
import { formatDurationSeconds } from '../../utils/formatters';

interface PlayerControlsProps {
  visible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  volume: number;
  isMuted: boolean;
  format: VideoFormatType;
  anaglyphEnabled: boolean;
  gyroEnabled: boolean;
  isWebXRSupported: boolean;
  isInVR: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onFormatChange: (format: VideoFormatType) => void;
  onToggleAnaglyph: () => void;
  onToggleGyro: () => void;
  onToggleVR: () => void;
}

export function PlayerControls({
  visible,
  isPlaying,
  currentTime,
  duration,
  bufferedPercent,
  volume,
  isMuted,
  format,
  anaglyphEnabled,
  gyroEnabled,
  isWebXRSupported,
  isInVR,
  onTogglePlay,
  onSeek,
  onSkip,
  onVolumeChange,
  onToggleMute,
  onFormatChange,
  onToggleAnaglyph,
  onToggleGyro,
  onToggleVR,
}: PlayerControlsProps) {
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const isStereo = FORMAT_META_MAP[format].isStereo;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-gradient-to-t from-black/90 via-black/65 to-transparent px-4 pt-12 pb-5 sm:px-6">
        <div
          className={`mx-auto max-w-5xl space-y-3 ${
            visible ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* 타임라인 프로그레스 바 */}
          <div className="group relative flex h-5 items-center">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover:h-2">
              <div
                className="absolute inset-y-0 left-0 bg-white/30"
                style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={duration > 0 ? currentTime : 0}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="영상 재생 위치"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          {/* 하단 컨트롤 버튼 행 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 좌측: 재생/일시정지, 10초 이동, 볼륨, 시간 */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? '일시정지' : '재생'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md transition hover:bg-indigo-400"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSkip(-10)}
                title="10초 뒤로"
                className="rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onSkip(10)}
                title="10초 앞으로"
                className="rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {/* 볼륨 */}
              <div className="hidden items-center gap-1.5 sm:flex">
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={isMuted ? '음소거 해제' : '음소거'}
                  className="rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  aria-label="볼륨"
                  className="h-1 w-20 accent-indigo-500"
                />
              </div>

              <span className="font-mono text-xs text-slate-300">
                {formatDurationSeconds(currentTime)} / {formatDurationSeconds(duration)}
              </span>
            </div>

            {/* 우측: 포맷 전환, 적청 3D, 자이로, Enter VR */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={format}
                onChange={(e) => onFormatChange(e.target.value as VideoFormatType)}
                aria-label="VR/3D 포맷 선택"
                className="rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-100 focus:border-indigo-400 focus:outline-none"
              >
                {PLAYER_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {isStereo && (
                <button
                  type="button"
                  onClick={onToggleAnaglyph}
                  title="적청(Anaglyph) 3D 입체 모드"
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    anaglyphEnabled
                      ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">적청 3D</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleGyro}
                title="자이로스코프 시점 연동"
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  gyroEnabled
                    ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">자이로</span>
              </button>

              <button
                type="button"
                onClick={onToggleVR}
                disabled={!isWebXRSupported}
                title={
                  isWebXRSupported
                    ? 'WebXR VR 헤드셋 모드 진입'
                    : '현재 브라우저/기기에서 WebXR을 지원하지 않습니다'
                }
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isInVR
                    ? 'border-rose-400/50 bg-rose-500/25 text-rose-200'
                    : isWebXRSupported
                      ? 'border-indigo-400/50 bg-indigo-500/25 text-indigo-100 hover:bg-indigo-500/40'
                      : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-500'
                }`}
              >
                <Glasses className="h-3.5 w-3.5" />
                <span>{isInVR ? 'Exit VR' : 'Enter VR'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
