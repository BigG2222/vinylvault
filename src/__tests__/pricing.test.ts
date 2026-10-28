import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IS_DEV } from '../config';
import { DISCOGS_MAX_AGE_MS, expirePrice, hasPriceRange, isExportablePrice, isPriceExpired, noPrice, priceFromServer, ServerPriceProvider, withoutInventedPrice } from '../services/pricing';
import { buildPrice } from '../data/generate';
import { buildSampleData } from '../data/samples';
import { collectionTotals } from '../utils/totals';
import type { CollectionRecord, RecordIdentity } from '../types';
import type { ConditionEstimate, Grade } from '../types';
import { completeGradePrices, rangeForCondition, sleeveFactor } from '../utils/grading';

const cond = (media: Grade, sleeve: Grade): ConditionEstimate => ({
  media: { grade: media, confidence: 0.8, summary: '', issues: [] },
  sleeve: { grade: sleeve, confidence: 0.8, summary: '', issues: [] },
});

const suggestions: Partial<Record<Grade, number>> = { M: 60, NM: 48, 'VG+': 30, VG: 16, 'G+': 9, G: 6, F: 3, P: 1.5 };

describe('value range for a condition', () => {
  it('uses the neighbouring grades as low and high, never a single number', () => {
    const r = rangeForCondition(suggestions, 'VG+', 'VG+')!;
    assert.deepEqual(r, { low: 16, avg: 30, high: 48 });
  });

  it('a worse sleeve scales the whole range down; a better sleeve does not add value', () => {
    const same = rangeForCondition(suggestions, 'VG+', 'VG+')!;
    const worse = rangeForCondition(suggestions, 'VG+', 'G+')!;
    const better = rangeForCondition(suggestions, 'VG+', 'NM')!;
    assert.ok(worse.avg < same.avg && worse.low < same.low && worse.high < same.high);
    assert.deepEqual(better, same);
    assert.equal(sleeveFactor('NM', 'P'), 0.55, 'floor');
  });

  it('handles the ends of the scale', () => {
    const top = rangeForCondition(suggestions, 'M', 'M')!;
    assert.ok(top.low < top.avg && top.avg < top.high);
    const bottom = rangeForCondition(suggestions, 'P', 'P')!;
    assert.ok(bottom.low < bottom.avg && bottom.avg < bottom.high);
  });

  it('fills missing grades from the nearest known one', () => {
    const t = completeGradePrices({ NM: 100 })!;
    assert.equal(t.NM, 100);
    assert.equal(t['VG+'], 60);
    assert.ok(t.M > t.NM && t.VG < t['VG+']);
    assert.equal(completeGradePrices({}), null);
  });

  it('falls back to a sensible spread when suggestions are flat', () => {
    const r = rangeForCondition({ NM: 20, 'VG+': 20, VG: 20 }, 'VG+', 'VG+')!;
    assert.ok(r.low < r.avg && r.avg < r.high);
  });
});

describe('priceFromServer', () => {
  it('builds a Discogs-sourced range with a link to the sales history', () => {
    const p = priceFromServer({ available: true, releaseId: 1873013, currency: 'GBP', byGrade: suggestions, lowestListing: 22, numForSale: 41, asOf: '2026-10-12T00:00:00Z' }, cond('VG', 'VG'))!;
    assert.equal(p.source, 'discogs');
    assert.equal(p.currency, 'GBP');
    assert.deepEqual([p.low, p.avg, p.high], [9, 16, 30]);
    assert.equal(p.recentSales.length, 0, 'the API has no individual sales, so none are invented');
    assert.equal(p.salesHistoryUrl, 'https://www.discogs.com/sell/history/1873013');
  });

  it('keeps only the lowest listing when there are no suggestions, and never makes a range from it', () => {
    const p = priceFromServer({ available: true, byGrade: {}, lowestListing: 10, numForSale: 3 }, cond('NM', 'NM'))!;
    assert.deepEqual([p.low, p.avg, p.high], [0, 0, 0], 'no x1.35 / x2.0 range');
    assert.equal(p.lowestListing, 10);
    assert.equal(hasPriceRange(p), false);
    assert.match(p.basis, /No Discogs price suggestions/);
  });

  it('returns null when Discogs data is unavailable so the caller shows "No price available"', () => {
    assert.equal(priceFromServer({ available: false, reason: 'no_token' }, cond('NM', 'NM')), null);
    assert.equal(priceFromServer({ available: true, byGrade: {} }, cond('NM', 'NM')), null);
  });
});

describe('Discogs 6-hour limit', () => {
  const fresh = priceFromServer({ available: true, releaseId: 65304, currency: 'USD', byGrade: suggestions, asOf: '2026-10-23T12:00:00Z' }, cond('VG+', 'VG+'))!;
  const at = Date.parse('2026-10-23T12:00:00Z');

  it('links the attribution to the Discogs release page', () => {
    assert.equal(fresh.releaseUrl, 'https://www.discogs.com/release/65304');
  });

  it('expires Discogs prices once they are more than 6 hours old', () => {
    assert.equal(isPriceExpired(fresh, at + DISCOGS_MAX_AGE_MS), false);
    assert.equal(isPriceExpired(fresh, at + DISCOGS_MAX_AGE_MS + 1), true);
  });

  it('never expires demo prices', () => {
    assert.equal(isPriceExpired({ ...fresh, source: 'demo' }, at + 10 * DISCOGS_MAX_AGE_MS), false);
  });

  it('strips every Discogs number from an expired price', () => {
    const e = expirePrice(fresh);
    assert.equal(isPriceExpired(e, at), true);
    assert.deepEqual([e.low, e.avg, e.high, e.lowestListing, e.numForSale], [0, 0, 0, undefined, undefined]);
    assert.deepEqual(e.byGrade, {});
    assert.equal(e.releaseUrl, fresh.releaseUrl);
  });
});

