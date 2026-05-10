import express from 'express';
import { addonBuilder, getRouter } from 'stremio-addon-sdk';
import { manifest } from './manifest';
import { subtitlesHandler } from './handlers/subtitlesHandler';
import { createCacheRouter } from './handlers/cacheRoutes';
import { config } from './util/config';
import { logger } from './util/logger';

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(subtitlesHandler as Parameters<typeof builder.defineSubtitlesHandler>[0]);

const addonInterface = builder.getInterface();

const app = express();

app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: manifest.version });
});

// SDK router serves /manifest.json, /subtitles/:type/:id/:extra.json, etc.
app.use('/', getRouter(addonInterface));

// Custom routes for serving cached/synced SRTs and the install-time placeholder.
app.use('/', createCacheRouter());

app.listen(config.port, () => {
  logger.info(
    { port: config.port, publicUrl: config.publicUrl, langs: config.langs },
    `AutoSub addon listening — install URL: ${config.publicUrl}/manifest.json`,
  );
});
