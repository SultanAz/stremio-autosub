import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import { config } from '../util/config';
import { logger } from '../util/logger';
import type { ParsedId, RawSubtitle } from './types';

const BASE = 'https://api.subdl.com/api/v1/subtitles';
const DL_BASE = 'https://dl.subdl.com';

const LANG_MAP: Record<string, string> = {
  ara: 'AR',
  eng: 'EN',
  jpn: 'JA',
  fre: 'FR',
  ger: 'DE',
  spa: 'ES',
  ita: 'IT',
  por: 'PT',
  dut: 'NL',
  rus: 'RU',
  tur: 'TR',
  heb: 'HE',
  per: 'FA',
};

const LANG_BACK: Record<string, string> = {
  Arabic: 'ara',
  English: 'eng',
  Japanese: 'jpn',
  French: 'fre',
  German: 'ger',
  Spanish: 'spa',
  Italian: 'ita',
  Portuguese: 'por',
  Dutch: 'dut',
  Russian: 'rus',
  Turkish: 'tur',
  Hebrew: 'heb',
  Persian: 'per',
};

interface SubDLHit {
  release_name?: string;
  name?: string;
  lang?: string;
  url: string;
  sd_id?: number;
  fps?: string;
  season?: number;
  episode?: number;
  full_season?: boolean;
}

export async function searchSubDL(
  parsed: ParsedId,
  langs: string[],
): Promise<RawSubtitle[]> {
  if (!config.subdl.apiKey) return [];

  const sdLangs = langs
    .map((l) => LANG_MAP[l] ?? l.toUpperCase())
    .join(',');

  const params = new URLSearchParams({
    api_key: config.subdl.apiKey,
    languages: sdLangs,
    subs_per_page: '30',
    imdb_id: parsed.imdbId,
    type: parsed.type === 'movie' ? 'movie' : 'tv',
  });

  if (parsed.type === 'series') {
    if (parsed.season !== undefined) params.set('season_number', String(parsed.season));
    if (parsed.episode !== undefined) params.set('episode_number', String(parsed.episode));
  }

  try {
    const res = await fetch(`${BASE}?${params}`);
    if (!res.ok) {
      logger.warn({ status: res.status }, 'subdl search failed');
      return [];
    }
    const json = (await res.json()) as { status?: boolean; subtitles?: SubDLHit[] };
    if (!json.status || !json.subtitles) return [];

    return json.subtitles
      .filter((h) => h.url && !h.full_season)
      .map((h) => ({
        source: 'subdl' as const,
        sourceId: h.url,
        lang: LANG_BACK[h.lang ?? ''] ?? 'ara',
        releaseName: h.release_name ?? h.name,
        fps: h.fps ? parseFloat(h.fps) : undefined,
        matchedHash: false,
        downloadUrl: h.url,
      }));
  } catch (e) {
    logger.warn({ err: e }, 'subdl search error');
    return [];
  }
}

export async function downloadSubDL(urlPath: string): Promise<string | null> {
  const fullUrl = urlPath.startsWith('http') ? urlPath : `${DL_BASE}${urlPath}`;
  try {
    const res = await fetch(fullUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter((e) =>
      /\.(srt|ass|ssa)$/i.test(e.entryName),
    );
    if (!entries.length) return null;
    const chosen = entries.find((e) => /\.srt$/i.test(e.entryName)) ?? entries[0];
    return chosen.getData().toString('utf-8');
  } catch (e) {
    logger.warn({ err: e, url: fullUrl }, 'subdl download error');
    return null;
  }
}
