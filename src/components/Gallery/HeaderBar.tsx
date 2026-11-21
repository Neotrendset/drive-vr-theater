import { FolderOpen, Glasses, LogOut, RefreshCw, Search, X } from 'lucide-react';
import type { DriveFolder, FilterCategory } from '../../types/media';

interface HeaderBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategory: FilterCategory;
  onCategoryChange: (cat: FilterCategory) => void;
  folders: DriveFolder[];
  selectedFolderId: string;
  onFolderChange: (folderId: string) => void;
  totalCount: number;
  filteredCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

const FILTER_TABS: Array<{ id: FilterCategory; label: string }> = [
  { id: 'ALL', label: '전체' },
  { id: '360', label: '360° VR' },
  { id: '180', label: '180° VR' },
  { id: '3D', label: '3D (SBS/OU)' },
  { id: '2D', label: '일반 2D' },
];

export function HeaderBar({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  folders,
  selectedFolderId,
  onFolderChange,
  totalCount,
  filteredCount,
  isLoading,
  onRefresh,
  onLogout,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F19]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* 상단 줄: 브랜드 로고, 검색, 폴더 드롭다운, 액션 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
              <Glasses className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                DriveVR Theater
              </h1>
              <p className="text-[11px] text-slate-400">
                표시 {filteredCount}개 / 전체 {totalCount}개
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
            {/* 실시간 검색 */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="영상 파일명 검색..."
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2 pr-8 pl-9 text-sm text-slate-100 placeholder-slate-500 transition focus:border-indigo-500/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="검색어 지우기"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* 폴더 선택 드롭다운 */}
            <div className="relative flex items-center">
              <FolderOpen className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <select
                value={selectedFolderId}
                onChange={(e) => onFolderChange(e.target.value)}
                aria-label="Google Drive 폴더 필터"
                className="max-w-[180px] appearance-none rounded-xl border border-white/10 bg-slate-900/80 py-2 pr-7 pl-9 text-sm text-slate-200 transition focus:border-indigo-500/60 focus:outline-none"
              >
                <option value="ALL">모든 드라이브 폴더</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 새로고침 */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="목록 새로고침"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 p-2 text-slate-300 transition hover:border-white/20 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* 로그아웃 */}
            <button
              type="button"
              onClick={onLogout}
              title="로그아웃"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>

        {/* 하단 줄: 포맷별 빠른 필터 탭 */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-0.5" aria-label="포맷 필터">
          {FILTER_TABS.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onCategoryChange(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
