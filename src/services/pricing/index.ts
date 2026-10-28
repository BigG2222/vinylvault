import { env, IS_DEV } from '@/config';
import { findCatalogEntry, identityKey } from '@/data/catalog';
import { buildPrice } from '@/data/generate';
import type { ConditionEstimate, Grade, PriceEstimate, RecordIdentity } from '@/types';
import { hashString } from '@/utils/format';
import { serverHeaders } from '@/services/serverHeaders';
import { GRADES, rangeForCondition } from '@/utils/grading';

/**
 * Market value behind an interface. Always a low/average/high range, never a
 * single number. The server-backed provider uses Discogs price suggestions
 * (by grade) and marketplace stats. When Discogs has no price (or can't be
 * reached) the result is "No price available", never an invented number. The
 * demo provider's made-up example values exist only for development builds
 * and the store-screenshot sample records, and are labelled "Example".
 */
export interface PriceProvider {
  getPrice(identity: RecordIdentity, condition: ConditionEstimate): Promise<PriceEstimate>;
}

class DemoPriceProvider implements PriceProvider {
  async getPrice(identity: RecordIdentity, condition: ConditionEstimate) {
    const base = findCatalogEntry(identity)?.baseNM ?? (identity.pressingType === 'original' && identity.year < 1980 ? 60 : 25);
    return buildPrice(base, condition, hashString(identityKey(identity)));
  }
}

/**
 * Used whenever there is no real Discogs price: shows "No price available" with a link to the
 * record on Discogs, and is left out of collection totals and exports.
 */
export function noPrice(identity: Pick<RecordIdentity, 'artist' | 'title' | 'catalogNumber' | 'discogsUrl' | 'discogsReleaseId'>, reason = 'No price available for this pressing'): PriceEstimate {
  const search = `https://www.discogs.com/search/?type=release&q=${encodeURIComponent([identity.artist, identity.title, identity.catalogNumber].filter(Boolean).join(' '))}`;
  return {
    low: 0,
    avg: 0,
    high: 0,
    currency: 'USD',
    asOf: new Date().toISOString(),
    basis: reason,
    source: 'none',
    byGrade: {},
    recentSales: [],
    releaseUrl: identity.discogsUrl ?? (identity.discogsReleaseId ? `https://www.discogs.com/release/${identity.discogsReleaseId}` : search),
  };
}

/**
 * True when the price has a real value range that may be shown, added to totals and exported:
 * a Discogs price-suggestion range within the 6-hour limit. Demo example values count only
 * when `examples` is set (sample records and development builds).
 */
export function hasPriceRange(price: PriceEstimate, now = Date.now(), examples = false): boolean {
  if (price.avg <= 0 || price.high <= 0) return false;
  if (price.source === 'discogs') return !isPriceExpired(price, now);
  return price.source === 'demo' && examples;
}

/**
 * May this price go into a CSV/PDF export? Only a Discogs price-suggestion range within the 6-hour
 * limit of the Discogs API terms; never "No price available", an expired price or example values.
 */
export function isExportablePrice(price: PriceEstimate, now = Date.now()): boolean {
  return price.source === 'discogs' && hasPriceRange(price, now);
}

/**
 * Release builds never keep invented prices. Records priced by the old demo fallback
 * (before versionCode 5) get "No price available" instead; sample records keep their
 * clearly labelled example values.
 */
export function withoutInventedPrice<T extends { price: PriceEstimate; isSample?: boolean }>(item: T, identity: RecordIdentity, dev = IS_DEV): T {
  if (dev || item.isSample || item.price.source !== 'demo') return item;
  return { ...item, price: noPrice(identity) };
}

/** Shape returned by the server's GET /v1/price (see server/src/discogs.ts). */
export interface ServerPrice {
  available: boolean;
  reason?: string;
  releaseId?: number;
  url?: string;
  currency?: string;
  byGrade?: Partial<Record<Grade, number>>;
  lowestListing?: number | null;
  numForSale?: number | null;
  asOf?: string;
}

/**
 * Discogs API terms: Discogs data may not be shown if it is more than 6 hours older than on
 * discogs.com, nor kept longer than needed. Expired prices are stripped (expirePrice) and
 * fetched again when a record is opened.
 */
