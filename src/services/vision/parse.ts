import type {
  AuthCheck,
  AuthCheckId,
  CheckStatus,
  ConditionIssue,
  Genre,
  GradeEstimate,
  IdentificationMatch,
  IssueKind,
  ObservedText,
  PressingType,
  VinylFormat,
} from '../../types';
import { isGrade } from '../../utils/grading';
import { CHECK_ORDER } from './verdict';

/**
 * Validates and normalizes the structured JSON a cloud model returns
 * (see server/src/schema.ts for the contract). Defensive by design: anything
 * missing or out of range is clamped or downgraded rather than trusted.
 */

const FORMATS: VinylFormat[] = ['LP', '12" Single', '10"', '7" Single'];
const GENRES: Genre[] = ['Rock', 'Pop', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Reggae', 'Folk & Country', 'Blues', 'Classical', 'Soundtrack', 'Other'];
const PRESSING_TYPES: PressingType[] = ['original', 'reissue', 'unknown'];
const STATUSES: CheckStatus[] = ['pass', 'warn', 'fail', 'not_applicable', 'skipped'];
const ISSUE_KINDS: IssueKind[] = ['scuffs', 'scratches', 'warp', 'label_wear', 'spindle_marks', 'ring_wear', 'seam_split', 'writing', 'stickers', 'corner_wear', 'fading', 'water_damage', 'other'];

const clamp01 = (n: unknown, fallback = 0) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(1, Math.max(0, v));
};
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
const opt = (v: unknown) => str(v) || undefined;
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export class ParseError extends Error {}

function parseMatch(raw: any): IdentificationMatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const artist = str(raw.artist);
  const title = str(raw.title);
  const year = int(raw.year);
  if (!artist || !title || !Number.isFinite(year)) return null;
  const originalYear = int(raw.original_year ?? raw.originalYear);
  const discs = int(raw.discs);
  const releaseId = int(raw.discogs_release_id ?? raw.discogsReleaseId);
  return {
    confidence: clamp01(raw.confidence),
    identity: {
      artist,
      title,
      year,
      originalYear: Number.isFinite(originalYear) && originalYear > 1890 && originalYear !== year ? originalYear : undefined,
      label: str(raw.label, 'Unknown label'),
      catalogNumber: str(raw.catalog_number ?? raw.catalogNumber),
      country: str(raw.country, 'Unknown'),
      format: FORMATS.includes(raw.format) ? raw.format : 'LP',
      discs: Number.isFinite(discs) && discs >= 1 && discs <= 12 ? discs : 1,
      genre: GENRES.includes(raw.genre) ? raw.genre : 'Other',
      pressingType: PRESSING_TYPES.includes(raw.pressing_type ?? raw.pressingType) ? (raw.pressing_type ?? raw.pressingType) : 'unknown',
      variant: opt(raw.variant),
      barcode: opt(raw.barcode),
      matrix: opt(raw.matrix),
      pressingNotes: opt(raw.pressing_notes ?? raw.pressingNotes),
      discogsReleaseId: Number.isFinite(releaseId) && releaseId > 0 ? releaseId : undefined,
      discogsUrl: opt(raw.discogs_url ?? raw.discogsUrl),
      discogsVerified: Boolean(raw.discogs_verified ?? raw.discogsVerified),
    },
  };
}

function parseCheck(raw: any): AuthCheck | null {
  if (!raw || !CHECK_ORDER.includes(raw.id)) return null;
  const status: CheckStatus = STATUSES.includes(raw.status) ? raw.status : 'warn';
  const confidence = clamp01(raw.confidence, 0.5);
  return {
    id: raw.id as AuthCheckId,
    // A "pass" the model itself is unsure about is shown as uncertain, not passed.
    status: status === 'pass' && confidence < 0.6 ? 'warn' : status,
    confidence,
    summary: str(raw.summary, 'No explanation provided.'),
    detail: opt(raw.detail),
    source: 'cloud',
  };
}

function parseIssue(raw: any): ConditionIssue | null {
  const note = str(raw?.note);
  if (!note) return null;
  return {
    kind: ISSUE_KINDS.includes(raw.kind) ? raw.kind : 'other',
    severity: raw.severity === 'heavy' || raw.severity === 'moderate' ? raw.severity : 'light',
    note,
  };
}

function parseGrade(raw: any, fallbackSummary: string): GradeEstimate {
  const issues = (Array.isArray(raw?.issues) ? raw.issues : []).map(parseIssue).filter((i: ConditionIssue | null): i is ConditionIssue => i !== null).slice(0, 6);
  return {
    // An unreadable grade defaults to the middle of the scale, flagged with low confidence.
    grade: isGrade(raw?.grade) ? raw.grade : 'VG',
    confidence: isGrade(raw?.grade) ? clamp01(raw?.confidence, 0.5) : 0.2,
    summary: str(raw?.summary, fallbackSummary),
    issues,
  };
}

export function parseVisionJson(input: unknown) {
  let data: any = input;
  if (typeof input === 'string') {
    const trimmed = input.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new ParseError('Vision response was not valid JSON');
    }
  }
  if (!data || typeof data !== 'object') throw new ParseError('Vision response was empty');

  const matches = (Array.isArray(data.matches) ? data.matches : [])
    .map(parseMatch)
    .filter((m: IdentificationMatch | null): m is IdentificationMatch => m !== null)
    .sort((a: IdentificationMatch, b: IdentificationMatch) => b.confidence - a.confidence)
    .slice(0, 3);
  if (!matches.length) throw new ParseError('No record identification returned');

  const byId = new Map<AuthCheckId, AuthCheck>();
  for (const c of Array.isArray(data.checks) ? data.checks : []) {
    const parsed = parseCheck(c);
    if (parsed && !byId.has(parsed.id)) byId.set(parsed.id, parsed);
  }
  const checks: AuthCheck[] = CHECK_ORDER.map(
    (id) => byId.get(id) ?? { id, status: 'skipped', confidence: 0, summary: 'This check was not reported by the analysis.', source: 'cloud' },
  );

  const c = data.condition ?? {};
  const condition = {
    media: parseGrade(c.media, 'Media condition not described.'),
    sleeve: parseGrade(c.sleeve, 'Sleeve condition not described.'),
  };

  const o = data.observed ?? {};
  const observed: ObservedText = {
    catalogNumber: opt(o.catalog_number ?? o.catalogNumber),
    labelName: opt(o.label_name ?? o.labelName),
    runout: opt(o.runout),
    barcode: opt(o.barcode),
  };

  return { matches, checks, condition, observed, model: str(data.model, 'unknown') };
}
