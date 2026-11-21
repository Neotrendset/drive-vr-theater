import { useState } from 'react';
import { Film, Play } from 'lucide-react';
import type { DriveFile } from '../../types/media';
import { FORMAT_META_MAP } from '../../utils/formatDetector';
import {
  enhanceThumbnailUrl,
  formatBytes,
  formatDurationMillis,
  formatResolution,
} from '../../utils/formatters';

interface MediaCardProps {
  file: DriveFile;
  onSelect: (file: DriveFile) => void;
}

export function MediaCard({ file, onSelect }: MediaCardProps) {
  const [imgError, setImgError] = useState(false);

  const meta = FORMAT_META_MAP[file.detectedFormat];
  const thumbnailUrl = enhanceThumbnailUrl(file.thumbnailLink);
  const duration = formatDurationMillis(file.videoMediaMetadata?.durationMillis);
  const resolution = formatResolution(
    file.videoMediaMetadata?.width,
    file.videoMediaMetadata?.height
  );
  const sizeLabel = formatBytes(file.size);

  return (
    <button
      type="button"
      onClick={() => onSelect(file)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 text-left transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-indigo-950/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
    >
      {/* 썸네일 영역 */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={file.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600">
            <Film className="h-10 w-10" />
            <span className="text-[11px] font-medium text-slate-500">미리보기 없음</span>
          </div>
        )}

        {/* 호버 재생 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition duration-200 group-hover:bg-black/35">
          <div className="flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-indigo-500/90 text-white opacity-0 shadow-lg transition duration-200 group-hover:scale-100 group-hover:opacity-100">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </div>
        </div>

        {/* 우측 상단 포맷 뱃지 */}
        <span
          className={`absolute top-2.5 right-2.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md ${meta.badgeClass}`}
        >
          {meta.shortLabel}
        </span>

        {/* 우측 하단 재생 시간 */}
        {duration && (
          <span className="absolute right-2.5 bottom-2.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-200">
            {duration}
          </span>
        )}
      </div>

      {/* 하단 메타데이터 */}
      <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
        <h3
          className="line-clamp-2 text-sm font-medium leading-snug text-slate-100 group-hover:text-white"
          title={file.name}
        >
          {file.name}
        </h3>

        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
          <span>{resolution ?? '해상도 정보 없음'}</span>
          <span className="font-mono text-slate-400">{sizeLabel}</span>
        </div>
      </div>
    </button>
  );
}
