import type { FilterCategory, VideoFormatType } from '../types/media';

export interface FormatMeta {
  code: VideoFormatType;
  label: string;
  shortLabel: string;
  category: Exclude<FilterCategory, 'ALL'>;
  badgeClass: string;
  is360: boolean;
  is180: boolean;
  isStereo: boolean;
  stereoLayout: 'NONE' | 'SBS' | 'OU';
}

export const FORMAT_META_MAP: Record<VideoFormatType, FormatMeta> = {
  '360_SBS': {
    code: '360_SBS',
    label: '360° 3D SBS',
    shortLabel: '360° SBS',
    category: '360',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
    is360: true,
    is180: false,
    isStereo: true,
    stereoLayout: 'SBS',
  },
  '360_OU': {
    code: '360_OU',
    label: '360° 3D OU',
    shortLabel: '360° OU',
    category: '360',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-400/30',
    is360: true,
    is180: false,
    isStereo: true,
    stereoLayout: 'OU',
  },
  '180_SBS': {
    code: '180_SBS',
    label: '180° 3D SBS',
    shortLabel: '180° SBS',
    category: '180',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
    is360: false,
    is180: true,
    isStereo: true,
    stereoLayout: 'SBS',
  },
  '360_2D': {
    code: '360_2D',
    label: '360° 파노라마',
    shortLabel: '360°',
    category: '360',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    is360: true,
    is180: false,
    isStereo: false,
    stereoLayout: 'NONE',
  },
  FLAT_SBS: {
    code: 'FLAT_SBS',
    label: '3D SBS (좌우)',
    shortLabel: '3D SBS',
    category: '3D',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    is360: false,
    is180: false,
    isStereo: true,
    stereoLayout: 'SBS',
  },
  FLAT_OU: {
    code: 'FLAT_OU',
    label: '3D OU (상하)',
    shortLabel: '3D OU',
    category: '3D',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    is360: false,
    is180: false,
    isStereo: true,
    stereoLayout: 'OU',
  },
  FLAT_2D: {
    code: 'FLAT_2D',
    label: '일반 2D',
    shortLabel: '2D',
    category: '2D',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
    is360: false,
    is180: false,
    isStereo: false,
    stereoLayout: 'NONE',
  },
};

export const PLAYER_FORMAT_OPTIONS: Array<{ value: VideoFormatType; label: string }> = [
  { value: 'FLAT_2D', label: '2D' },
  { value: '360_2D', label: '360°' },
  { value: '360_SBS', label: '360° SBS' },
  { value: '360_OU', label: '360° OU' },
  { value: '180_SBS', label: '180° SBS' },
  { value: 'FLAT_SBS', label: '3D SBS' },
  { value: 'FLAT_OU', label: '3D OU' },
];

const TOKEN_360 = /(?:^|[^0-9a-z])360(?:[^0-9a-z]|$)/i;
const TOKEN_180 = /(?:^|[^0-9a-z])180(?:[^0-9a-z]|$)/i;
const TOKEN_SBS = /(?:^|[^0-9a-z])(sbs|lr|3d[_\-\s]?lr|hsbs)(?:[^0-9a-z]|$)/i;
const TOKEN_OU = /(?:^|[^0-9a-z])(ou|tb|3d[_\-\s]?tb|hou|ab)(?:[^0-9a-z]|$)/i;

/**
 * 파일명의 키워드를 분석하여 VR/3D 재생 포맷을 자동 판별합니다.
 */
export function detectVideoFormat(fileName: string): VideoFormatType {
  const normalized = fileName.trim();
  const has360 = TOKEN_360.test(normalized) || /vr360|equirectangular/i.test(normalized);
  const has180 = TOKEN_180.test(normalized) || /vr180/i.test(normalized);
  const hasSBS = TOKEN_SBS.test(normalized);
  const hasOU = TOKEN_OU.test(normalized);

  if (has360 && hasSBS) return '360_SBS';
  if (has360 && hasOU) return '360_OU';
  if (has180 && hasSBS) return '180_SBS';
  if (has180) return '180_SBS';
  if (has360) return '360_2D';
  if (hasSBS) return 'FLAT_SBS';
  if (hasOU) return 'FLAT_OU';

  return 'FLAT_2D';
}

export function matchesFilterCategory(
  format: VideoFormatType,
  category: FilterCategory
): boolean {
  if (category === 'ALL') return true;
  const meta = FORMAT_META_MAP[format];
  if (category === '3D') {
    return meta.isStereo;
  }
  return meta.category === category;
}
