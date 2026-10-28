import { IS_DEV } from '../config';
import { hasPriceRange, isPriceExpired } from '../services/pricing';
import type { CollectionRecord } from '../types';

/**
 * Collection total as a range, from Discogs price suggestions only. Records with no Discogs price
 * ("No price available"), expired Discogs prices and example values are never added in; they are
 * counted so the screen can say what was left out. Records priced in a different currency from the
 * majority are left out too. Only when nothing has a real price do sample records' example values
 * make an example total (isExample), which the screen labels as such.
 */
export function collectionTotals(all: CollectionRecord[], now = Date.now(), dev = IS_DEV) {
  const real = all.filter((r) => r.price.source === 'discogs' && hasPriceRange(r.price, now));
  const examples = all.filter((r) => r.price.source === 'demo' && hasPriceRange(r.price, now, dev || Boolean(r.isSample)));
  const isExample = real.length === 0 && examples.length > 0;
  const records = isExample ? examples : real;
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.price.currency, (counts.get(r.price.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD';
  const same = records.filter((r) => r.price.currency === currency);
  const sum = same.reduce((t, c) => ({ low: t.low + c.price.low, avg: t.avg + c.price.avg, high: t.high + c.price.high }), { low: 0, avg: 0, high: 0 });
  const expired = all.filter((r) => isPriceExpired(r.price, now)).length;
  return {
    ...sum,
    currency,
    priced: same.length,
    excluded: records.length - same.length,
    expired,
    /** Records with no Discogs price (or only a lowest listing), not counted in the total. */
    unpriced: all.length - real.length - examples.length - expired,
    /** Sample records with example values, left out because real prices exist. */
    examplesLeftOut: isExample ? 0 : examples.length,
    isExample,
  };
}
