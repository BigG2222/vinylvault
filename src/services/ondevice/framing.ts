import type { FrameStats, GuideRect } from './imageStats';

export type FramingState = 'searching' | 'align' | 'too_dark' | 'glare' | 'blurry' | 'ready';

export interface FramingFeedback {
  state: FramingState;
  message: string;
  /** 0–1 overall readiness, drives the guide color. */
  quality: number;
}

/** What the guide frames: a square 12" cover, the round center label, or a close-up of the dead wax. */
export type GuideShape = 'cover' | 'label' | 'runout';

/** Normalized on-screen guide, shared by overlay and analysis. Covers are square; the label guide is a smaller square around a circle. */
export function guideRectForScreen(screen: { width: number; height: number }, shape: GuideShape = 'cover'): GuideRect {
  const w = shape === 'cover' ? 0.86 : 0.72;
  const h = (screen.width * w) / screen.height;
  return { x: (1 - w) / 2, y: Math.max(0.1, (1 - h) / 2 - 0.05), w, h };
}

/**
 * Thresholds tuned for ~72px-wide downsampled frames. They are deliberately
 * forgiving: live guidance should help, not nag. Recalibrate on device data.
 */
export const FRAMING_THRESHOLDS = {
  minLuma: 55,
  /** Glossy sleeves and shiny labels reflect a lot, so covers get a little more slack than cards did. */
  maxGlare: 0.08,
  searchingAlignment: 1.15,
  alignedAlignment: 1.45,
  minSharpness: 55,
};

const SUBJECT: Record<GuideShape, string> = { cover: 'the whole cover', label: 'the center label', runout: 'the dead wax' };

export function assessFrame(stats: FrameStats, shape: GuideShape = 'cover'): FramingFeedback {
  const t = FRAMING_THRESHOLDS;
  if (stats.meanLuma < t.minLuma) return { state: 'too_dark', message: 'More light needed', quality: 0.15 };
  // The dead-wax close-up has no clean outline to align, so it skips the edge gates.
  if (shape !== 'runout' && stats.edgeAlignment < t.searchingAlignment) return { state: 'searching', message: `Place ${SUBJECT[shape]} inside the frame`, quality: 0.2 };
  if (stats.glareRatio > t.maxGlare) return { state: 'glare', message: 'Glare detected. Angle the record slightly', quality: 0.4 };
  if (shape === 'cover' && stats.edgeAlignment < t.alignedAlignment) return { state: 'align', message: 'Line up the cover edges with the guide', quality: 0.55 };
  if (stats.sharpness < t.minSharpness) return { state: 'blurry', message: 'Focusing. Hold steady', quality: 0.65 };
  return { state: 'ready', message: 'Looks good', quality: 1 };
}
