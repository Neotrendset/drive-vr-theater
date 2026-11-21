export type VideoFormatType =
  | '360_SBS'
  | '360_OU'
  | '180_SBS'
  | '360_2D'
  | 'FLAT_SBS'
  | 'FLAT_OU'
  | 'FLAT_2D';

export type FilterCategory = 'ALL' | '360' | '180' | '3D' | '2D';

export interface VideoMediaMetadata {
  width?: number;
  height?: number;
  durationMillis?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: VideoMediaMetadata;
  createdTime?: string;
  parents?: string[];
  detectedFormat: VideoFormatType;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface AuthUser {
  name?: string;
  email?: string;
  picture?: string;
}

export interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  user: AuthUser | null;
}
