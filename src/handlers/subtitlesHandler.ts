import type { Args, Subtitle } from 'stremio-addon-sdk';
import { parseStremioId } from '../util/idParser';
import { getAnimeInfoByKitsu } from '../util/animeMapping';
import { aggregate } from '../sources/aggregator';
import { runPipeline } from '../sync/pipeline';
import { syncWithAlass } from '../sync/alassRunner';
import { cacheGet, cacheSet, withInFlight } from '../util/cache';
import { config } from '../util/config';
import { logger } from '../util/logger';

export interface SubtitlesArgs extends Args {
  type: string;
  id: string;
  extra?: {
    videoHash?: string;
    videoSize?: string | number;
    videoUrl?: string;
    filename?: string;
  };
}

export async function subtitlesHandler(args: SubtitlesArgs): Promise<{ subtitles: Subtitle[] }> {
  const { type, id, extra = {} } = args;
  const videoHash = extra.videoHash as string | undefined;
  const videoFilename = extra.filename as string | undefined;
  const videoUrl = extra.videoUrl as string | undefined;

  logger.info({ type, id, videoHash, hasVideoUrl: Boolean(videoUrl), filename: videoFilename }, 'subtitles request');

  const parsed = parseStremioId(type, id);
  if (!parsed) {
    logger.warn({ id }, 'could not parse id');
    return { subtitles: [] };
  }

  // Resolve kitsu → imdb for anime episodes.
  if (parsed.isAnime && parsed.kitsuId && !parsed.imdbId) {
    const info = getAnimeInfoByKitsu(parsed.kitsuId);
    if (info?.imdbId) {
      parsed.imdbId = info.imdbId;
      logger.debug({ kitsuId: parsed.kitsuId, imdbId: parsed.imdbId }, 'resolved kitsu→imdb');
    } else {
      logger.warn({ kitsuId: parsed.kitsuId }, 'no imdb mapping for kitsu id');
      return { subtitles: [] };
    }
  }

  if (!parsed.imdbId) {
    logger.warn({ id }, 'no imdb id available');
    return { subtitles: [] };
  }

  const langs = config.langs;
  const results: Subtitle[] = [];

  // Process each requested language independently.
  for (const lang of langs) {
    const cacheHit = videoHash ? cacheGet(videoHash, lang) : null;
    if (cacheHit) {
      results.push(makeSub(videoHash!, lang, cacheHit));
      continue;
    }

    // Run pipeline async — respond with whatever is ready within budget,
    // and cache results for immediate subsequent re-fetches.
    const fetchAndCache = () =>
      withInFlight(videoHash ?? id, lang, async () => {
        const candidates = await aggregate(parsed, [lang], videoHash);
        const langCandidates = candidates.filter((c) => c.lang === lang);
        if (!langCandidates.length) return null;

        const result = await runPipeline({ candidates: langCandidates, langs: [lang], videoFilename, videoHash });
        if (!result) return null;

        const content = result.resolved.content;
        if (videoHash) cacheSet(videoHash, lang, content);

        // Phase 6: if videoUrl is available (Desktop only), run alass in the background
        // and update the cache — next Stremio fetch gets the polished version.
        if (videoUrl && videoHash && !result.resolved.matchedHash) {
          setImmediate(() => {
            syncWithAlass(content, videoUrl)
              .then((synced) => {
                if (synced) {
                  cacheSet(videoHash, lang, synced);
                  logger.info({ lang }, 'alass polish stored in cache');
                }
              })
              .catch(() => {});
          });
        }

        return content;
      });

    // Give it up to 8 seconds — stay within Stremio's timeout window.
    const content = await Promise.race([
      fetchAndCache(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);

    if (content) {
      results.push(makeSub(videoHash ?? id.replace(/[^a-z0-9]/gi, ''), lang, content));
    }
  }

  logger.info({ count: results.length, langs: results.map((r) => r.lang) }, 'returning subtitles');
  return { subtitles: results };
}

function makeSub(hash: string, lang: string, content: string): Subtitle {
  const safeHash = hash.replace(/[^a-z0-9_-]/gi, '').slice(0, 48);
  const ts = Date.now();
  const key = `${safeHash}|${lang}|${ts}`;
  const url = `${config.publicUrl}/sub/${safeHash}/${lang}/${ts}.srt`;
  pendingSrts.set(key, content);
  setTimeout(() => pendingSrts.delete(key), 10 * 60 * 1000);
  return { id: `autosub-${safeHash}-${lang}`, url, lang };
}

// Short-lived key (hash|lang|ts) → SRT content, read by cacheRoutes.
export const pendingSrts = new Map<string, string>();
