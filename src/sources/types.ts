export interface ParsedId {
  imdbId: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  isAnime: boolean;
  kitsuId?: string;
}

export interface RawSubtitle {
  source: 'opensubtitles' | 'subdl' | 'wyzie';
  sourceId: string;
  lang: string;
  releaseName?: string;
  fps?: number;
  matchedHash?: boolean;
  downloadUrl?: string;
  inlineContent?: string;
}

export interface ResolvedSubtitle {
  source: 'opensubtitles' | 'subdl' | 'wyzie';
  sourceId: string;
  lang: string;
  releaseName?: string;
  fps?: number;
  matchedHash?: boolean;
  content: string;
}
