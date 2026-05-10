import fetch from 'node-fetch';
import { logger } from '../util/logger';
import type { ParsedId, RawSubtitle } from './types';

const BASE = 'https://sub.wyzie.ru';

interface WyzieHit {
  id?: string;
  url?: string;
  display?: string;
  language?: string;
  encoding?: string;
  isHearingImpaired?: boolean;
  source?: string;
}

function toIso3(lang?: string): string {
  const map: Record<string, string> = {
    ar: 'ara', en: 'eng', ja: 'jpn', fr: 'fre', de: 'ger',
    es: 'spa', it: 'ita', pt: 'por', nl: 'dut', ru: 'rus',
    tr: 'tur', he: 'heb', fa: 'per',
  };
  const l = (lang ?? '').toLowerCase().slice(0, 2);
  return map[l] ?? lang ?? 'und';
}

export async function searchWyzie(
  parsed: ParsedId,
  langs: string[],
): Promise<RawSubtitle[]> {
  const wyzieId =
    parsed.type === 'series' && parsed.season !== undefined && parsed.episode !== undefined
      ? `${parsed.imdbId}:${parsed.season}:${parsed.episode}`
      : parsed.imdbId;

  const wyzielangs = langs
    .map((l) => (l === 'ara' ? 'ar' : l === 'eng' ? 'en' : l))
    .join(',');

  try {
    const url = `${BASE}/search?id=${encodeURIComponent(wyzieId)}&language=${wyzielangs}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      logger.debug({ status: res.status }, 'wyzie returned non-200');
      return [];
    }
    const data = (await res.json()) as WyzieHit[] | { subtitles?: WyzieHit[] };

    const hits: WyzieHit[] = Array.isArray(data)
      ? data
      : (data as { subtitles?: WyzieHit[] }).subtitles ?? [];

    return hits
      .filter((h) => h.url)
      .map((h, i) => ({
        source: 'wyzie' as const,
        sourceId: h.id ?? `wyzie-${i}`,
        lang: toIso3(h.language),
        releaseName: h.display,
        matchedHash: false,
        downloadUrl: h.url,
      }));
  } catch (e) {
    logger.warn({ err: e }, 'wyzie search error');
    return [];
  }
}

export async function downloadWyzie(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.text();
  } catch (e) {
    logger.warn({ err: e, url }, 'wyzie download error');
    return null;
  }
}
