import { env } from '@/config';
import { findCatalogEntry, identityKey } from '@/data/catalog';
import { buildPrice } from '@/data/generate';
import type { ConditionEstimate, Grade, PriceEstimate, RecordIdentity } from '@/types';
import { hashString } from '@/utils/format';
import { serverHeaders } from '@/services/serverHeaders';
import { GRADES, rangeForCondition } from '@/utils/grading';

/**
 * Market value behind an interface. Always a low/average/high range, never a
 * single number. The server-backed provider uses Discogs price suggestions
 * (by grade) and marketplace stats; the demo provider makes plausible
 * placeholder numbers that are clearly labelled as such.
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
  if (p.lowestListing && p.lowestListing > 0) {
    const l = p.lowestListing;
    return { low: l, avg: Math.round(l * 135) / 100, high: Math.round(l * 200) / 100, ...common, basis: 'Lowest current Discogs listing only (no price suggestions for this release)' };
  }
  return null;
}

class ServerPriceProvider implements PriceProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fallback: PriceProvider,
  ) {}

  async getPrice(identity: RecordIdentity, condition: ConditionEstimate) {
    const q = new URLSearchParams({ artist: identity.artist, title: identity.title, catno: identity.catalogNumber, country: identity.country, year: String(identity.year) });
    if (identity.discogsReleaseId) q.set('release_id', String(identity.discogsReleaseId));
    if (identity.barcode) q.set('barcode', identity.barcode);
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/price?${q}`, { signal: controller.signal, headers: serverHeaders() });
      clearTimeout(t);
      if (res.ok) {
        const price = priceFromServer((await res.json()) as ServerPrice, condition);
        if (price) return price;
      }
    } catch {
      // Fall through to demo values; the result screen labels them as such.
    }
    return this.fallback.getPrice(identity, condition);
  }
}

const cache = new Map<string, PriceEstimate>();
const demo = new DemoPriceProvider();
let provider: PriceProvider = env.visionProvider === 'proxy' && env.visionProxyUrl ? new ServerPriceProvider(env.visionProxyUrl, demo) : demo;

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
