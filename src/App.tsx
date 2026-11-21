import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Glasses, ShieldCheck, Sparkles, Wifi } from 'lucide-react';
import { GoogleLoginBtn } from './components/Auth/GoogleLoginBtn';
import { HeaderBar } from './components/Gallery/HeaderBar';
import { MediaGrid } from './components/Gallery/MediaGrid';
import { VRPlayerModal } from './components/Player/VRPlayerModal';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { useServiceWorker } from './hooks/useServiceWorker';
import type { DriveFile, FilterCategory } from './types/media';
import { matchesFilterCategory } from './utils/formatDetector';

const SESSION_TOKEN_KEY = 'drivevr_access_token';
const SESSION_EXPIRES_KEY = 'drivevr_token_expires_at';

function readStoredToken(): { token: string | null; expiresAt: number | null } {
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const expiresRaw = sessionStorage.getItem(SESSION_EXPIRES_KEY);
    const expiresAt = expiresRaw ? Number(expiresRaw) : null;
    if (token && expiresAt && Date.now() < expiresAt) {
      return { token, expiresAt };
    }
  } catch {
    // sessionStorage 접근 불가 환경 무시
  }
  return { token: null, expiresAt: null };
}

export function App() {
  const initial = useMemo(() => readStoredToken(), []);
  const [accessToken, setAccessToken] = useState<string | null>(initial.token);
  const [expiresAt, setExpiresAt] = useState<number | null>(initial.expiresAt);
  const [tokenExpiredNotice, setTokenExpiredNotice] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');
  const [selectedFolderId, setSelectedFolderId] = useState('ALL');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);

  const { isReady: isSwReady, swError } = useServiceWorker(accessToken);

  const handleLogout = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(accessToken);
      } catch {
        // revoke 실패 무시
      }
    }
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    } catch {
      // ignore
    }
    setAccessToken(null);
    setExpiresAt(null);
    setSelectedFile(null);
    setTokenExpiredNotice(false);
  }, [accessToken]);

  const handleUnauthorized = useCallback(() => {
    setTokenExpiredNotice(true);
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_EXPIRES_KEY);
    } catch {
      // ignore
    }
    setAccessToken(null);
    setExpiresAt(null);
  }, []);

  const handleTokenReceived = useCallback((token: string, expiresInSeconds: number) => {
    const nextExpiresAt = Date.now() + Math.max(60, expiresInSeconds - 60) * 1000;
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_EXPIRES_KEY, String(nextExpiresAt));
    } catch {
      // ignore
    }
    setAccessToken(token);
    setExpiresAt(nextExpiresAt);
    setTokenExpiredNotice(false);
  }, []);

  // 토큰 만료 타이머 체크
  useEffect(() => {
    if (!expiresAt || !accessToken) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      handleUnauthorized();
      return;
    }
    const timer = window.setTimeout(() => {
      handleUnauthorized();
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt, accessToken, handleUnauthorized]);

  const {
    files,
    folders,
    isLoading,
    isLoadingMore,
    hasMore,
    error: driveError,
    refresh,
    loadMore,
  } = useGoogleDrive({
    accessToken,
    selectedFolderId,
    onUnauthorized: handleUnauthorized,
  });

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((file) => {
      if (!matchesFilterCategory(file.detectedFormat, activeCategory)) {
        return false;
      }
      if (q && !file.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [files, activeCategory, searchQuery]);

  if (!accessToken) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12">
        {/* 배경 글로우 */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" />

        <div className="relative z-10 w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Glasses className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            DriveVR Theater
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
            Google Drive에 저장된 360° VR 및 3D 입체(SBS/OU) 영상을 다운로드 없이
            브라우저와 WebXR 헤드셋에서 바로 스트리밍 재생하세요.
          </p>

          {tokenExpiredNotice && (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-left text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>인증 세션이 만료되었습니다. 다시 연결해 주세요.</span>
            </div>
          )}

          <div className="mt-7">
            <GoogleLoginBtn onTokenReceived={handleTokenReceived} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <Wifi className="mb-1.5 h-4 w-4 text-indigo-400" />
              <p className="text-xs font-semibold text-slate-200">무중단 스트리밍</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Service Worker Range 프록시로 대용량 영상 즉시 탐색
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <Sparkles className="mb-1.5 h-4 w-4 text-violet-400" />
              <p className="text-xs font-semibold text-slate-200">포맷 자동 감지</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                360° / 180° / SBS / OU 파일명 자동 분류
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <ShieldCheck className="mb-1.5 h-4 w-4 text-emerald-400" />
              <p className="text-xs font-semibold text-slate-200">서버리스 보안</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                읽기 전용 권한으로 브라우저에서 직접 연결
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100">
      <HeaderBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onFolderChange={setSelectedFolderId}
        totalCount={files.length}
        filteredCount={filteredFiles.length}
        isLoading={isLoading}
        onRefresh={() => void refresh()}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {swError && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{swError}</span>
          </div>
        )}

        {driveError && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{driveError}</span>
            </div>
            <GoogleLoginBtn
              variant="compact"
              label="토큰 재발급"
              onTokenReceived={handleTokenReceived}
            />
          </div>
        )}

        <MediaGrid
          files={filteredFiles}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          onSelectFile={setSelectedFile}
          onLoadMore={() => void loadMore()}
        />
      </main>

      {selectedFile && (
        <VRPlayerModal
          file={selectedFile}
          isSwReady={isSwReady}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}

export default App;
