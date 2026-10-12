import { mergeOnDeviceEvidence } from '../services/vision/merge';
import { computeVerdict } from '../services/vision/verdict';
import type { OnDevicePrecheck } from '../services/ondevice/types';
import type { CollectionRecord, ScanResult } from '../types';
import { hashString } from '../utils/format';
import { catalogByKey } from './catalog';
import { buildChecks, buildCondition, buildPrice, type Scenario } from './generate';

const SAMPLE_PRECHECK: OnDevicePrecheck = {
  front: { meanLuma: 140, sharpness: 180, glareRatio: 0.01, edgeAlignment: 2.1, specularity: 0.02 },
  back: { meanLuma: 150, sharpness: 160, glareRatio: 0.01, edgeAlignment: 2, specularity: 0.01 },
  label: { meanLuma: 130, sharpness: 170, glareRatio: 0.02, edgeAlignment: 1.8, specularity: 0.01 },
  ocr: null,
  qualityIssues: [],
  elapsedMs: 240,
};

interface Spec {
  key: string;
  scenario: Scenario;
  daysAgo: number;
  tags: string[];
  notes?: string;
  /** Whether the sample "scan" included a runout photo. */
  runout?: boolean;
}

const SPECS: Spec[] = [
  { key: 'pink-floyd-dsotm-uk-1973', scenario: 'clean', daysAgo: 1, tags: ['First Pressings', 'Favorites'], runout: true, notes: 'Posters and both stickers included.' },
  { key: 'miles-davis-kind-of-blue-1959', scenario: 'minor', daysAgo: 3, tags: ['First Pressings'], runout: true, notes: 'From an estate sale. Needs a wet clean.' },
  { key: 'beatles-abbey-road-2019', scenario: 'clean', daysAgo: 5, tags: [] },
  { key: 'daft-punk-discovery-2001', scenario: 'bootleg', daysAgo: 8, tags: ['Needs Review'], runout: true, notes: 'Bought online, much cheaper than usual. Compare with a known original.' },
  { key: 'lee-morgan-sidewinder-1964', scenario: 'clean', daysAgo: 10, tags: ['First Pressings', 'Favorites'], runout: true },
  { key: 'fleetwood-mac-rumours-1977', scenario: 'minor', daysAgo: 13, tags: ['For Sale'] },
  { key: 'bob-marley-legend-1984', scenario: 'review', daysAgo: 18, tags: ['Needs Review'] },
  { key: 'nirvana-nevermind-2009', scenario: 'clean', daysAgo: 24, tags: [] },
  { key: 'carole-king-tapestry-1971', scenario: 'clean', daysAgo: 30, tags: ['Needs Cleaning'], runout: true },
  { key: 'kendrick-lamar-gkmc-2012', scenario: 'clean', daysAgo: 36, tags: ['Favorites'] },
];

function build(spec: Spec, now: Date) {
  const entry = catalogByKey[spec.key];
  const seed = hashString(spec.key);
  const condition = buildCondition(seed);
  const raw = buildChecks(entry.identity, spec.scenario, seed, entry.bootlegNotes);
  const has = { back: true, label: true, runout: Boolean(spec.runout) };
  const checks = mergeOnDeviceEvidence(raw, { identity: entry.identity, precheck: SAMPLE_PRECHECK, has });
  const { verdict, summary } = computeVerdict({ checks, pressingType: entry.identity.pressingType });
  const date = new Date(now);
  date.setDate(date.getDate() - spec.daysAgo);
  const runout = !spec.runout
    ? undefined
    : spec.scenario === 'bootleg'
      ? `${entry.identity.catalogNumber} A (laser-printed, no stamper marks)`
      : (entry.identity.matrix ?? `${entry.identity.catalogNumber} A / B`);
  const observed = { catalogNumber: entry.identity.catalogNumber, labelName: entry.identity.label, runout, barcode: entry.identity.barcode };
  return { entry, condition, raw, checks, verdict, summary, date, observed, price: buildPrice(entry.baseNM, condition, seed, now) };
}

export function buildSampleData(now = new Date()): { collection: CollectionRecord[]; scans: ScanResult[] } {
  const collection: CollectionRecord[] = [];
  const scans: ScanResult[] = [];
  SPECS.forEach((spec, i) => {
    const b = build(spec, now);
    const id = `sample_${spec.key}`;
    collection.push({
      id,
      addedAt: b.date.toISOString(),
      updatedAt: b.date.toISOString(),
      identity: b.entry.identity,
      images: { front: '' },
      condition: b.condition,
      checks: b.checks,
      observed: b.observed,
      verdict: b.verdict,
      price: b.price,
      tags: spec.tags,
      notes: spec.notes ?? '',
      isSample: true,
      scanId: `scan_${id}`,
    });
    if (i < 4) {
      scans.push({
        id: `scan_${id}`,
        createdAt: b.date.toISOString(),
        images: { front: '' },
        matches: [{ identity: b.entry.identity, confidence: 0.91 }],
        selectedMatchIndex: 0,
        condition: b.condition,
        checks: b.checks,
        rawChecks: b.raw,
        precheck: SAMPLE_PRECHECK,
        observed: b.observed,
        verdict: b.verdict,
        verdictSummary: b.summary,
        price: b.price,
        provider: 'Sample data',
        timing: { onDeviceMs: 240, cloudMs: 2100, totalMs: 2600 },
        isSample: true,
      });
    }
  });
  return { collection, scans };
}
