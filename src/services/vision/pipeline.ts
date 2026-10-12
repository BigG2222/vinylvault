import { findCatalogEntry } from '@/data/catalog';
import type { RecordIdentity, ScanResult, ScanSource } from '@/types';
import { uid } from '@/utils/format';
import { runOnDevicePrecheck } from '../ondevice/precheck';
import { toUploadBase64 } from '../ondevice/sampler';
import { getPrice } from '../pricing';
import { mergeOnDeviceEvidence } from './merge';
import { getVisionProvider } from './registry';
import type { VisionImage } from './types';
import { computeVerdict } from './verdict';

export type PipelineStage = 'precheck' | 'prepare' | 'identify' | 'authenticate' | 'pricing' | 'done';

export const STAGE_COPY: Record<PipelineStage, { title: string; detail: string }> = {
  precheck: { title: 'On-device pre-check', detail: 'Photo quality, label text and barcode' },
  prepare: { title: 'Preparing images', detail: 'Covers, label and runout' },
  identify: { title: 'Identifying pressing', detail: 'Artist, title, label, catalog number and country' },
  authenticate: { title: 'Checking pressing', detail: 'Eight checks, including label, runout and barcode' },
  pricing: { title: 'Valuing', detail: 'Price range for this condition' },
  done: { title: 'Done', detail: '' },
};

export interface PipelineInput {
  frontUri: string;
  backUri?: string;
  labelUri?: string;
  runoutUri?: string;
  /** Barcode digits, "none" if the collector confirmed there isn't one, undefined if not checked. */
  barcode?: string;
  /** Re-run the checks against a pressing the user confirmed. */
  confirmedIdentity?: RecordIdentity;
  source?: ScanSource;
}

/**
 * Hybrid pipeline:
 *   1. On-device pre-check (fast, offline): quality gates, label/back OCR, barcode.
 *   2. Cloud vision (primary accuracy): candidate pressings, condition, per-check evidence.
 *   3. On-device merge: missing-photo handling, barcode-vs-era rule, OCR cross-check.
 *   4. Deterministic verdict from the merged checks.
 *   5. Price range for the top match at the estimated grade.
 */
export async function runScanPipeline(input: PipelineInput, onStage: (stage: PipelineStage) => void, signal?: AbortSignal): Promise<ScanResult> {
  const started = Date.now();

  onStage('precheck');
  const precheck = await runOnDevicePrecheck(input);
  if (input.source === 'library') {
    precheck.qualityIssues.push('Uploaded photos (for example from a listing), not a live capture. Compression may soften fine label text.');
  }
  const onDeviceMs = Date.now() - started;

  onStage('prepare');
  const images: VisionImage[] = [{ role: 'front', base64: await toUploadBase64(input.frontUri) }];
  if (input.backUri) images.push({ role: 'back', base64: await toUploadBase64(input.backUri) });
  if (input.labelUri) images.push({ role: 'label', base64: await toUploadBase64(input.labelUri) });
  // Runout etching is tiny, so it gets the most pixels.
  if (input.runoutUri) images.push({ role: 'runout', base64: await toUploadBase64(input.runoutUri, 1600) });

  onStage('identify');
  const cloudStart = Date.now();
  const provider = getVisionProvider();
  const cloud = await provider.analyze(
    {
      images,
      precheck,
      confirmedIdentity: input.confirmedIdentity,
      confirmedIdentityKey: input.confirmedIdentity ? findCatalogEntry(input.confirmedIdentity)?.key : undefined,
    },
    signal,
  );
  const cloudMs = Date.now() - cloudStart;

  onStage('authenticate');
  const top = cloud.matches[0];
  const has = { back: Boolean(input.backUri), label: Boolean(input.labelUri), runout: Boolean(input.runoutUri) };
  const checks = mergeOnDeviceEvidence(cloud.checks, { identity: top.identity, precheck, has, source: input.source });
  const { verdict, summary } = computeVerdict({ checks, pressingType: top.identity.pressingType });

  onStage('pricing');
  const price = await getPrice(top.identity, cloud.condition);

  onStage('done');
  const barcode = input.barcode ?? cloud.observed.barcode;
  return {
    id: uid('scan_'),
    createdAt: new Date().toISOString(),
    images: { front: input.frontUri, back: input.backUri, label: input.labelUri, runout: input.runoutUri },
    matches: cloud.matches,
    selectedMatchIndex: 0,
    condition: cloud.condition,
    checks,
    rawChecks: cloud.checks,
    precheck,
    observed: { ...cloud.observed, barcode },
    verdict,
    verdictSummary: summary,
    price,
    provider: `${provider.displayName} · ${cloud.model}`,
    timing: { onDeviceMs, cloudMs, totalMs: Date.now() - started },
    userConfirmedMatch: Boolean(input.confirmedIdentity),
    source: input.source ?? 'camera',
  };
}
