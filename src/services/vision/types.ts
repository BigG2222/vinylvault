import type { AuthCheck, ConditionEstimate, IdentificationMatch, ObservedText, RecordIdentity } from '../../types';
import type { OnDevicePrecheck } from '../ondevice/types';

export type ImageRole = 'front' | 'back' | 'label' | 'runout';

export interface VisionImage {
  /** Base64 JPEG without the data: prefix. */
  base64: string;
  role: ImageRole;
}

export interface VisionRequest {
  images: VisionImage[];
  /** On-device hints (OCR text, barcode, image quality) sent to the cloud model as context. */
  precheck: OnDevicePrecheck;
  /** Set when the user corrected the identification: check against this pressing. */
  confirmedIdentity?: RecordIdentity;
  /** Catalog key for the confirmed pressing, when known (used by the mock provider). */
  confirmedIdentityKey?: string;
}

/** Normalized cloud response. Providers must map their raw output into this shape. */
export interface VisionResponse {
  matches: IdentificationMatch[];
  condition: ConditionEstimate;
  checks: AuthCheck[];
  observed: ObservedText;
  model: string;
}

export interface VisionProvider {
  readonly id: string;
  readonly displayName: string;
  analyze(req: VisionRequest, signal?: AbortSignal): Promise<VisionResponse>;
}

export class VisionError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'timeout' | 'bad_response' | 'refused' | 'server',
  ) {
    super(message);
    this.name = 'VisionError';
  }
}
