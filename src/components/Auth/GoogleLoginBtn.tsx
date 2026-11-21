import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, RefreshCw, ShieldAlert } from 'lucide-react';
import type { GoogleTokenClient, GoogleTokenResponse } from '../../types/google';

interface GoogleLoginBtnProps {
  onTokenReceived: (token: string, expiresInSeconds: number) => void;
  variant?: 'hero' | 'compact';
  label?: string;
}

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

export function GoogleLoginBtn({
  onTokenReceived,
  variant = 'hero',
  label = 'Google Drive 연결하기',
}: GoogleLoginBtnProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const isConfigured =
    Boolean(clientId) && !clientId?.includes('your-google-oauth-client-id');

  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;

    const initClient = () => {
      if (!window.google?.accounts?.oauth2) return false;

      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId!,
        scope: DRIVE_READONLY_SCOPE,
        callback: (response: GoogleTokenResponse) => {
          setIsAuthenticating(false);
          if (response.error || !response.access_token) {
            setAuthError(
              response.error_description ||
                response.error ||
                'Google 인증 토큰을 발급받지 못했습니다.'
            );
            return;
          }
          setAuthError(null);
          onTokenReceived(response.access_token, response.expires_in || 3600);
        },
        error_callback: (err) => {
          setIsAuthenticating(false);
          setAuthError(err.message || '로그인 팝업이 닫혔거나 차단되었습니다.');
        },
      });
      setIsScriptReady(true);
      return true;
    };

    if (initClient()) return;

    const interval = window.setInterval(() => {
      if (initClient()) {
        window.clearInterval(interval);
      }
    }, 200);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 10000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [clientId, isConfigured, onTokenReceived]);

  const handleLogin = useCallback(() => {
    if (!tokenClientRef.current) {
      setAuthError('Google 인증 스크립트를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setAuthError(null);
    setIsAuthenticating(true);
    tokenClientRef.current.requestAccessToken({ prompt: '' });
  }, []);

  if (!isConfigured) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-100">
              Google OAuth 클라이언트 ID가 설정되지 않았습니다
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              프로젝트 루트의 <code className="rounded bg-black/30 px-1.5 py-0.5">.env.example</code>을
              참고해 <code className="rounded bg-black/30 px-1.5 py-0.5">.env</code> 파일을 만들고{' '}
              <code className="rounded bg-black/30 px-1.5 py-0.5">VITE_GOOGLE_CLIENT_ID</code>를
              입력한 뒤 개발 서버를 재시작해 주세요.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleLogin}
        disabled={!isScriptReady || isAuthenticating}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/20 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
        <span>{isAuthenticating ? '연결 중...' : label}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleLogin}
        disabled={!isScriptReady || isAuthenticating}
        className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0B0F19] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogIn className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        <span>
          {isAuthenticating
            ? 'Google 계정 인증 중...'
            : isScriptReady
              ? label
              : '인증 모듈 준비 중...'}
        </span>
      </button>

      {authError && (
        <p className="max-w-md text-center text-xs text-rose-400">{authError}</p>
      )}
    </div>
  );
}
