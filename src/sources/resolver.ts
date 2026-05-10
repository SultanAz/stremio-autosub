import { downloadOpensubtitles } from './opensubtitles';
import { downloadSubDL } from './subdl';
import { downloadWyzie } from './wyzie';
import { assToSrt, detectAssOrSrt } from '../util/srt';
import { logger } from '../util/logger';
import type { RawSubtitle, ResolvedSubtitle } from './types';

export async function resolveSubtitle(raw: RawSubtitle): Promise<ResolvedSubtitle | null> {
  let content: string | null = null;

  if (raw.inlineContent) {
    content = raw.inlineContent;
  } else if (raw.source === 'opensubtitles') {
    content = await downloadOpensubtitles(raw.sourceId);
  } else if (raw.source === 'subdl' && raw.downloadUrl) {
    content = await downloadSubDL(raw.downloadUrl);
  } else if (raw.source === 'wyzie' && raw.downloadUrl) {
    content = await downloadWyzie(raw.downloadUrl);
  }

  if (!content) return null;

  const fmt = detectAssOrSrt(content);
  const srtContent = fmt === 'ass' ? assToSrt(content) : content;

  if (!srtContent.trim()) {
    logger.warn({ source: raw.source, sourceId: raw.sourceId }, 'empty srt after conversion');
    return null;
  }

  logger.debug({ source: raw.source, lang: raw.lang, release: raw.releaseName }, 'downloaded subtitle');

  return { ...raw, content: srtContent };
}
