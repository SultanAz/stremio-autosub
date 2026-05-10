import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import fetch from 'node-fetch';
import { logger } from '../util/logger';

const ALASS_BIN =
  process.platform === 'linux'
    ? path.join(process.cwd(), 'bin', 'alass-linux-x86_64')
    : null;

function alassAvailable(): boolean {
  return Boolean(ALASS_BIN && fs.existsSync(ALASS_BIN));
}

async function downloadAudio(videoUrl: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-loglevel', 'error',
      '-ss', '0',
      '-i', videoUrl,
      '-t', '900',          // first 15 minutes is enough for speech detection
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      destPath,
    ]);
    ffmpeg.on('close', (code) => resolve(code === 0));
    ffmpeg.on('error', () => resolve(false));
  });
}

async function runAlass(
  videoOrAudioPath: string,
  inSrt: string,
  outSrt: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(ALASS_BIN!, [videoOrAudioPath, inSrt, outSrt]);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', (e) => {
      logger.warn({ err: e }, 'alass spawn error');
      resolve(false);
    });
  });
}

export async function syncWithAlass(
  srtContent: string,
  videoUrl: string,
): Promise<string | null> {
  if (!alassAvailable()) {
    logger.debug('alass binary not found, skipping audio sync');
    return null;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autosub-alass-'));
  const audioPath = path.join(tmpDir, 'audio.wav');
  const inSrtPath = path.join(tmpDir, 'in.srt');
  const outSrtPath = path.join(tmpDir, 'out.srt');

  try {
    fs.writeFileSync(inSrtPath, srtContent, 'utf-8');

    const audioOk = await downloadAudio(videoUrl, audioPath);
    if (!audioOk) {
      logger.warn({ videoUrl }, 'audio extraction failed, skipping alass');
      return null;
    }

    const alassOk = await runAlass(audioPath, inSrtPath, outSrtPath);
    if (!alassOk) {
      logger.warn('alass returned non-zero exit, skipping');
      return null;
    }

    const synced = fs.readFileSync(outSrtPath, 'utf-8');
    logger.info({ videoUrl }, 'alass sync completed');
    return synced;
  } catch (e) {
    logger.warn({ err: e }, 'alass pipeline error');
    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
