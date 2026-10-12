import type { AuthCheck, RecordIdentity, ScanSource } from '../../types';
import type { OnDevicePrecheck } from '../ondevice/types';

export interface MergeContext {
  identity: RecordIdentity;
  precheck: OnDevicePrecheck;
  has: { back: boolean; label: boolean; runout: boolean };
  source?: ScanSource;
}

/** Records pressed before this year predate barcodes on sleeves (UPC on records arrived in the late 1970s). */
export const BARCODE_ERA_START = 1975;

export const digitsOnly = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '');
const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Combine cloud evidence with what only the device knows: which photos were
 * taken, the barcode the camera read (or the collector confirming there is
 * none), and photo quality. Missing inputs make a check "skipped", never
 * silently "passed".
 */
export function mergeOnDeviceEvidence(cloud: AuthCheck[], ctx: MergeContext): AuthCheck[] {
  const { identity, precheck, has, source } = ctx;
  return cloud.map((check): AuthCheck => {
    switch (check.id) {
      case 'matrix_runout':
        if (!has.runout) {
          return {
            ...check,
            status: 'skipped',
            confidence: 0,
            summary: 'Runout not photographed. It is the most reliable way to identify the exact pressing.',
            detail:
              source === 'library'
                ? 'Listing photos rarely show the dead wax. Ask the seller for the matrix numbers etched near the label on both sides.'
                : 'Rescan and add the dead-wax photo: tilt the record under a lamp so the etching between the last groove and the label catches the light.',
            source: 'on_device',
          };
        }
        return check;

      case 'label_print':
      case 'label_details':
        if (!has.label) {
          return { ...check, status: 'skipped', confidence: 0, summary: 'No center label photo, so the label was not checked.', detail: 'The label is where most bootlegs give themselves away. Add a straight-on photo of side A.', source: 'on_device' };
        }
        return check;

      case 'back_cover':
        if (!has.back) {
          return { ...check, status: 'skipped', confidence: 0, summary: 'No back cover photo, so credits and catalog details were not compared.', source: 'on_device' };
        }
        return check;

      case 'cover_print':
        if (precheck.front.sharpness < 45 && check.status === 'pass') {
          return { ...check, status: 'warn', confidence: Math.min(check.confidence, 0.6), summary: 'Print looks fine, but the photo was soft. Rescan to confirm.', source: 'combined' };
        }
        return check;

      case 'barcode_era':
        return mergeBarcode(check, identity, precheck.barcode);

      case 'catalog_consistency': {
        const read = precheck.ocr?.catalogNumbers ?? [];
        if (!read.length || !identity.catalogNumber) return check;
        const target = alnum(identity.catalogNumber);
        const found = read.find((c) => alnum(c).includes(target) || target.includes(alnum(c)));
        const note = found ? `On-device text reading also found ${found}.` : `On-device text reading saw ${read.slice(0, 3).join(', ')} (OCR can misread small print).`;
        return { ...check, detail: check.detail ? `${check.detail} ${note}` : note, source: 'combined' };
      }

      default:
        return check;
    }
  });
}

function mergeBarcode(check: AuthCheck, identity: RecordIdentity, scanned: string | undefined): AuthCheck {
  const year = identity.year;
  const preBarcodeEra = year < BARCODE_ERA_START;
  if (scanned === undefined) return check;

  if (scanned === 'none') {
    if (preBarcodeEra) {
      return { ...check, status: 'pass', confidence: 0.85, summary: `No barcode, as expected for a ${year} pressing.`, source: 'combined' };
    }
    if (identity.barcode) {
      return {
        ...check,
        status: 'warn',
        confidence: 0.6,
        summary: 'No barcode found, but this pressing normally has one.',
        detail: 'Some barcodes are only on a sticker or the shrink-wrap, so check those too. A missing barcode can also mean a different pressing.',
        source: 'combined',
      };
    }
    return { ...check, detail: `${check.detail ?? ''} You confirmed there is no barcode.`.trim(), source: 'combined' };
  }

  const digits = digitsOnly(scanned);
  if (preBarcodeEra && identity.pressingType === 'original') {
    return {
      ...check,
      status: 'fail',
      confidence: 0.85,
      summary: `Barcode found, but original ${year} pressings predate barcodes.`,
      detail: `The camera read ${scanned}. Barcodes appeared on records in the late 1970s, so a barcode printed on the sleeve points to a later reissue or a reproduction. A barcode on a price sticker added later doesn't count. If this is a reissue, pick the reissue match.`,
      source: 'combined',
    };
  }
  if (identity.barcode) {
    if (digitsOnly(identity.barcode) === digits) {
      return { ...check, status: 'pass', confidence: 0.95, summary: 'Barcode matches this pressing.', detail: `The camera read ${scanned}, which matches the barcode listed for this release.`, source: 'combined' };
    }
    return {
      ...check,
      status: 'warn',
      confidence: 0.7,
      summary: "Barcode doesn't match the one listed for this pressing.",
      detail: `The camera read ${scanned}; this pressing is listed with ${identity.barcode}. It may be a different pressing of the same album.`,
      source: 'combined',
    };
  }
  if (check.status === 'skipped') {
    return { ...check, status: 'pass', confidence: 0.7, summary: `Barcode present, consistent with a ${year} release.`, detail: `The camera read ${scanned}.`, source: 'combined' };
  }
  return { ...check, detail: `${check.detail ?? ''} The camera read ${scanned}.`.trim(), source: 'combined' };
}
