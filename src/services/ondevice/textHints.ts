import type { OcrHints } from './types';

const LABELS = [
  'apple', 'parlophone', 'emi', 'harvest', 'columbia', 'capitol', 'atlantic', 'elektra', 'blue note', 'verve',
  'impulse', 'motown', 'tamla', 'stax', 'island', 'virgin', 'warner bros', 'reprise', 'geffen', 'dgc', 'epic',
  'decca', 'rca', 'polydor', 'a&m', 'chrysalis', 'sire', 'factory', 'rough trade', 'sub pop', 'def jam',
  'tuff gong', 'ode', 'asylum', 'mercury', 'vertigo', 'immediate', 'stiff', '4ad', 'warp', 'interscope', 'aftermath',
];

const COUNTRIES: [RegExp, string][] = [
  [/made in (gt\.? ?britain|great britain|england|the uk|u\.?k\.?)/, 'UK'],
  [/(made|printed|manufactured) in (the )?u\.?s\.?a\.?/, 'US'],
  [/made in (the )?(eu|e\.u\.|european union)/, 'Europe'],
  [/made in (west )?germany/, 'Germany'],
  [/made in france|fabriqué en france/, 'France'],
  [/made in japan/, 'Japan'],
  [/made in (holland|the netherlands)/, 'Netherlands'],
  [/made in canada/, 'Canada'],
  [/made in italy/, 'Italy'],
  [/made in australia/, 'Australia'],
];

/** Letter prefixes that look like catalog numbers but are not. */
const NOT_CATALOG = new Set(['RPM', 'SIDE', 'NO', 'TRACK', 'STEREO', 'MONO', 'LP', 'BIEM', 'NCB', 'GEMA', 'ASCAP', 'BMI', 'SACEM', 'EP', 'CD', 'VOL']);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const uniq = <T,>(a: T[]) => Array.from(new Set(a));

export function extractHints(rawText: string): OcrHints {
  const text = rawText.replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const years = uniq((text.match(/\b(19[0-9]\d|20[0-3]\d)\b/g) ?? []).map(Number));
  const catalogNumbers = uniq(
    Array.from(text.matchAll(/\b([A-Z]{1,6})[- ]?(\d{2,6})(?:[- ](\d{1,3}))?\b/g))
      .filter((m) => !NOT_CATALOG.has(m[1]) && !/^(19|20)\d\d$/.test(m[2]))
      .map((m) => m[0].trim()),
  ).slice(0, 6);
  const labels = LABELS.filter((l) => new RegExp(`(^|[^a-z])${escapeRe(l)}([^a-z]|$)`).test(lower));
  const countries = uniq(COUNTRIES.filter(([re]) => re.test(lower)).map(([, c]) => c));
  const speeds = uniq(Array.from(lower.matchAll(/\b(33|45|78)(?: ?1\/3| ?⅓)? ?(?:rpm|r\.p\.m)/g)).map((m) => Number(m[1])));
  const channels = /\bstereo\b/.test(lower) ? 'stereo' : /\bmono(phonic)?\b/.test(lower) ? 'mono' : null;
  return { rawText: text, years, catalogNumbers, labels, countries, speeds, channels };
}

/** Merge hints from several photos (label and back cover). */
export function mergeHints(parts: (OcrHints | null)[]): OcrHints | null {
  const xs = parts.filter((p): p is OcrHints => p !== null);
  if (!xs.length) return null;
  return {
    rawText: xs.map((x) => x.rawText).join(' | '),
    years: uniq(xs.flatMap((x) => x.years)),
    catalogNumbers: uniq(xs.flatMap((x) => x.catalogNumbers)).slice(0, 8),
    labels: uniq(xs.flatMap((x) => x.labels)),
    countries: uniq(xs.flatMap((x) => x.countries)),
    speeds: uniq(xs.flatMap((x) => x.speeds)),
    channels: xs.find((x) => x.channels)?.channels ?? null,
  };
}
