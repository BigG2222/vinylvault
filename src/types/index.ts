import type { OnDevicePrecheck } from '../services/ondevice/types';

export type ScanSource = 'camera' | 'library';

export type VinylFormat = 'LP' | '12" Single' | '10"' | '7" Single';

export type Genre =
  | 'Rock'
  | 'Pop'
  | 'Jazz'
  | 'Soul & Funk'
  | 'Hip-Hop'
  | 'Electronic'
  | 'Reggae'
  | 'Folk & Country'
  | 'Blues'
  | 'Classical'
  | 'Soundtrack'
  | 'Other';

/** Whether a candidate is the first pressing of the release or a later reissue. */
export type PressingType = 'original' | 'reissue' | 'unknown';

/** Goldmine grading scale, best first. */
export type Grade = 'M' | 'NM' | 'VG+' | 'VG' | 'G+' | 'G' | 'F' | 'P';

export type PressingVerdict = 'likely_original' | 'reissue' | 'needs_review' | 'possible_bootleg';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'not_applicable' | 'skipped';

export type AuthCheckId =
  | 'label_print'
  | 'catalog_consistency'
  | 'matrix_runout'
  | 'barcode_era'
  | 'cover_print'
  | 'back_cover'
  | 'label_details'
  | 'bootleg_markers';

export type CheckSource = 'on_device' | 'cloud' | 'combined';

export interface AuthCheck {
  id: AuthCheckId;
  status: CheckStatus;
  /** 0–1: how sure the pipeline is about this specific check's status. */
  confidence: number;
  /** One-line, user-facing explanation. */
  summary: string;
  /** Longer explanation shown in the premium breakdown. */
  detail?: string;
  source: CheckSource;
}

/** One specific pressing of a release. */
export interface RecordIdentity {
  artist: string;
  title: string;
  /** Year this pressing was made. */
  year: number;
  /** Year the album was first released, when it differs from `year`. */
  originalYear?: number;
  label: string;
  catalogNumber: string;
  country: string;
  format: VinylFormat;
  discs: number;
  genre: Genre;
  pressingType: PressingType;
  /** e.g. "Stereo, gatefold", "Blue vinyl", "Promo". */
  variant?: string;
  /** Barcode printed on this pressing, if it has one. */
  barcode?: string;
  /** Known matrix / runout etching for this pressing (side A / side B). */
  matrix?: string;
  /** How this pressing is told apart from others, in plain language. */
  pressingNotes?: string;
  discogsReleaseId?: number;
  discogsUrl?: string;
  /** True when the server found this exact pressing in the Discogs database. */
  discogsVerified?: boolean;
}

export interface IdentificationMatch {
  identity: RecordIdentity;
  /** 0–1 */
  confidence: number;
}

export type IssueKind =
  | 'scuffs'
  | 'scratches'
  | 'warp'
  | 'label_wear'
  | 'spindle_marks'
  | 'ring_wear'
  | 'seam_split'
  | 'writing'
  | 'stickers'
  | 'corner_wear'
  | 'fading'
  | 'water_damage'
  | 'other';

export interface ConditionIssue {
  kind: IssueKind;
  severity: 'light' | 'moderate' | 'heavy';
  note: string;
}

export interface GradeEstimate {
  grade: Grade;
  /** 0–1 */
  confidence: number;
  summary: string;
  issues: ConditionIssue[];
}

export interface ConditionEstimate {
  /** The vinyl itself. */
  media: GradeEstimate;
  /** The cover / sleeve. */
  sleeve: GradeEstimate;
}

export type SaleSource = 'Discogs' | 'eBay' | 'Popsike' | 'Demo';

export interface SaleRecord {
  price: number;
  date: string; // ISO date
  source: SaleSource;
  /** e.g. "VG+ / VG+" (media / sleeve). */
  condition: string;
}

export type PriceSource = 'discogs' | 'demo';

export interface PriceEstimate {
  low: number;
  avg: number;
  high: number;
  currency: string;
  asOf: string;
  /** What the range describes, e.g. "Media VG+, sleeve VG". */
  basis: string;
  source: PriceSource;
  /** Suggested price for each media grade, when known. */
  byGrade: Partial<Record<Grade, number>>;
  /** Individual sales. The Discogs API doesn't provide these, so they're empty for Discogs prices. */
  recentSales: SaleRecord[];
  lowestListing?: number;
  numForSale?: number;
  /** Where the full sales history can be seen. */
  salesHistoryUrl?: string;
}

export interface ScanImages {
  front: string;
  back?: string;
  label?: string;
  runout?: string;
}

/** What the device and the model read off the record. Shown to the user so they can sanity-check it. */
export interface ObservedText {
  catalogNumber?: string;
  labelName?: string;
  runout?: string;
  /** Barcode read by the camera scanner, or "none" when the collector confirmed there isn't one. */
  barcode?: string;
}

export interface PipelineTiming {
  onDeviceMs: number;
  cloudMs: number;
  totalMs: number;
}

export interface ScanResult {
  id: string;
  createdAt: string;
  images: ScanImages;
  /** Sorted by confidence desc; index 0 is the top match. */
  matches: IdentificationMatch[];
  selectedMatchIndex: number;
  condition: ConditionEstimate;
  checks: AuthCheck[];
  /** Cloud checks before on-device merge; kept so a corrected match can be re-merged. */
  rawChecks: AuthCheck[];
  precheck: OnDevicePrecheck;
  observed: ObservedText;
  verdict: PressingVerdict;
  verdictSummary: string;
  price: PriceEstimate;
  provider: string;
  userConfirmedMatch?: boolean;
  timing: PipelineTiming;
  source?: ScanSource;
  isSample?: boolean;
}

export interface CollectionRecord {
  id: string;
  addedAt: string;
  updatedAt: string;
  identity: RecordIdentity;
  images: ScanImages;
  condition: ConditionEstimate;
  checks: AuthCheck[];
  observed: ObservedText;
  verdict: PressingVerdict;
  price: PriceEstimate;
  tags: string[];
  notes: string;
  scanId?: string;
  isSample?: boolean;
}

export interface WrongResultReport {
  id: string;
  createdAt: string;
  scanId?: string;
  recordId?: string;
  reason: 'wrong_release' | 'wrong_pressing' | 'wrong_authenticity' | 'wrong_condition' | 'wrong_price' | 'other';
  message: string;
}
