import type { AuthCheck, AuthCheckId, PressingType, PressingVerdict } from '../../types';

/**
 * Checks whose failure is a strong bootleg signal on its own. A confident
 * failure on any of these escalates straight to Possible Bootleg.
 */
export const MAJOR_CHECKS: AuthCheckId[] = ['matrix_runout', 'label_print', 'bootleg_markers', 'catalog_consistency'];

export const CHECK_ORDER: AuthCheckId[] = [
  'label_print',
  'label_details',
  'catalog_consistency',
  'matrix_runout',
  'barcode_era',
  'cover_print',
  'back_cover',
  'bootleg_markers',
];

export const CHECK_TITLES: Record<AuthCheckId, string> = {
  label_print: 'Label print quality',
  label_details: 'Label text & credits',
  catalog_consistency: 'Catalog number & label match',
  matrix_runout: 'Matrix / runout etching',
  barcode_era: 'Barcode vs release era',
  cover_print: 'Cover print quality',
  back_cover: 'Back cover details',
  bootleg_markers: 'Known bootleg signs',
};

export interface VerdictInput {
  checks: AuthCheck[];
  /** Pressing type of the selected match: original first press, later reissue, or unknown. */
  pressingType: PressingType;
}

export interface VerdictOutput {
  verdict: PressingVerdict;
  summary: string;
}

const title = (c: AuthCheck) => CHECK_TITLES[c.id].toLowerCase();

/**
 * The verdict is computed on-device from the individual checks with fixed,
 * auditable rules. The vision model reports evidence per check and which
 * pressing it thinks this is; it never sets the headline result directly.
 * This keeps the badge consistent with the explanations shown beneath it.
 *
 *   1. 2+ failures, or a confident (≥70%) failure on a major check → Possible Bootleg.
 *   2. 1 failure, 2+ uncertain checks, nothing assessable, or an unknown pressing → Needs Review.
 *   3. Otherwise the matched pressing decides: a reissue → Reissue; an original → Likely Original Pressing.
 *      There is deliberately no "confirmed original": photos can narrow it down, not prove it.
 */
export function computeVerdict({ checks, pressingType }: VerdictInput): VerdictOutput {
  const applicable = checks.filter((c) => c.status !== 'not_applicable');
  const fails = applicable.filter((c) => c.status === 'fail');
  const warns = applicable.filter((c) => c.status === 'warn');
  const passes = applicable.filter((c) => c.status === 'pass');
  const skipped = applicable.filter((c) => c.status === 'skipped');
  const confidentMajorFail = fails.some((c) => MAJOR_CHECKS.includes(c.id) && c.confidence >= 0.7);
  const assessed = passes.length + warns.length + fails.length;
  const meanConfidence = assessed ? [...passes, ...warns, ...fails].reduce((s, c) => s + c.confidence, 0) / assessed : 0;

  const tally = `${passes.length} of ${applicable.length} checks passed`;

  if (fails.length >= 2 || confidentMajorFail) {
    return { verdict: 'possible_bootleg', summary: `${tally}. Failed: ${fails.map(title).join(', ')}.` };
  }

  if (fails.length === 1 || warns.length >= 2) {
    return { verdict: 'needs_review', summary: `${tally}. Take a closer look at: ${[...fails, ...warns].map(title).join(', ')}.` };
  }

  if (assessed === 0) {
    return { verdict: 'needs_review', summary: 'Not enough evidence to check this pressing. Try again with sharper photos in better light.' };
  }

  if (pressingType === 'unknown') {
    return { verdict: 'needs_review', summary: `${tally}, but the exact pressing could not be pinned down. A photo of the runout etching usually settles it.` };
  }

  const reasons: string[] = [];
  if (warns.length === 1) reasons.push(`${title(warns[0])} was inconclusive`);
  const runoutSkipped = skipped.some((c) => c.id === 'matrix_runout');
  if (runoutSkipped && pressingType === 'original') reasons.push('the runout was not photographed, so a first press vs an early repress is not confirmed');
  const otherSkipped = skipped.filter((c) => c.id !== 'matrix_runout');
  if (otherSkipped.length) reasons.push(`${otherSkipped.map(title).join(', ')} not checked`);
  if (meanConfidence < 0.8) reasons.push('overall confidence is moderate');

  const lead = pressingType === 'reissue' ? `${tally}. Consistent with a legitimate reissue` : `${tally}. Consistent with an original pressing`;
  return {
    verdict: pressingType === 'reissue' ? 'reissue' : 'likely_original',
    summary: reasons.length ? `${lead}; ${reasons.join('; ')}.` : `${lead}.`,
  };
}

/**
 * 0–1 confidence in the result: the mean confidence of the checks that were
 * actually assessed, scaled by the share of applicable checks that could be
 * assessed (a skipped runout or label check lowers it).
 */
export function authenticationConfidence(checks: AuthCheck[]): number {
  const applicable = checks.filter((c) => c.status !== 'not_applicable');
  const assessed = applicable.filter((c) => c.status === 'pass' || c.status === 'warn' || c.status === 'fail');
  if (!assessed.length) return 0;
  const mean = assessed.reduce((s, c) => s + c.confidence, 0) / assessed.length;
  return mean * (assessed.length / applicable.length);
}
