import { LRUCache } from 'lru-cache';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { logger } from './logger';

const CACHE_DIR = path.join(os.tmpdir(), 'autosub-cache');

fs.mkdirSync(CACHE_DIR, { recursive: true });

const memCache = new LRUCache<string, string>({
  max: 500,
  maxSize: 50 * 1024 * 1024,
  sizeCalculation: (v) => Buffer.byteLength(v, 'utf-8'),
});

// In-flight dedup: key → promise of SRT content
const inFlight = new Map<string, Promise<string | null>>();

function cacheKey(hash: string, lang: string): string {
  return `${hash}__${lang}`;
}

function diskPath(hash: string, lang: string): string {
  return path.join(CACHE_DIR, `${hash.slice(0, 2)}`, `${hash}__${lang}.srt`);
}

export function cacheGet(hash: string, lang: string): string | null {
  const key = cacheKey(hash, lang);
  const mem = memCache.get(key);
  if (mem) return mem;

  const file = diskPath(hash, lang);
  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      memCache.set(key, content);
      return content;
    } catch {
      return null;
    }
  }
  return null;
}

export function cacheSet(hash: string, lang: string, content: string): void {
  const key = cacheKey(hash, lang);
  memCache.set(key, content);
  const file = diskPath(hash, lang);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, content, 'utf-8');
  } catch (e) {
    logger.warn({ err: e }, 'disk cache write failed');
  }
}

export function withInFlight(
  hash: string,
  lang: string,
  fn: () => Promise<string | null>,
): Promise<string | null> {
  const key = cacheKey(hash, lang);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
