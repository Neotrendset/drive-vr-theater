/* eslint-disable no-restricted-globals */
const STREAM_PREFIX = '/drive-stream/';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

let accessToken = null;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SET_TOKEN') {
    accessToken = data.token || null;
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ ok: true, hasToken: Boolean(accessToken) });
    }
  } else if (data.type === 'CLEAR_TOKEN') {
    accessToken = null;
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ ok: true, hasToken: false });
    }
  } else if (data.type === 'PING') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ ok: true, hasToken: Boolean(accessToken) });
    }
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 동일 출처의 /drive-stream/:fileId 요청만 가로챔
  if (url.origin === self.location.origin && url.pathname.startsWith(STREAM_PREFIX)) {
    event.respondWith(handleDriveStream(event.request, url));
  }
});

/**
 * Google Drive API v3 media 엔드포인트로 Range 및 Authorization 헤더를 전달합니다.
 * @param {Request} request
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleDriveStream(request, url) {
  const fileId = decodeURIComponent(url.pathname.slice(STREAM_PREFIX.length)).split('/')[0];

  if (!fileId) {
    return new Response('Missing fileId', { status: 400 });
  }

  if (!accessToken) {
    return new Response('Unauthorized: Google Drive access token is missing in Service Worker.', {
      status: 401,
    });
  }

  const targetUrl = `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${accessToken}`);

  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    });

    const responseHeaders = new Headers();
    const passThroughHeaders = [
      'Content-Type',
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'ETag',
      'Last-Modified',
      'Cache-Control',
    ];

    for (const key of passThroughHeaders) {
      const value = upstreamResponse.headers.get(key);
      if (value) {
        responseHeaders.set(key, value);
      }
    }

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Drive stream proxy error';
    return new Response(`Stream proxy failed: ${message}`, { status: 502 });
  }
}
