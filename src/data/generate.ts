import type { AuthCheck, AuthCheckId, CheckStatus, ConditionEstimate, ConditionIssue, Grade, GradeEstimate, PriceEstimate, RecordIdentity, SaleRecord } from '../types';
import { GRADES, GRADE_VALUE_FACTOR, rangeForCondition } from '../utils/grading';

/** Deterministic PRNG so placeholder data is stable across renders. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);

const MEDIA_ISSUES: Record<'NM' | 'VG+' | 'VG' | 'G+', ConditionIssue[]> = {
  NM: [],
  'VG+': [{ kind: 'scuffs', severity: 'light', note: 'A few faint hairline scuffs visible under the light on side A.' }],
  VG: [
    { kind: 'scratches', severity: 'light', note: 'Several light surface scratches across the first two tracks.' },
    { kind: 'spindle_marks', severity: 'light', note: 'Spindle marks around the center hole.' },
  ],
  'G+': [
    { kind: 'scratches', severity: 'moderate', note: 'Visible scratches you can catch with a fingernail on side B.' },
    { kind: 'warp', severity: 'light', note: 'The edge looks slightly dished in the side-on photo.' },
  ],
};

const SLEEVE_ISSUES: Record<'NM' | 'VG+' | 'VG' | 'G+', ConditionIssue[]> = {
  NM: [],
  'VG+': [{ kind: 'corner_wear', severity: 'light', note: 'Light wear on the top right corner.' }],
  VG: [
    { kind: 'ring_wear', severity: 'moderate', note: 'Ring wear visible on the front cover.' },
    { kind: 'writing', severity: 'light', note: 'Small name written in pen on the back.' },
  ],
  'G+': [
    { kind: 'seam_split', severity: 'moderate', note: 'About 5 cm seam split along the bottom edge.' },
    { kind: 'stickers', severity: 'light', note: 'Price sticker residue on the front.' },
  ],
};

const MEDIA_SUMMARY: Record<string, string> = {
  NM: 'Glossy surface with no visible marks.',
  'VG+': 'Light signs of play: a few faint scuffs, no scratches visible.',
  VG: 'Light surface scratches and spindle marks visible.',
  'G+': 'Noticeable scratches and a slight warp visible.',
};

const SLEEVE_SUMMARY: Record<string, string> = {
  NM: 'Sharp corners, no ring wear or splits.',
  'VG+': 'Minor corner wear only.',
  VG: 'Ring wear and a little writing, but complete and intact.',
  'G+': 'Seam split and sticker residue; still holds the record.',
};

function pickGrade(r: () => number): 'NM' | 'VG+' | 'VG' | 'G+' {
  const x = r();
  return x < 0.22 ? 'NM' : x < 0.62 ? 'VG+' : x < 0.88 ? 'VG' : 'G+';
}

function grade(g: 'NM' | 'VG+' | 'VG' | 'G+', issues: typeof MEDIA_ISSUES, summary: Record<string, string>, r: () => number): GradeEstimate {
  return { grade: g, confidence: 0.62 + r() * 0.25, summary: summary[g], issues: issues[g] };
}

export function buildCondition(seed: number): ConditionEstimate {
  const r = rng(seed ^ 0x9e3779b9);
  return { media: grade(pickGrade(r), MEDIA_ISSUES, MEDIA_SUMMARY, r), sleeve: grade(pickGrade(r), SLEEVE_ISSUES, SLEEVE_SUMMARY, r) };
}

/** Demo price data shaped like the real thing: suggested prices by grade plus a range for this copy's condition. */
export function buildPrice(baseNM: number, condition: ConditionEstimate, seed: number, now = new Date()): PriceEstimate {
  const r = rng(seed);
  const jitter = 0.9 + r() * 0.2;
  const byGrade = Object.fromEntries(GRADES.map((g) => [g, round(baseNM * GRADE_VALUE_FACTOR[g] * jitter)])) as Record<Grade, number>;
  const range = rangeForCondition(byGrade, condition.media.grade, condition.sleeve.grade)!;
  // Demo sales of copies in about the same condition as this one, so they sit around the range shown.
  const label = `${condition.media.grade} / ${condition.sleeve.grade}`;
  const recentSales: SaleRecord[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.round(i * 9 + r() * 6 + 2));
    return { price: round(range.low + (range.high - range.low) * (0.1 + r() * 0.8)), date: d.toISOString(), source: 'Demo', condition: label };
  });
  return {
    ...range,
    currency: 'USD',
    asOf: now.toISOString(),
    basis: `Media ${condition.media.grade}, sleeve ${condition.sleeve.grade}`,
    source: 'demo',
    byGrade,
    recentSales,
    numForSale: 4 + Math.floor(r() * 60),
    lowestListing: round(range.low * (0.8 + r() * 0.2)),
  };
}

type Copy = { pass: [string, string]; warn: [string, string]; fail: [string, string] };

