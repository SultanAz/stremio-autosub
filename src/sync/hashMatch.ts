import type { RawSubtitle } from '../sources/types';

export function sortByHashMatch(candidates: RawSubtitle[]): RawSubtitle[] {
  return [...candidates].sort((a, b) => {
    if (a.matchedHash && !b.matchedHash) return -1;
    if (!a.matchedHash && b.matchedHash) return 1;
    return 0;
  });
}

export function hasExactHashMatch(candidates: RawSubtitle[]): boolean {
  return candidates.some((c) => c.matchedHash);
}
