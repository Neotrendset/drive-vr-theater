import { useCallback, useEffect, useState } from 'react';
import type { DriveFile, DriveFolder } from '../types/media';
import { detectVideoFormat } from '../utils/formatDetector';

interface UseGoogleDriveOptions {
  accessToken: string | null;
  selectedFolderId: string;
  onUnauthorized?: () => void;
}

interface UseGoogleDriveResult {
  files: DriveFile[];
  folders: DriveFolder[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const FILE_FIELDS =
  'files(id,name,mimeType,size,thumbnailLink,videoMediaMetadata,createdTime,parents),nextPageToken';

export function useGoogleDrive({
  accessToken,
  selectedFolderId,
  onUnauthorized,
}: UseGoogleDriveOptions): UseGoogleDriveResult {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(
    async (token: string) => {
      const params = new URLSearchParams({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id,name)',
        orderBy: 'name',
        pageSize: '100',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });

      const res = await fetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error('인증이 만료되었습니다. 다시 로그인해 주세요.');
      }

      if (!res.ok) {
        throw new Error(`폴더 목록을 불러오지 못했습니다. (HTTP ${res.status})`);
      }

      const data = (await res.json()) as { files?: DriveFolder[] };
      setFolders(data.files ?? []);
    },
    [onUnauthorized]
  );

  const fetchVideos = useCallback(
    async (token: string, folderId: string, pageToken?: string | null) => {
      const queryParts = ["mimeType contains 'video/'", 'trashed = false'];
      if (folderId && folderId !== 'ALL') {
        const escaped = folderId.replace(/'/g, "\\'");
        queryParts.push(`'${escaped}' in parents`);
      }

      const params = new URLSearchParams({
        q: queryParts.join(' and '),
        fields: FILE_FIELDS,
        orderBy: 'modifiedTime desc',
        pageSize: '48',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const res = await fetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error('Google Drive 접근 토큰이 만료되었습니다. 다시 로그인해 주세요.');
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`영상 목록 조회 실패 (HTTP ${res.status})${errBody ? `: ${errBody}` : ''}`);
      }

      const data = (await res.json()) as {
        files?: Omit<DriveFile, 'detectedFormat'>[];
        nextPageToken?: string;
      };

      const mapped: DriveFile[] = (data.files ?? []).map((item) => ({
        ...item,
        detectedFormat: detectVideoFormat(item.name),
      }));

      return {
        items: mapped,
        nextToken: data.nextPageToken ?? null,
      };
    },
    [onUnauthorized]
  );

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setFiles([]);
      setFolders([]);
      setNextPageToken(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [videoRes] = await Promise.all([
        fetchVideos(accessToken, selectedFolderId, null),
        fetchFolders(accessToken).catch(() => undefined),
      ]);
      setFiles(videoRes.items);
      setNextPageToken(videoRes.nextToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedFolderId, fetchVideos, fetchFolders]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !nextPageToken || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const res = await fetchVideos(accessToken, selectedFolderId, nextPageToken);
      setFiles((prev) => [...prev, ...res.items]);
      setNextPageToken(res.nextToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, nextPageToken, isLoadingMore, selectedFolderId, fetchVideos]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    files,
    folders,
    isLoading,
    isLoadingMore,
    hasMore: Boolean(nextPageToken),
    error,
    refresh,
    loadMore,
  };
}
