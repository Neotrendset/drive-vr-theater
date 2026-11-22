const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export async function onRequest(context) {
  const { request, params } = context;
  const fileId = params.fileId;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      },
    });
  }

  if (!fileId) {
    return new Response('Missing fileId', { status: 400 });
  }

  if (fileId === '__health') {
    return new Response(JSON.stringify({ ok: true, via: 'cloudflare-edge-stream' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Unauthorized: missing token', { status: 401 });
  }

  const targetUrl = `${DRIVE_API_BASE}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`;
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);

  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) {
    headers.set('Range', rangeHeader);
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
    });

    const responseHeaders = new Headers();
    const passThrough = [
      'Content-Type',
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'ETag',
      'Last-Modified',
    ];

    for (const key of passThrough) {
      const val = upstream.headers.get(key);
      if (val) responseHeaders.set(key, val);
    }

    if (!responseHeaders.has('Accept-Ranges')) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    const fallbackMime = url.searchParams.get('mime');
    const currentType = responseHeaders.get('Content-Type') || '';
    if (fallbackMime && (!currentType || currentType.includes('octet-stream'))) {
      responseHeaders.set('Content-Type', fallbackMime);
    }

    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy error';
    return new Response(`Cloudflare edge stream failed: ${message}`, { status: 502 });
  }
}
