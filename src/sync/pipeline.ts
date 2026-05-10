import { sortByHashMatch, hasExactHashMatch } from './hashMatch';
import { sortByRelease } from './releaseMatch';
import { applyFramerateCorrection } from './framerate';
import { resolveSubtitle } from '../sources/resolver';
import { logger } from '../util/logger';
import type { RawSubtitle, ResolvedSubtitle } from '../sources/types';

export interface PipelineInput {
  candidates: RawSubtitle[];
  langs: string[];
  videoFilename?: string;
  videoHash?: string;
}

export interface PipelineResult {
  resolved: ResolvedSubtitle;
  corrected: boolean;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult | null> {
  const { candidates, langs, videoFilename } = input;
  if (!candidates.length) return null;

  // Step 1: prioritise by hash, then by release-name match.
  const byLang = (sub: RawSubtitle) => langs.indexOf(sub.lang);
  let ranked = candidates;
  ranked = sortByHashMatch(ranked);
  ranked = sortByRelease(ranked, videoFilename);
  // Apply language preference order last (stable sort maintains hash/release ranking within same lang).
  ranked.sort((a, b) => {
    const la = byLang(a) === -1 ? 99 : byLang(a);
    const lb = byLang(b) === -1 ? 99 : byLang(b);
    return la - lb;
  });

  const immediate = hasExactHashMatch(ranked);

  // Try top N candidates, download first success.
  const toTry = ranked.slice(0, immediate ? 1 : 5);

  for (const raw of toTry) {
    const resolved = await resolveSubtitle(raw);
    if (!resolved) continue;

    // Step 2: If not a hash match, apply framerate correction.
    let finalContent = resolved.content;
    let corrected = false;
    if (!resolved.matchedHash) {
      const fixed = applyFramerateCorrection(
        resolved.content,
        resolved.fps,
        resolved.releaseName,
        videoFilename,
      );
      if (fixed !== resolved.content) {
        finalContent = fixed;
        corrected = true;
      }
    }

    logger.info(
      {
        source: resolved.source,
        lang: resolved.lang,
        release: resolved.releaseName,
        hashMatch: resolved.matchedHash,
        corrected,
      },
      'pipeline: selected subtitle',
    );

    return { resolved: { ...resolved, content: finalContent }, corrected };
  }

  return null;
}
