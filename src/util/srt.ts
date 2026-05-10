export function cleanSrtText(text: string): string {
  return (
    text
      .replace(/^﻿/, '')                // strip UTF-8 BOM
      .replace(/\\N/g, '\n')                 // ASS hard newline escape
      .replace(/\\n/gi, '\n')                // ASS soft newline escape
      .replace(/\\h/g, ' ')                  // ASS hard space
      .replace(/\{\\[^}]*\}/g, '')           // strip ASS inline override codes like {\an8}, {\b1}
      .replace(/<[^>]+>/g, '')               // strip HTML tags if any
      .trim()
  );
}

export interface SrtEntry {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

function timeToMs(t: string): number {
  const [h, m, rest] = t.split(':');
  const [s, ms] = rest.replace(',', '.').split('.');
  return (
    parseInt(h, 10) * 3600000 +
    parseInt(m, 10) * 60000 +
    parseInt(s, 10) * 1000 +
    parseInt((ms ?? '0').padEnd(3, '0'), 10)
  );
}

function msToTime(ms: number): string {
  const absMs = Math.max(0, Math.round(ms));
  const h = Math.floor(absMs / 3600000);
  const m = Math.floor((absMs % 3600000) / 60000);
  const s = Math.floor((absMs % 60000) / 1000);
  const rem = absMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(rem).padStart(3, '0')}`;
}

const TIME_RE = /(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/;

export function parseSrt(raw: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => TIME_RE.test(l));
    if (!timeLine) continue;
    const m = timeLine.match(TIME_RE)!;
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).join('\n').trim();
    const indexLine = lines[0].trim();
    entries.push({
      index: parseInt(indexLine, 10) || entries.length + 1,
      startMs: timeToMs(m[1]),
      endMs: timeToMs(m[2]),
      text: cleanSrtText(textLines),
    });
  }
  return entries;
}

export function serializeSrt(entries: SrtEntry[]): string {
  return entries
    .map((e, i) => `${i + 1}\n${msToTime(e.startMs)} --> ${msToTime(e.endMs)}\n${e.text}`)
    .join('\n\n') + '\n';
}

export function rescaleSrt(entries: SrtEntry[], fromFps: number, toFps: number): SrtEntry[] {
  const ratio = toFps / fromFps;
  return entries.map((e) => ({
    ...e,
    startMs: e.startMs * ratio,
    endMs: e.endMs * ratio,
  }));
}

export function shiftSrt(entries: SrtEntry[], offsetMs: number): SrtEntry[] {
  return entries.map((e) => ({
    ...e,
    startMs: e.startMs + offsetMs,
    endMs: e.endMs + offsetMs,
  }));
}

export function detectAssOrSrt(content: string): 'ass' | 'srt' {
  return content.trimStart().startsWith('[Script Info]') ? 'ass' : 'srt';
}

export function assToSrt(assContent: string): string {
  const lines = assContent.replace(/\r\n/g, '\n').split('\n');
  const entries: SrtEntry[] = [];

  const parseAssTime = (t: string): number => {
    const parts = t.split(':');
    const s = parseFloat(parts[2] ?? '0');
    return (
      parseInt(parts[0] ?? '0', 10) * 3600000 +
      parseInt(parts[1] ?? '0', 10) * 60000 +
      Math.floor(s) * 1000 +
      Math.round((s % 1) * 1000)
    );
  };

  const stripAss = (text: string) =>
    text.replace(/\{[^}]*\}/g, '').replace(/\\n/gi, '\n').replace(/\\h/gi, ' ').trim();

  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
    const parts = line.split(',');
    if (parts.length < 10) continue;
    const start = parseAssTime(parts[1]);
    const end = parseAssTime(parts[2]);
    const text = stripAss(parts.slice(9).join(','));
    if (text) entries.push({ index: entries.length + 1, startMs: start, endMs: end, text });
  }

  entries.sort((a, b) => a.startMs - b.startMs);
  return serializeSrt(entries);
}
