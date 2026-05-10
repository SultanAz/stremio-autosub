import ptt from 'parse-torrent-title';
import type { RawSubtitle } from '../sources/types';

interface ParsedRelease {
  resolution?: string;
  quality?: string;
  codec?: string;
  group?: string;
  season?: number;
  episode?: number;
}

function parseRelease(name?: string): ParsedRelease {
  if (!name) return {};
  try {
    return ptt.parse(name) as ParsedRelease;
  } catch {
    return {};
  }
}

function score(videoRelease: ParsedRelease, subRelease: ParsedRelease): number {
  let s = 0;
  if (videoRelease.resolution && subRelease.resolution === videoRelease.resolution) s += 3;
  if (videoRelease.quality && subRelease.quality === videoRelease.quality) s += 2;
  if (videoRelease.codec && subRelease.codec === videoRelease.codec) s += 1;
  if (videoRelease.group && subRelease.group?.toLowerCase() === videoRelease.group?.toLowerCase()) s += 4;
  return s;
}

export function sortByRelease(
  candidates: RawSubtitle[],
  videoFilename?: string,
): RawSubtitle[] {
  if (!videoFilename) return candidates;
  const vparsed = parseRelease(videoFilename);
  if (!Object.keys(vparsed).length) return candidates;

  return [...candidates].sort((a, b) => {
    const sa = score(vparsed, parseRelease(a.releaseName));
    const sb = score(vparsed, parseRelease(b.releaseName));
    if (a.matchedHash !== b.matchedHash) return a.matchedHash ? -1 : 1;
    return sb - sa;
  });
}
