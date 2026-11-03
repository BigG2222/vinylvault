import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSampleData, withoutSamples } from '../data/samples';

describe('sample records in release builds', () => {
  const { collection, scans } = buildSampleData(new Date('2026-11-03T12:00:00Z'));
  const own = { ...collection[0], id: 'mine', isSample: false };

  it('removes saved samples and keeps the user’s own records', () => {
    assert.deepEqual(withoutSamples([...collection, own], false), [own]);
    assert.equal(withoutSamples(scans, false).length, 0);
  });

  it('keeps samples in development, for store screenshots', () => {
    assert.equal(withoutSamples(collection, true).length, collection.length);
  });
});
