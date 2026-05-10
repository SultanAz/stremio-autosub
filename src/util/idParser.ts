import type { ParsedId } from '../sources/types';

export function parseStremioId(type: string, rawId: string): ParsedId | null {
  if (rawId.startsWith('kitsu:')) {
    const parts = rawId.split(':');
    return {
      imdbId: '',
      type: 'series',
      season: parts[2] ? parseInt(parts[2], 10) : undefined,
      episode: parts[3] ? parseInt(parts[3], 10) : undefined,
      isAnime: true,
      kitsuId: parts[1],
    };
  }

  if (rawId.startsWith('tt')) {
    const parts = rawId.split(':');
    const imdbId = parts[0];
    if (type === 'series' && parts.length >= 3) {
      return {
        imdbId,
        type: 'series',
        season: parseInt(parts[1], 10),
        episode: parseInt(parts[2], 10),
        isAnime: false,
      };
    }
    return { imdbId, type: type === 'series' ? 'series' : 'movie', isAnime: false };
  }

  return null;
}

export function imdbNumeric(imdbId: string): string {
  return imdbId.replace(/^tt0*/, '');
}
