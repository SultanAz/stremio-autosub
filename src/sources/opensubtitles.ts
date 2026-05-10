import fetch from 'node-fetch';
import { config } from '../util/config';
import { logger } from '../util/logger';
import type { ParsedId, RawSubtitle } from './types';

const BASE = 'https://api.opensubtitles.com/api/v1';

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  if (!config.opensubtitles.username || !config.opensubtitles.password) return null;
  if (_token && Date.now() < _tokenExpiry) return _token;
  try {
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        username: config.opensubtitles.username,
        password: config.opensubtitles.password,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    _token = json.token ?? null;
    _tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 h
    return _token;
  } catch (e) {
    logger.warn({ err: e }, 'opensubtitles login failed');
    return null;
  }
}

function headers(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {
    'Api-Key': config.opensubtitles.apiKey,
    'User-Agent': config.opensubtitles.userAgent,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

interface OSSearchHit {
  attributes: {
    subtitle_id?: string;
    language: string;
    release?: string;
    fps?: number;
    moviehash_match?: boolean;
    files?: Array<{ file_id: number; file_name?: string }>;
  };
}

async function search(params: URLSearchParams): Promise<OSSearchHit[]> {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE}/subtitles?${params}`, { headers: headers(token) });
    if (res.status === 429) {
      logger.warn('opensubtitles rate-limit hit');
      return [];
    }
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: OSSearchHit[] };
    return json.data ?? [];
  } catch (e) {
    logger.warn({ err: e }, 'opensubtitles search error');
    return [];
  }
}

export async function searchOpensubtitles(
  parsed: ParsedId,
  langs: string[],
  videoHash?: string,
): Promise<RawSubtitle[]> {
  if (!config.opensubtitles.apiKey) return [];

  const osLangs = langs
    .map((l) => (l === 'ara' ? 'ar' : l === 'eng' ? 'en' : l))
    .join(',');

  const params = new URLSearchParams({ languages: osLangs });

  if (parsed.type === 'movie') {
    params.set('imdb_id', parsed.imdbId.replace('tt', ''));
    params.set('type', 'movie');
  } else {
    params.set('imdb_id', parsed.imdbId.replace('tt', ''));
    params.set('type', 'episode');
    if (parsed.season !== undefined) params.set('season_number', String(parsed.season));
    if (parsed.episode !== undefined) params.set('episode_number', String(parsed.episode));
  }

  if (videoHash) {
    params.set('moviehash', videoHash);
    params.set('moviehash_match', 'include');
  }

  const hits = await search(params);

  return hits
    .filter((h) => h.attributes.files?.length)
    .map((h) => ({
      source: 'opensubtitles' as const,
      sourceId: String(h.attributes.files![0].file_id),
      lang: h.attributes.language === 'ar' ? 'ara' : h.attributes.language === 'en' ? 'eng' : h.attributes.language,
      releaseName: h.attributes.release,
      fps: h.attributes.fps,
      matchedHash: h.attributes.moviehash_match ?? false,
    }));
}

export async function downloadOpensubtitles(fileId: string): Promise<string | null> {
  try {
    const token = await getToken();
    const res = await fetch(`${BASE}/download`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ file_id: parseInt(fileId, 10) }),
    });
    if (res.status === 406) {
      logger.warn('opensubtitles daily download quota exhausted');
      return null;
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { link?: string };
    if (!json.link) return null;

    const dl = await fetch(json.link);
    if (!dl.ok) return null;
    return dl.text();
  } catch (e) {
    logger.warn({ err: e }, 'opensubtitles download error');
    return null;
  }
}
