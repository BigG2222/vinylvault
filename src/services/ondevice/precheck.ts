import { frameStats, type GuideRect } from './imageStats';
import { recognizeText } from './ocr';
import { loadSmallRGBA } from './sampler';
import { mergeHints } from './textHints';
import type { OnDevicePrecheck } from './types';

/** Captured photos are already cropped to the guide, so the "guide" is the full frame inset slightly. */
const CROPPED_RECT: GuideRect = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 };

export interface PrecheckPhotos {
  frontUri: string;
  backUri?: string;
  labelUri?: string;
  runoutUri?: string;
  barcode?: string;
}

const stats = async (uri?: string) => (uri ? frameStats(await loadSmallRGBA(uri, 96), CROPPED_RECT) : undefined);

/**
 * Fast on-device pass run before any upload: image quality gates and OCR of
 * the label and back cover (catalog numbers, label names, "Made in …").
 * Results feed the UI and are sent to the cloud model as hints.
 */
export async function runOnDevicePrecheck(p: PrecheckPhotos): Promise<OnDevicePrecheck> {
  const t0 = Date.now();
  const [front, back, label, runout, labelText, backText] = await Promise.all([
    stats(p.frontUri),
    stats(p.backUri),
    stats(p.labelUri),
    stats(p.runoutUri),
    p.labelUri ? recognizeText(p.labelUri) : Promise.resolve(null),
    p.backUri ? recognizeText(p.backUri) : Promise.resolve(null),
  ]);

  const issues: string[] = [];
  if (front!.meanLuma < 60) issues.push('Front cover photo is dark');
  if (front!.glareRatio > 0.1) issues.push('Glare on the front cover photo');
  if (front!.sharpness < 45) issues.push('Front cover photo looks soft, so the print-quality check may be less reliable');
  if (label && label.sharpness < 45) issues.push('Label photo looks soft, so small label text may be misread');
  if (label && label.glareRatio > 0.1) issues.push('Glare on the label photo');
  if (!p.backUri) issues.push('No back cover photo');
  if (!p.labelUri) issues.push('No center label photo');

  return {
    front: front!,
    back,
    label,
    runout,
    ocr: mergeHints([labelText, backText]),
    barcode: p.barcode,
    qualityIssues: issues,
    elapsedMs: Date.now() - t0,
  };
}
