import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogByKey } from '../data/catalog';
import type { OnDevicePrecheck } from '../services/ondevice/types';
import { mergeOnDeviceEvidence } from '../services/vision/merge';
import { parseVisionJson, ParseError } from '../services/vision/parse';
import { authenticationConfidence, CHECK_ORDER, computeVerdict } from '../services/vision/verdict';
import type { AuthCheck, AuthCheckId, CheckStatus } from '../types';

const check = (id: AuthCheckId, status: CheckStatus, confidence = 0.92): AuthCheck => ({ id, status, confidence, summary: '', source: 'cloud' });
const allPass = () => CHECK_ORDER.map((id) => check(id, 'pass'));
const withStatus = (id: AuthCheckId, status: CheckStatus, confidence?: number) => allPass().map((c) => (c.id === id ? check(id, status, confidence) : c));

const precheck = (barcode?: string): OnDevicePrecheck => ({
  front: { meanLuma: 140, sharpness: 150, glareRatio: 0, edgeAlignment: 2, specularity: 0 },
  ocr: null,
  barcode,
  qualityIssues: [],
  elapsedMs: 10,
});
const allPhotos = { back: true, label: true, runout: true };

describe('computeVerdict', () => {
  it('a clean original is Likely Original Pressing, never a stronger claim', () => {
    const r = computeVerdict({ checks: allPass(), pressingType: 'original' });
    assert.equal(r.verdict, 'likely_original');
    assert.match(r.summary, /Consistent with an original pressing/);
  });

  it('a clean reissue is Reissue', () => {
    assert.equal(computeVerdict({ checks: allPass(), pressingType: 'reissue' }).verdict, 'reissue');
  });

  it('an unknown pressing needs review even when checks pass', () => {
    assert.equal(computeVerdict({ checks: allPass(), pressingType: 'unknown' }).verdict, 'needs_review');
  });

  it('notes a skipped runout on an original but still allows Likely Original', () => {
    const r = computeVerdict({ checks: withStatus('matrix_runout', 'skipped', 0), pressingType: 'original' });
    assert.equal(r.verdict, 'likely_original');
    assert.match(r.summary, /runout was not photographed/);
  });

  it('one uncertain check is still a positive verdict, with the reason', () => {
    const r = computeVerdict({ checks: withStatus('back_cover', 'warn', 0.6), pressingType: 'original' });
    assert.equal(r.verdict, 'likely_original');
    assert.match(r.summary, /inconclusive/);
  });

  it('a single minor failure needs review', () => {
    assert.equal(computeVerdict({ checks: withStatus('cover_print', 'fail', 0.8), pressingType: 'original' }).verdict, 'needs_review');
  });

  it('two uncertain checks need review', () => {
    const checks = withStatus('cover_print', 'warn').map((c) => (c.id === 'back_cover' ? check('back_cover', 'warn') : c));
    assert.equal(computeVerdict({ checks, pressingType: 'reissue' }).verdict, 'needs_review');
  });

  it('a confident failure on a major check is Possible Bootleg', () => {
    assert.equal(computeVerdict({ checks: withStatus('matrix_runout', 'fail', 0.85), pressingType: 'original' }).verdict, 'possible_bootleg');
    assert.equal(computeVerdict({ checks: withStatus('label_print', 'fail', 0.75), pressingType: 'reissue' }).verdict, 'possible_bootleg');
  });

  it('an unconfident major failure only needs review', () => {
    assert.equal(computeVerdict({ checks: withStatus('bootleg_markers', 'fail', 0.5), pressingType: 'original' }).verdict, 'needs_review');
  });

  it('multiple failures are Possible Bootleg', () => {
    const checks = withStatus('cover_print', 'fail', 0.6).map((c) => (c.id === 'back_cover' ? check('back_cover', 'fail', 0.6) : c));
    assert.equal(computeVerdict({ checks, pressingType: 'original' }).verdict, 'possible_bootleg');
  });

  it('needs review when nothing could be assessed', () => {
    const checks = CHECK_ORDER.map((id) => check(id, 'skipped', 0));
    assert.equal(computeVerdict({ checks, pressingType: 'original' }).verdict, 'needs_review');
  });

  it('never makes absolute accuracy claims in summaries', () => {
    for (const pressingType of ['original', 'reissue', 'unknown'] as const) {
      const s = computeVerdict({ checks: allPass(), pressingType }).summary.toLowerCase();
      assert.doesNotMatch(s, /100%|guarantee|certain|definitely|confirmed original/);
    }
  });
});

describe('authenticationConfidence', () => {
  it('drops when applicable checks are skipped', () => {
    const full = authenticationConfidence(allPass());
    const skipped = authenticationConfidence(withStatus('matrix_runout', 'skipped', 0));
    assert.ok(skipped < full);
    assert.ok(Math.abs(full - 0.92) < 1e-9);
  });
});

