declare module 'stremio-addon-sdk' {
  import type { RequestHandler, Router } from 'express';

  export interface Manifest {
    id: string;
    version: string;
    name: string;
    description?: string;
    logo?: string;
    background?: string;
    contactEmail?: string;
    types: string[];
    resources: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
    catalogs?: unknown[];
    idPrefixes?: string[];
    behaviorHints?: {
      adult?: boolean;
      p2p?: boolean;
      configurable?: boolean;
      configurationRequired?: boolean;
    };
    config?: unknown[];
  }

  export interface Subtitle {
    id: string;
    url: string;
    lang: string;
    SubEncoding?: string;
    fps?: number;
    /** Optional: m=Movie, hi=Hearing impaired, etc. (non-standard) */
    [key: string]: unknown;
  }

  export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    [key: string]: unknown;
  }

  export interface Stream {
    url?: string;
    ytId?: string;
    infoHash?: string;
    fileIdx?: number;
    title?: string;
    description?: string;
    name?: string;
    [key: string]: unknown;
  }

  export interface Args {
    type: string;
    id: string;
    extra?: Record<string, string | number | undefined>;
    config?: Record<string, unknown>;
  }

  export type Handler<T> = (args: Args) => Promise<T>;

  export class addonBuilder {
    constructor(manifest: Manifest);
    defineCatalogHandler(handler: Handler<{ metas: MetaPreview[] }>): void;
    defineMetaHandler(handler: Handler<{ meta: MetaPreview }>): void;
    defineStreamHandler(handler: Handler<{ streams: Stream[] }>): void;
    defineSubtitlesHandler(handler: Handler<{ subtitles: Subtitle[] }>): void;
    defineResourceHandler(resource: string, handler: Handler<unknown>): void;
    getInterface(): AddonInterface;
  }

  export interface AddonInterface {
    manifest: Manifest;
    get: (resource: string, type: string, id: string, extra?: unknown) => Promise<unknown>;
  }

  export function serveHTTP(
    addonInterface: AddonInterface,
    options?: { port?: number; cache?: number; static?: string },
  ): Promise<{ url: string; server: unknown }>;

  export function getRouter(addonInterface: AddonInterface): Router & RequestHandler;

  export function publishToCentral(addonUrl: string): Promise<unknown>;
}
