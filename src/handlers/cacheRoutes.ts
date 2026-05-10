import type { Request, Response, Router } from 'express';
import express from 'express';
import { pendingSrts } from './subtitlesHandler';
import { logger } from '../util/logger';

export function createCacheRouter(): Router {
  const router = express.Router();

  router.get('/sub/:hash/:lang/:id.srt', (req: Request, res: Response) => {
    const key = `${req.params.hash}|${req.params.lang}|${req.params.id}`;
    const content = pendingSrts.get(key);
    if (!content) {
      logger.debug({ key }, 'sub URL not found in cache');
      res.status(404).send('Subtitle not found or expired. Reload subtitles in Stremio.');
      return;
    }
    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(content);
  });

  return router;
}