describe('mergeOnDeviceEvidence', () => {
  const abbey69 = catalogByKey['beatles-abbey-road-uk-1969'].identity;
  const abbey19 = catalogByKey['beatles-abbey-road-2019'].identity;

  it('skips runout, label and back checks when those photos are missing', () => {
    const merged = mergeOnDeviceEvidence(allPass(), { identity: abbey69, precheck: precheck(), has: { back: false, label: false, runout: false } });
    const by = Object.fromEntries(merged.map((c) => [c.id, c.status]));
    assert.equal(by.matrix_runout, 'skipped');
    assert.equal(by.label_print, 'skipped');
    assert.equal(by.label_details, 'skipped');
    assert.equal(by.back_cover, 'skipped');
    assert.equal(by.cover_print, 'pass');
  });

  it('fails the barcode check when a pre-barcode original has a barcode', () => {
    const merged = mergeOnDeviceEvidence(allPass(), { identity: abbey69, precheck: precheck('0602508007456'), has: allPhotos });
    const bc = merged.find((c) => c.id === 'barcode_era')!;
    assert.equal(bc.status, 'fail');
    assert.match(bc.summary, /predate barcodes/);
    // One non-major failure: Needs Review, which points the collector at the reissue match.
    assert.equal(computeVerdict({ checks: merged, pressingType: abbey69.pressingType }).verdict, 'needs_review');
  });

  it('passes the same barcode against the matching reissue', () => {
    const merged = mergeOnDeviceEvidence(allPass(), { identity: abbey19, precheck: precheck('0602508007456'), has: allPhotos });
    const bc = merged.find((c) => c.id === 'barcode_era')!;
    assert.equal(bc.status, 'pass');
    assert.equal(computeVerdict({ checks: merged, pressingType: 'reissue' }).verdict, 'reissue');
  });

  it('passes "no barcode" on a pre-1975 pressing and flags it on one that should have one', () => {
    assert.equal(mergeOnDeviceEvidence(allPass(), { identity: abbey69, precheck: precheck('none'), has: allPhotos }).find((c) => c.id === 'barcode_era')!.status, 'pass');
    assert.equal(mergeOnDeviceEvidence(allPass(), { identity: abbey19, precheck: precheck('none'), has: allPhotos }).find((c) => c.id === 'barcode_era')!.status, 'warn');
  });

  it('flags a barcode that does not match the listed one', () => {
    const merged = mergeOnDeviceEvidence(allPass(), { identity: abbey19, precheck: precheck('5012394000116'), has: allPhotos });
    assert.equal(merged.find((c) => c.id === 'barcode_era')!.status, 'warn');
  });

  it('downgrades a cover-print pass when the photo was soft', () => {
    const soft = { ...precheck(), front: { ...precheck().front, sharpness: 20 } };
    assert.equal(mergeOnDeviceEvidence(allPass(), { identity: abbey69, precheck: soft, has: allPhotos }).find((c) => c.id === 'cover_print')!.status, 'warn');
  });
});

describe('parseVisionJson', () => {
  const valid = {
    matches: [
      { artist: 'Pink Floyd', title: 'The Dark Side Of The Moon', year: 1973, original_year: 1973, label: 'Harvest', catalog_number: 'SHVL 804', country: 'UK', format: 'LP', discs: 1, genre: 'Rock', pressing_type: 'original', variant: '', barcode: '', matrix: 'A-2 / B-2', pressing_notes: '', confidence: 0.81 },
      { artist: 'Pink Floyd', title: 'The Dark Side Of The Moon', year: 2016, original_year: 1973, label: 'Pink Floyd Records', catalog_number: 'PFRLP8', country: 'Europe', format: 'LP', discs: 1, genre: 'Rock', pressing_type: 'reissue', variant: '', barcode: '825646457183', matrix: '', pressing_notes: '', confidence: 0.9 },
    ],
    condition: {
      media: { grade: 'VG+', confidence: 0.7, summary: 'Light scuffs.', issues: [{ kind: 'scuffs', severity: 'light', note: 'Faint hairlines.' }] },
      sleeve: { grade: 'X', confidence: 0.9, summary: '', issues: [] },
    },
    checks: [
      { id: 'label_print', status: 'pass', confidence: 0.95, summary: 'Crisp.', detail: '' },
      { id: 'cover_print', status: 'pass', confidence: 0.4, summary: 'Probably fine.', detail: '' },
      { id: 'bogus', status: 'pass', confidence: 1, summary: '', detail: '' },
    ],
    observed: { catalog_number: 'SHVL 804', label_name: 'Harvest', runout: '', barcode: '' },
  };

  it('sorts matches by confidence and normalizes fields', () => {
    const r = parseVisionJson(JSON.stringify(valid));
    assert.equal(r.matches[0].identity.catalogNumber, 'PFRLP8');
    assert.equal(r.matches[0].identity.originalYear, 1973);
    assert.equal(r.matches[1].identity.originalYear, undefined, 'original year equal to year is dropped');
    assert.equal(r.matches[1].identity.barcode, undefined, 'empty strings become undefined');
  });

  it('downgrades an unsure pass, ignores unknown checks and fills missing ones as skipped', () => {
    const r = parseVisionJson(valid);
    assert.equal(r.checks.length, CHECK_ORDER.length);
    assert.equal(r.checks.find((c) => c.id === 'cover_print')!.status, 'warn');
    assert.equal(r.checks.find((c) => c.id === 'matrix_runout')!.status, 'skipped');
  });

  it('defaults an invalid grade to VG with low confidence', () => {
    const r = parseVisionJson(valid);
    assert.equal(r.condition.media.grade, 'VG+');
    assert.equal(r.condition.sleeve.grade, 'VG');
    assert.ok(r.condition.sleeve.confidence <= 0.2);
    assert.equal(r.observed.runout, undefined);
  });

  it('rejects responses with no usable match', () => {
    assert.throws(() => parseVisionJson({ matches: [{ artist: '' }] }), ParseError);
    assert.throws(() => parseVisionJson('not json'), ParseError);
  });
});
