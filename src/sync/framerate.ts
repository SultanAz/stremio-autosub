import { parseSrt, serializeSrt, rescaleSrt } from '../util/srt';
import { logger } from '../util/logger';

const COMMON_FRAMERATES = [23.976, 24, 25, 29.97, 30];

function detectFpsFromName(name?: string): number | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('25fps') || lower.includes('.pal.') || lower.match(/\bpal\b/)) return 25;
  if (lower.includes('23.976') || lower.includes('23976')) return 23.976;
  if (lower.includes('29.97') || lower.includes('29970')) return 29.97;
  if (lower.includes('24fps') || lower.includes('.24.')) return 24;
  return null;
}

function detectFpsFromVideoRelease(videoFilename?: string): number | null {
  if (!videoFilename) return null;
  const lower = videoFilename.toLowerCase();
  if (lower.includes('bluray') || lower.includes('blu-ray') || lower.includes('bdrip')) return 23.976;
  if (lower.includes('web-dl') || lower.includes('webdl') || lower.includes('webrip')) return 23.976;
  if (lower.includes('hdtv') && (lower.includes('uk') || lower.includes('pal'))) return 25;
  if (lower.includes('dvdrip') && (lower.includes('uk') || lower.includes('pal'))) return 25;
  return null;
}

function closestStandardFps(fps: number): number {
  return COMMON_FRAMERATES.reduce((prev, curr) =>
    Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev,
  );
}

export function applyFramerateCorrection(
  srtContent: string,
  subFps: number | undefined,
  subReleaseName: string | undefined,
  videoFilename: string | undefined,
): string {
  const fromFps =
    subFps ??
    detectFpsFromName(subReleaseName) ??
    null;

  const toFps = detectFpsFromVideoRelease(videoFilename);

  if (!fromFps || !toFps) return srtContent;

  const from = closestStandardFps(fromFps);
  const to = closestStandardFps(toFps);

  if (Math.abs(from - to) < 0.1) return srtContent;

  logger.info({ from, to }, 'applying framerate correction');
  const entries = parseSrt(srtContent);
  return serializeSrt(rescaleSrt(entries, from, to));
}
