import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DISCOGS_MAX_AGE_MS, expirePrice, isPriceExpired, priceFromServer } from '../services/pricing';
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

  it('uses the lowest listing when there are no suggestions, and says so', () => {
    const p = priceFromServer({ available: true, byGrade: {}, lowestListing: 10 }, cond('NM', 'NM'))!;
    assert.ok(p.low < p.avg && p.avg < p.high);
    assert.match(p.basis, /Lowest current Discogs listing/);
  });

  it('returns null when Discogs data is unavailable so the caller can fall back to demo values', () => {
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
