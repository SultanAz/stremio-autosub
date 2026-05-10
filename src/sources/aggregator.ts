import { searchOpensubtitles } from './opensubtitles';
import { searchSubDL } from './subdl';
import { searchWyzie } from './wyzie';
import { logger } from '../util/logger';
import type { ParsedId, RawSubtitle } from './types';

const BUDGET_MS = 6000;

export async function aggregate(
  parsed: ParsedId,
  langs: string[],
  videoHash?: string,
): Promise<RawSubtitle[]> {
  if (!parsed.imdbId) return [];

  const [osResult, sdlResult, wyzieResult] = await Promise.allSettled([
    withTimeout(searchOpensubtitles(parsed, langs, videoHash), BUDGET_MS, 'opensubtitles'),
    withTimeout(searchSubDL(parsed, langs), BUDGET_MS, 'subdl'),
    withTimeout(searchWyzie(parsed, langs), BUDGET_MS, 'wyzie'),
  ]);

  const os = osResult.status === 'fulfilled' ? osResult.value : [];
  const sdl = sdlResult.status === 'fulfilled' ? sdlResult.value : [];
  const wyzie = wyzieResult.status === 'fulfilled' ? wyzieResult.value : [];

  logger.debug(
    { os: os.length, subdl: sdl.length, wyzie: wyzie.length },
    'aggregator results',
  );

  // Deduplicate by releaseName to avoid the same release from multiple sources.
  const seen = new Set<string>();
  const all: RawSubtitle[] = [];
  // Priority: OS hash matches first (most reliable), then SubDL, then OS non-hash, then Wyzie.
  const ordered = [
    ...os.filter((s) => s.matchedHash),
    ...sdl,
    ...os.filter((s) => !s.matchedHash),
    ...wyzie,
  ];
  for (const sub of ordered) {
    const key = `${sub.lang}|${sub.releaseName?.toLowerCase().replace(/\s+/g, '') ?? sub.sourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      all.push(sub);
    }
  }

  return all;
}

function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out`)), ms),
    ),
  ]);
}
