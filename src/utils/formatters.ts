/**
 * 바이트 단위 파일 크기를 읽기 쉬운 문자열(GB/MB/KB)로 변환합니다.
 */
export function formatBytes(bytesInput?: string | number): string {
  if (bytesInput === undefined || bytesInput === null || bytesInput === '') {
    return '용량 미상';
  }
  const bytes = typeof bytesInput === 'string' ? Number(bytesInput) : bytesInput;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** idx;
  return `${value >= 100 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

/**
 * 초 단위 시간을 HH:MM:SS 또는 MM:SS 형식으로 변환합니다.
 */
export function formatDurationSeconds(secondsInput?: number): string {
  if (secondsInput === undefined || !Number.isFinite(secondsInput) || secondsInput < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(secondsInput);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Google Drive durationMillis 문자열을 HH:MM:SS / MM:SS 형식으로 변환합니다.
 */
export function formatDurationMillis(millisInput?: string): string | null {
  if (!millisInput) return null;
  const ms = Number(millisInput);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return formatDurationSeconds(ms / 1000);
}

/**
 * 영상 해상도 문자열을 반환합니다.
 */
export function formatResolution(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  return `${width}×${height}`;
}

/**
 * Google Drive 썸네일 링크의 크기 파라미터(=s220 등)를 고해상도(=s640)로 치환합니다.
 */
export function enhanceThumbnailUrl(thumbnailLink?: string): string | undefined {
  if (!thumbnailLink) return undefined;
  return thumbnailLink.replace(/=s\d+(-[a-zA-Z0-9]+)?$/, '=s640');
}