describe('no invented prices in release builds', () => {
  const identity = { artist: 'Test Artist', title: 'Test Title', catalogNumber: 'TT 1', country: 'UK', year: 1971, pressingType: 'original' } as RecordIdentity;
  const c = cond('VG+', 'VG');
  const server = (impl: () => Promise<Response>) => new ServerPriceProvider('https://example.test', impl as unknown as typeof fetch);
  const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it('runs the tests as a release build', () => {
    assert.equal(IS_DEV, false);
  });

  for (const [name, impl] of [
    ['the server is unreachable', async () => Promise.reject(new Error('offline'))],
    ['the server has no Discogs token', json({ available: false, reason: 'no_token' })],
    ['Discogs has no match', json({ available: false, reason: 'not_found' })],
    ['the server is rate limited', json({ error: 'busy' }, 429)],
    ['Discogs has no suggestions or listings', json({ available: true, byGrade: {} })],
  ] as const) {
    it(`shows "No price available" with a Discogs link when ${name}`, async () => {
      const p = await server(impl).getPrice(identity, c);
      assert.equal(p.source, 'none');
      assert.deepEqual([p.low, p.avg, p.high], [0, 0, 0]);
      assert.deepEqual(p.recentSales, []);
      assert.equal(p.lowestListing, undefined);
      assert.match(p.releaseUrl!, /^https:\/\/www\.discogs\.com\/search\/\?type=release&q=Test%20Artist%20Test%20Title%20TT%201$/);
      assert.equal(hasPriceRange(p, Date.now(), true), false);
      assert.equal(isExportablePrice(p), false);
    });
  }

  it('links straight to the release when Discogs found it', () => {
    assert.equal(noPrice({ ...identity, discogsReleaseId: 42 }).releaseUrl, 'https://www.discogs.com/release/42');
  });

  it('still returns real Discogs suggestions', async () => {
    const p = await server(json({ available: true, releaseId: 7, byGrade: suggestions, asOf: new Date().toISOString() })).getPrice(identity, c);
    assert.equal(p.source, 'discogs');
    assert.ok(hasPriceRange(p) && isExportablePrice(p));
  });

  it('example values only count on sample records or in development', () => {
    const demo = buildPrice(50, c, 1);
    assert.equal(hasPriceRange(demo), false);
    assert.equal(hasPriceRange(demo, Date.now(), true), true);
    assert.equal(isExportablePrice(demo), false, 'example values are never exported');
    assert.match(demo.basis, /^Example values/);
    assert.ok(demo.recentSales.every((s) => s.source === 'Example'));
  });

  it('replaces a saved invented price (old demo fallback) unless it is a sample or a development build', () => {
    const item = { price: buildPrice(50, c, 1) };
    assert.equal(withoutInventedPrice(item, identity, false).price.source, 'none');
    assert.equal(withoutInventedPrice({ ...item, isSample: true }, identity, false).price.source, 'demo');
    assert.equal(withoutInventedPrice(item, identity, true).price.source, 'demo');
  });
});

describe('collection totals', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  const { collection: samples } = buildSampleData(new Date(now));
  const rec = (price: CollectionRecord['price'], extra: Partial<CollectionRecord> = {}): CollectionRecord => ({ ...samples[0], isSample: false, price, ...extra });
  const discogs = priceFromServer({ available: true, releaseId: 1, currency: 'USD', byGrade: suggestions, asOf: new Date(now - 60_000).toISOString() }, cond('VG+', 'VG+'))!;

  it('adds up Discogs price suggestions only, and counts what was left out', () => {
    const t = collectionTotals(
      [rec(discogs), rec(noPrice(samples[0].identity)), rec(buildPrice(500, cond('NM', 'NM'), 3)), rec(expirePrice(discogs)), samples[1]],
      now,
      false,
    );
    assert.deepEqual([t.low, t.avg, t.high], [discogs.low, discogs.avg, discogs.high]);
    assert.equal(t.priced, 1);
    assert.equal(t.unpriced, 2, '"No price available" and an invented price on a real record');
    assert.equal(t.expired, 1);
    assert.equal(t.examplesLeftOut, 1);
    assert.equal(t.isExample, false);
  });

  it('shows a labelled example total when only sample records have values', () => {
    const t = collectionTotals(samples, now, false);
    assert.equal(t.isExample, true);
    assert.equal(t.priced, samples.length);
  });

  it('has nothing to total when no record has a price', () => {
    const t = collectionTotals([rec(noPrice(samples[0].identity))], now, false);
    assert.deepEqual([t.priced, t.low, t.unpriced, t.isExample], [0, 0, 1, false]);
  });

  it('never exports a Discogs price past the 6-hour limit', () => {
    assert.equal(isExportablePrice(discogs, now), true);
    assert.equal(isExportablePrice(discogs, Date.parse(discogs.asOf) + DISCOGS_MAX_AGE_MS + 1), false);
  });
});
