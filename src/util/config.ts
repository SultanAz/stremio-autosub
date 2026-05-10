import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '7777', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  publicUrl: process.env.PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 7777}`,
  langs: (process.env.SUB_LANGS || 'ara,eng').split(',').map((s) => s.trim()).filter(Boolean),

  opensubtitles: {
    apiKey: process.env.OPENSUBTITLES_API_KEY || '',
    userAgent: process.env.OPENSUBTITLES_USER_AGENT || 'stremio-autosub v0.1.0',
    username: process.env.OPENSUBTITLES_USERNAME || '',
    password: process.env.OPENSUBTITLES_PASSWORD || '',
  },
  subdl: {
    apiKey: process.env.SUBDL_API_KEY || '',
  },
  wyzie: {
    apiKey: process.env.WYZIE_API_KEY || '',
  },
  upstash: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
};

export type Config = typeof config;
