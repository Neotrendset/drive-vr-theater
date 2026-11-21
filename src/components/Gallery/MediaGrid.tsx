import { Film, Loader2 } from 'lucide-react';
import type { DriveFile } from '../../types/media';
import { MediaCard } from './MediaCard';

interface MediaGridProps {
  files: DriveFile[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onSelectFile: (file: DriveFile) => void;
  onLoadMore: () => void;
}

export function MediaGrid({
  files,
  isLoading,
  isLoadingMore,
  hasMore,
  onSelectFile,
  onLoadMore,
}: MediaGridProps) {
  if (isLoading && files.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50"
          >
            <div className="aspect-video w-full bg-slate-800/70" />
            <div className="space-y-2.5 p-3.5">
              <div className="h-4 w-3/4 rounded bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-800/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center">
        <Film className="mb-3 h-12 w-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">
          조건에 맞는 영상이 없습니다
        </h2>
        <p className="mt-1 max-w-md text-xs text-slate-400">
          검색어나 포맷 필터를 초기화하거나, Google Drive의 다른 폴더를 선택해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {files.map((file) => (
          <MediaCard key={file.id} file={file} onSelect={onSelectFile} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-indigo-400/40 hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isLoadingMore ? '불러오는 중...' : '영상 더 불러오기'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