export const CHECK_COPY: Record<AuthCheckId, Copy> = {
  label_print: {
    pass: ['Label print is crisp and even.', 'Small text around the rim and the logo linework are sharp, consistent with an official label print.'],
    warn: ['Label print is slightly soft. This may be the photo.', 'Rim text is legible but softer than reference labels. Rescan straight-on in even light.'],
    fail: ['Label print looks soft compared to official labels.', 'The rim text is smudged and the logo edges are fuzzy, which is typical of labels reprinted from a scan.'],
  },
  label_details: {
    pass: ['Label layout and credits match this pressing.', 'Label design, publishing credits and side information are consistent with this release and year.'],
    warn: ['One label detail could not be confirmed.', 'The rights-society text is hard to read. A sharper label photo would settle it.'],
    fail: ['Label layout does not match this pressing.', 'The label design belongs to a different era than the catalog number and year suggest.'],
  },
  catalog_consistency: {
    pass: ['Catalog number matches across cover, spine and label.', 'The same catalog number appears on the label and back cover, and it belongs to this label and year.'],
    warn: ['Catalog number only readable in one place.', 'The spine or label number was not legible, so it could not be cross-checked.'],
    fail: ['Catalog numbers do not agree.', 'The label and the back cover show different catalog numbers, or the number does not belong to this label.'],
  },
  matrix_runout: {
    pass: ['Runout etching matches this pressing.', 'The hand-etched matrix numbers and stamps match those documented for this pressing.'],
    warn: ['Runout only partly readable.', 'Some of the etching is legible but not enough to confirm the exact stamper. Try a lower lamp angle.'],
    fail: ['Runout does not match known pressings.', 'The matrix etching looks machine-printed or does not match any documented pressing of this release.'],
  },
  barcode_era: {
    pass: ['Barcode is consistent with the release year.', 'A barcode is present and matches what a release from this era would carry.'],
    warn: ['Barcode could not be confirmed.', 'A barcode may be present but could not be read clearly.'],
    fail: ['Barcode does not fit the release era.', 'There is a printed barcode on a pressing that predates barcodes on records.'],
  },
  cover_print: {
    pass: ['Cover print appears sharp.', 'Fine detail in the photo and typography is crisp, with no visible dot pattern or pixelation.'],
    warn: ['Cover print slightly soft. Could be the photo.', 'Fine text is legible but softer than reference scans. Rescan in better light.'],
    fail: ['Cover print looks like a reproduction.', 'Fine text is blurred and a visible dot pattern appears in solid areas, typical of covers printed from a scan.'],
  },
  back_cover: {
    pass: ['Back cover credits and layout match.', 'Track listing, credits, label address and copyright line match this pressing.'],
    warn: ['Back cover mostly matches; one detail unclear.', 'The copyright line is partly obscured by glare. Rescan the back to confirm.'],
    fail: ['Back cover details do not match this pressing.', 'The label address and copyright line are from a different era than the pressing claims.'],
  },
  bootleg_markers: {
    pass: ['No known bootleg signs found.', 'Checked against documented counterfeit tells for this release.'],
    warn: ['One known bootleg sign could not be ruled out.', 'The photos are not sharp enough to rule out a documented tell for this release.'],
    fail: ['A known bootleg sign was found.', 'Matches a documented counterfeit tell for this release.'],
  },
};

export type Scenario = 'clean' | 'minor' | 'review' | 'bootleg';

/** Builds a plausible full check list for a scenario (used by mock provider and samples). */
export function buildChecks(identity: RecordIdentity, scenario: Scenario, seed: number, bootlegNote?: string): AuthCheck[] {
  const r = rng(seed);
  const statuses: Record<AuthCheckId, CheckStatus> = {
    label_print: 'pass',
    label_details: 'pass',
    catalog_consistency: 'pass',
    matrix_runout: 'pass',
    barcode_era: identity.barcode || identity.year < 1975 ? 'pass' : 'skipped',
    cover_print: 'pass',
    back_cover: 'pass',
    bootleg_markers: 'pass',
  };
  if (scenario === 'minor') statuses[r() > 0.5 ? 'label_details' : 'back_cover'] = 'warn';
  if (scenario === 'review') {
    // One non-major failure plus an uncertain check: Needs Review, not Possible Bootleg.
    statuses.cover_print = 'warn';
    statuses.back_cover = 'fail';
  }
  if (scenario === 'bootleg') {
    statuses.label_print = 'fail';
    statuses.cover_print = 'fail';
    statuses.bootleg_markers = 'fail';
    statuses.matrix_runout = 'fail';
  }
  return (Object.keys(statuses) as AuthCheckId[]).map((id) => {
    const status = statuses[id];
    if (status === 'not_applicable' || status === 'skipped') {
      return { id, status, confidence: 0, summary: 'Not enough information in the photos to check this.', source: 'cloud' as const };
    }
    const [summary, detail] = CHECK_COPY[id][status as 'pass' | 'warn' | 'fail'];
    const confidence = status === 'pass' ? 0.84 + r() * 0.13 : status === 'warn' ? 0.55 + r() * 0.15 : 0.75 + r() * 0.2;
    return {
      id,
      status,
      confidence,
      summary,
      detail: id === 'bootleg_markers' && bootlegNote && status !== 'pass' ? `${detail} ${bootlegNote}` : detail,
      source: 'cloud' as const,
    };
  });
}
