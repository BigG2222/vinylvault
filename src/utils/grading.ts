import type { Grade } from '../types';

/** Goldmine scale, best first. */
export const GRADES: Grade[] = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];

export const GRADE_LABELS: Record<Grade, string> = {
  M: 'Mint',
  NM: 'Near Mint',
  'VG+': 'Very Good Plus',
  VG: 'Very Good',
  'G+': 'Good Plus',
  G: 'Good',
  F: 'Fair',
  P: 'Poor',
};

/** One-line meaning of each grade, shown in the condition panel. */
export const GRADE_MEANING: Record<Grade, string> = {
  M: 'Unplayed, perfect. Rarely used for anything opened.',
  NM: 'Nearly perfect. No obvious wear; may have been played a few times.',
  'VG+': 'Light signs of play, such as faint scuffs, that should not affect the sound much.',
  VG: 'Visible surface wear and light scratches; some surface noise is likely.',
  'G+': 'Heavy wear but plays through without skipping. Noticeable noise.',
  G: 'Heavily worn; noise throughout but still plays.',
  F: 'Badly damaged; may skip or repeat.',
  P: 'Barely playable or unplayable.',
};

/** Exact grade names used by the Discogs marketplace (and its price-suggestion keys). */
export const DISCOGS_GRADE_NAMES: Record<Grade, string> = {
  M: 'Mint (M)',
  NM: 'Near Mint (NM or M-)',
  'VG+': 'Very Good Plus (VG+)',
  VG: 'Very Good (VG)',
  'G+': 'Good Plus (G+)',
  G: 'Good (G)',
  F: 'Fair (F)',
  P: 'Poor (P)',
};

export function isGrade(v: unknown): v is Grade {
  return typeof v === 'string' && (GRADES as string[]).includes(v);
}

export function gradeIndex(g: Grade): number {
  return GRADES.indexOf(g);
}

/** 0–1 position on the scale (M = 1, P = 0), for meters. */
export function gradeScore(g: Grade): number {
  return 1 - gradeIndex(g) / (GRADES.length - 1);
}

/** Value relative to a Near Mint copy, following the usual Goldmine rule of thumb (VG+ about half of NM, VG about a quarter to a third). */
export const GRADE_VALUE_FACTOR: Record<Grade, number> = {
  M: 1.25,
  NM: 1,
  'VG+': 0.6,
  VG: 0.35,
  'G+': 0.2,
  G: 0.15,
  F: 0.08,
  P: 0.04,
};

/** Each grade the sleeve sits below the media knocks some value off; a better sleeve adds nothing. */
export function sleeveFactor(media: Grade, sleeve: Grade): number {
  const gap = gradeIndex(sleeve) - gradeIndex(media);
  return gap <= 0 ? 1 : Math.max(0.55, Math.pow(0.88, gap));
}

/** Fill in a full price-by-grade table from whatever grades are known, scaling by the value factors. */
export function completeGradePrices(known: Partial<Record<Grade, number>>): Record<Grade, number> | null {
  const anchors = GRADES.filter((g) => typeof known[g] === 'number' && (known[g] as number) > 0);
  if (!anchors.length) return null;
  const out = {} as Record<Grade, number>;
  for (const g of GRADES) {
    if (anchors.includes(g)) {
      out[g] = known[g] as number;
      continue;
    }
    const nearest = anchors.reduce((a, b) => (Math.abs(gradeIndex(b) - gradeIndex(g)) < Math.abs(gradeIndex(a) - gradeIndex(g)) ? b : a));
    out[g] = ((known[nearest] as number) * GRADE_VALUE_FACTOR[g]) / GRADE_VALUE_FACTOR[nearest];
  }
  return out;
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

/**
 * Low / average / high for a copy in the given condition. The average is the
 * price for its media grade; low and high are the neighbouring grades, because
 * a photo-based grade can be one step off in either direction. The sleeve
 * scales the whole range. Never collapses to a single number.
 */
export function rangeForCondition(byGrade: Partial<Record<Grade, number>>, media: Grade, sleeve: Grade): { low: number; avg: number; high: number } | null {
  const table = completeGradePrices(byGrade);
  if (!table) return null;
  const i = gradeIndex(media);
  const sf = sleeveFactor(media, sleeve);
  const avg = table[media] * sf;
  let low = (i < GRADES.length - 1 ? table[GRADES[i + 1]] : table[media] * 0.6) * sf;
  let high = (i > 0 ? table[GRADES[i - 1]] : table[media] * 1.2) * sf;
  // Flat or inverted suggestions (it happens on thinly traded releases): fall back to a sensible spread.
  if (!(low < avg)) low = avg * 0.8;
  if (!(high > avg)) high = avg * 1.25;
  return { low: round(low), avg: round(avg), high: round(high) };
}
