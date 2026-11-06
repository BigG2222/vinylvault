import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleData } from '../data/samples';
import { priceFromServer } from '../services/pricing';
import { collectionToCsv, collectionToHtml, EXPORT_PRICE_NOTE } from '../services/export/format';
import type { CollectionRecord, ConditionEstimate, Grade } from '../types';

const cond = (media: Grade, sleeve: Grade): ConditionEstimate => ({
  media: { grade: media, confidence: 0.8, summary: '', issues: [] },
  sleeve: { grade: sleeve, confidence: 0.8, summary: '', issues: [] },
});

describe('collection exports', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const { collection: samples } = buildSampleData(new Date(now));
  const price = priceFromServer(
    { available: true, releaseId: 1, currency: 'USD', byGrade: { M: 61.11, NM: 48.37, 'VG+': 30.53, VG: 16.29 }, asOf: new Date(now - 60_000).toISOString() },
    cond('VG+', 'VG+'),
  )!;
  const record: CollectionRecord = { ...samples[0], isSample: false, price };

  it('CSV carries no Discogs prices or price columns, only the release link', () => {
    const csv = collectionToCsv([record], now);
    const header = csv.split('\n')[0];
    for (const col of ['Low', 'Avg', 'High', 'Currency', 'Price']) assert.ok(!header.split(',').includes(col), col);
    for (const n of [price.low, price.avg, price.high]) assert.ok(!csv.includes(String(n)), `price ${n} leaked`);
    assert.ok(!csv.includes('USD'));
    assert.ok(csv.includes(EXPORT_PRICE_NOTE));
  });

  it('PDF report carries no Discogs prices or totals', () => {
    const html = collectionToHtml([record], now);
    for (const n of [price.low, price.avg, price.high]) assert.ok(!html.includes(String(n)), `price ${n} leaked`);
    assert.ok(!/\$|USD|Total/.test(html));
    assert.ok(html.includes(EXPORT_PRICE_NOTE));
  });
});
