import type { FrameStats } from './imageStats';

export interface OcrHints {
  rawText: string;
  years: number[];
  /** Strings shaped like catalog numbers ("PCS 7088", "SMAS-11163"). */
  catalogNumbers: string[];
  /** Record labels named in the text. */
  labels: string[];
  /** Pressing countries from "Made in …" lines. */
  countries: string[];
  speeds: number[];
  channels: 'stereo' | 'mono' | null;
}

export interface OnDevicePrecheck {
  front: FrameStats;
  back?: FrameStats;
  label?: FrameStats;
  runout?: FrameStats;
  /** OCR of the center label and back cover (development builds only). */
  ocr: OcrHints | null;
  /** Barcode digits read by the camera, "none" when the collector confirmed there isn't one, undefined when not checked. */
  barcode?: string;
  qualityIssues: string[];
  elapsedMs: number;
}
