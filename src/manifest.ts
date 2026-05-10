import type { Manifest } from 'stremio-addon-sdk';

export const manifest: Manifest = {
  id: 'community.stremio-autosub',
  version: '0.1.0',
  name: 'AutoSub Subtitles',
  description:
    'إضافة ترجمة عربية متعددة المصادر مع مزامنة تلقائية لكل حلقة (hash + release + framerate + alass).',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  catalogs: [],
  idPrefixes: ['tt', 'kitsu'],
  behaviorHints: {
    configurable: false,
    configurationRequired: false,
  } as Manifest['behaviorHints'],
};
