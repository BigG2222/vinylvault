import { env } from '@/config';
import { findCatalogEntry, identityKey } from '@/data/catalog';
import { buildPrice } from '@/data/generate';
import type { ConditionEstimate, Grade, PriceEstimate, RecordIdentity } from '@/types';
import { hashString } from '@/utils/format';
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
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v1/price?${q}`, { signal: controller.signal });
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
    if (cached) return cached;
    throw e;
  }
}
