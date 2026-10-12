import { CATALOG, catalogByKey, type CatalogEntry } from '../../../data/catalog';
import { buildChecks, buildCondition, rng, type Scenario } from '../../../data/generate';
import { hashString } from '../../../utils/format';
import type { VisionProvider, VisionRequest, VisionResponse } from '../types';

let forcedScenario: Scenario | 'auto' = 'auto';
/** Dev-only: force the mock outcome to preview each result state. */
export function setMockScenario(s: Scenario | 'auto') {
  forcedScenario = s;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });

function pickScenario(r: () => number): Scenario {
  if (forcedScenario !== 'auto') return forcedScenario;
  const x = r();
  if (x < 0.6) return 'clean';
  if (x < 0.82) return 'minor';
  if (x < 0.94) return 'review';
  return 'bootleg';
}

/**
 * Offline stand-in for the cloud model. Produces realistic, deterministic
 * output for a given photo so the full UI can be built and demoed without
 * network access or API keys. It does not look at the photo's content.
 */
export class MockVisionProvider implements VisionProvider {
  readonly id = 'mock';
  readonly displayName = 'Demo model (offline)';

  async analyze(req: VisionRequest, signal?: AbortSignal): Promise<VisionResponse> {
    const front = req.images.find((i) => i.role === 'front');
    const seed = hashString((front?.base64 ?? '').slice(0, 4000) + (front?.base64.length ?? 0));
    const r = rng(seed);
    await sleep(1400 + r() * 900, signal);

    const top: CatalogEntry =
      req.confirmedIdentityKey && catalogByKey[req.confirmedIdentityKey] ? catalogByKey[req.confirmedIdentityKey] : CATALOG[seed % CATALOG.length];
    const altKeys = [...(top.confusableWith ?? [])].slice(0, 2);
    while (altKeys.length < 2) {
      const k = CATALOG[Math.floor(r() * CATALOG.length)].key;
      if (k !== top.key && !altKeys.includes(k)) altKeys.push(k);
    }
    const topConf = req.confirmedIdentityKey ? 0.97 : 0.78 + r() * 0.16;
    const matches = [
      { identity: top.identity, confidence: topConf },
      { identity: catalogByKey[altKeys[0]].identity, confidence: Math.min(topConf - 0.12, 0.3 + r() * 0.35) },
      { identity: catalogByKey[altKeys[1]].identity, confidence: 0.04 + r() * 0.12 },
    ];

    const hasRunout = req.images.some((i) => i.role === 'runout');
    const barcode = req.precheck.barcode && req.precheck.barcode !== 'none' ? req.precheck.barcode : undefined;
    return {
      matches,
      condition: buildCondition(seed),
      checks: buildChecks(top.identity, pickScenario(r), seed, top.bootlegNotes),
      observed: {
        catalogNumber: req.precheck.ocr?.catalogNumbers[0] ?? top.identity.catalogNumber,
        labelName: top.identity.label,
        runout: hasRunout ? top.identity.matrix : undefined,
        barcode,
      },
      model: 'mock-v1',
    };
  }
}
