import fetch from 'node-fetch';
import { logger } from './logger';

const FRIBB_URL =
  'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json';

interface FribbEntry {
  kitsu_id?: number;
  mal_id?: number;
  anilist_id?: number;
  imdb_id?: string;
  thetvdb_id?: number;
  themoviedb_id?: number;
}

interface AnimeInfo {
  imdbId: string;
  malId?: number;
  anilistId?: number;
  thetvdbId?: number;
}

const kitsuMap = new Map<string, AnimeInfo>();
let loaded = false;

async function load(): Promise<void> {
  if (loaded) return;
  try {
    const res = await fetch(FRIBB_URL, { headers: { 'User-Agent': 'stremio-autosub' } });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'could not fetch Fribb anime-list');
      return;
    }
    const data = (await res.json()) as FribbEntry[];
    for (const entry of data) {
      if (!entry.kitsu_id) continue;
      const imdbId = entry.imdb_id ?? '';
      kitsuMap.set(String(entry.kitsu_id), {
        imdbId,
        malId: entry.mal_id,
        anilistId: entry.anilist_id,
        thetvdbId: entry.thetvdb_id,
      });
    }
    loaded = true;
    logger.info({ count: kitsuMap.size }, 'anime-list loaded');
  } catch (e) {
    logger.warn({ err: e }, 'anime-list load failed');
  }
}

// Start loading immediately on module import.
load().catch(() => {});

export function getAnimeInfoByKitsu(kitsuId: string): AnimeInfo | null {
  return kitsuMap.get(kitsuId) ?? null;
}

export function reloadAnimeList(): Promise<void> {
  loaded = false;
  return load();
}