export const DISCOGS_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function isPriceExpired(price: PriceEstimate, now = Date.now()): boolean {
  if (price.source !== 'discogs') return false;
  if (price.expired) return true;
  const at = Date.parse(price.asOf);
  return !Number.isFinite(at) || now - at > DISCOGS_MAX_AGE_MS;
}

/** Drops the Discogs numbers from a price, keeping only what's needed to fetch it again. */
export function expirePrice(price: PriceEstimate): PriceEstimate {
  return { ...price, low: 0, avg: 0, high: 0, byGrade: {}, recentSales: [], lowestListing: undefined, numForSale: undefined, basis: 'Discogs price expired', expired: true };
}

/** Turns the server's Discogs numbers into a range for this copy's condition. Pure, so it is unit-tested. */
export function priceFromServer(p: ServerPrice, condition: ConditionEstimate): PriceEstimate | null {
  if (!p.available) return null;
  const byGrade: Partial<Record<Grade, number>> = {};
  for (const g of GRADES) if (typeof p.byGrade?.[g] === 'number' && p.byGrade[g]! > 0) byGrade[g] = p.byGrade[g];
  const media = condition.media.grade;
  const sleeve = condition.sleeve.grade;
  const common = {
    currency: p.currency ?? 'USD',
    asOf: p.asOf ?? new Date().toISOString(),
    source: 'discogs' as const,
    byGrade,
    recentSales: [],
    lowestListing: p.lowestListing ?? undefined,
    numForSale: p.numForSale ?? undefined,
    // The API has no individual sales, but the release's public sales-history page does.
    salesHistoryUrl: p.releaseId ? `https://www.discogs.com/sell/history/${p.releaseId}` : p.url,
    releaseUrl: p.url ?? (p.releaseId ? `https://www.discogs.com/release/${p.releaseId}` : undefined),
  };
  const range = rangeForCondition(byGrade, media, sleeve);
  if (range) return { ...range, ...common, basis: `Discogs price suggestions · media ${media}, sleeve ${sleeve}` };
  // No price suggestions: show only the lowest listing, as itself. No range is made up from it.
  if (p.lowestListing && p.lowestListing > 0) {
    return { low: 0, avg: 0, high: 0, ...common, basis: 'No Discogs price suggestions for this pressing' };
  }
  return null;
}

/** Release builds without a server: never invent a price. */
class NoPriceProvider implements PriceProvider {
  async getPrice(identity: RecordIdentity) {
    return noPrice(identity);
  }
}

export class ServerPriceProvider implements PriceProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async getPrice(identity: RecordIdentity, condition: ConditionEstimate) {
    const q = new URLSearchParams({ artist: identity.artist, title: identity.title, catno: identity.catalogNumber, country: identity.country, year: String(identity.year) });
    if (identity.discogsReleaseId) q.set('release_id', String(identity.discogsReleaseId));
    if (identity.barcode) q.set('barcode', identity.barcode);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20_000);
      const res = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/v1/price?${q}`, { signal: controller.signal, headers: serverHeaders() });
      clearTimeout(t);
      if (res.ok) {
        const price = priceFromServer((await res.json()) as ServerPrice, condition);
        if (price) return price;
      }
    } catch {
      // Timeout, offline or server error: no price rather than a made-up one.
    }
    return noPrice(identity);
  }
}

const cache = new Map<string, PriceEstimate>();
// Example prices only ever come from the demo provider in development (offline mock mode).
let provider: PriceProvider =
  env.visionProvider === 'proxy' && env.visionProxyUrl ? new ServerPriceProvider(env.visionProxyUrl) : IS_DEV ? new DemoPriceProvider() : new NoPriceProvider();

export function setPriceProvider(p: PriceProvider) {
  provider = p;
}

/** Cached per pressing + grade pair so offline re-opens still show a range. */
export async function getPrice(identity: RecordIdentity, condition: ConditionEstimate): Promise<PriceEstimate> {
  const key = `${identityKey(identity)}@${condition.media.grade}/${condition.sleeve.grade}`;
  try {
    const price = await provider.getPrice(identity, condition);
    cache.set(key, price);
    return price;
  } catch (e) {
    const cached = cache.get(key);
    if (cached && !isPriceExpired(cached)) return cached;
    throw e;
  }
}
