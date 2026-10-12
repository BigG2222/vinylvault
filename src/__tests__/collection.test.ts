import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleData } from '../data/samples';
import { activeFilterCount, EMPTY_FILTERS, filterRecords, topArtists } from '../utils/filterRecords';

const { collection, scans } = buildSampleData(new Date('2026-10-12T12:00:00Z'));

describe('sample data', () => {
  it('builds a coherent collection with ranges, both grades and every check', () => {
    assert.ok(collection.length >= 8);
    for (const r of collection) {
      assert.ok(r.price.low < r.price.avg && r.price.avg < r.price.high, r.identity.title);
      assert.equal(r.checks.length, 8);
      assert.ok(r.condition.media.grade && r.condition.sleeve.grade);
      assert.equal(r.price.source, 'demo');
    }
    assert.ok(scans.length > 0);
  });

  it('shows every verdict at least once so first-run screens explain them all', () => {
    const verdicts = new Set(collection.map((r) => r.verdict));
    for (const v of ['likely_original', 'reissue', 'needs_review', 'possible_bootleg'] as const) assert.ok(verdicts.has(v), v);
  });
});

describe('collection search & filters', () => {
  it('matches multi-word queries across fields', () => {
    const r = filterRecords(collection, { ...EMPTY_FILTERS, query: 'floyd harvest 1973' });
    assert.equal(r.length, 1);
    assert.equal(r[0].identity.catalogNumber, 'SHVL 804');
  });

  it('searches catalog numbers with or without spaces, and pressing type', () => {
    assert.equal(filterRecords(collection, { ...EMPTY_FILTERS, query: 'blp4157' })[0]?.identity.artist, 'Lee Morgan');
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, query: 'reissue' }).every((r) => r.identity.pressingType === 'reissue'));
  });

  it('filters by artist, genre, format, decade, value, grade and tag, and sorts', () => {
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, genres: ['Jazz'] }).every((r) => r.identity.genre === 'Jazz'));
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, artists: ['Miles Davis'] }).every((r) => r.identity.artist === 'Miles Davis'));
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, formats: ['LP'] }).length === collection.length);
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, decade: 1970 }).every((r) => r.identity.year >= 1970 && r.identity.year <= 1979));
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, value: 'over500' }).every((r) => r.price.avg > 500));
    const vgPlus = filterRecords(collection, { ...EMPTY_FILTERS, minGrade: 'VG+' });
    assert.ok(vgPlus.every((r) => ['M', 'NM', 'VG+'].includes(r.condition.media.grade)));
    assert.ok(filterRecords(collection, { ...EMPTY_FILTERS, tag: 'First Pressings' }).every((r) => r.tags.includes('First Pressings')));
    const byValue = filterRecords(collection, { ...EMPTY_FILTERS, sort: 'value' });
    assert.ok(byValue[0].price.avg >= byValue[byValue.length - 1].price.avg);
    const byArtist = filterRecords(collection, { ...EMPTY_FILTERS, sort: 'artist' });
    assert.ok(byArtist[0].identity.artist.localeCompare(byArtist[byArtist.length - 1].identity.artist) <= 0);
    assert.equal(activeFilterCount({ ...EMPTY_FILTERS, genres: ['Rock'], decade: 1960, minGrade: 'NM' }), 3);
  });

  it('lists top artists for the filter chips', () => {
    assert.ok(topArtists(collection).includes('Pink Floyd'));
  });
});
