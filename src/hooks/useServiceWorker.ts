import { useCallback, useEffect, useState } from 'react';

interface UseServiceWorkerResult {
  isReady: boolean;
  isTokenSynced: boolean;
  swError: string | null;
  syncToken: (token: string | null) => Promise<boolean>;
}

function postMessageWithAck(
  worker: ServiceWorker,
  payload: Record<string, unknown>
): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(true), 1000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(Boolean(event.data?.ok));
    };
    worker.postMessage(payload, [channel.port2]);
  });
}

async function waitForController(timeoutMs = 3000): Promise<ServiceWorker | null> {
  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.controller;
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(navigator.serviceWorker.controller);
    }, timeoutMs);

    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        window.clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve(navigator.serviceWorker.controller);
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

export function useServiceWorker(accessToken: string | null): UseServiceWorkerResult {
  const [isReady, setIsReady] = useState(false);
  const [isTokenSynced, setIsTokenSynced] = useState(false);
  const [swError, setSwError] = useState<string | null>(null);

  const syncToken = useCallback(async (token: string | null): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const controller = await waitForController(2500);
      const targetWorker = controller || registration.active;
      if (!targetWorker) {
        setIsTokenSynced(false);
        return false;
      }

      const ok = await postMessageWithAck(
        targetWorker,
        token ? { type: 'SET_TOKEN', token } : { type: 'CLEAR_TOKEN' }
      );
      setIsTokenSynced(Boolean(token) && ok);
      return ok;
    } catch (err) {
      setSwError(err instanceof Error ? err.message : 'Service Worker 토큰 동기화 실패');
      setIsTokenSynced(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwError('이 브라우저는 Service Worker를 지원하지 않아 영상 스트리밍 프록시를 사용할 수 없습니다.');
      return;
    }

    let cancelled = false;

    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        await registration.update().catch(() => undefined);
        await navigator.serviceWorker.ready;
        await waitForController(2500);

        if (!cancelled) {
          setIsReady(true);
          setSwError(null);
          if (accessToken) {
            await syncToken(accessToken);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSwError(
            err instanceof Error
              ? `Service Worker 등록 실패: ${err.message}`
              : 'Service Worker 등록에 실패했습니다.'
          );
        }
      }
    };

    void registerSw();

    const handleControllerChange = () => {
      if (accessToken) {
        void syncToken(accessToken);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [accessToken, syncToken]);

  useEffect(() => {
    if (isReady) {
      void syncToken(accessToken);
    }
  }, [isReady, accessToken, syncToken]);

  return { isReady, isTokenSynced, swError, syncToken };
}
