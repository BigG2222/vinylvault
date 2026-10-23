/**
 * Minimal Discogs API client for VinylVault's server.
 *
 * - Auth: a personal access token (DISCOGS_TOKEN) from discogs.com/settings/developers,
 *   sent as "Authorization: Discogs token=…". It never leaves this server.
 * - Rate limit: authenticated requests are limited to 60 per minute, so requests are
 *   queued at least ~1.1 s apart and a 429 is retried once after Retry-After.
 * - Caching: release lookups are cached in memory for at most 6 hours. Marketplace data
 *   (price suggestions, stats) is cached for at most 1 hour, and /v1/price reports when it
 *   was fetched, because the API terms forbid showing Discogs data more than 6 hours older
 *   than on discogs.com. The app hides Discogs prices once they pass that age.
 * - Attribution: the app shows "Data provided by Discogs." next to Discogs data, linked to
 *   the release page, and the required "not affiliated" notice.
 *
 * The API has no individual sold listings. Values come from price suggestions
 * (by grade; they need the token owner's Discogs seller settings filled in) and
 * marketplace stats (lowest current listing, number for sale).
 */

const API = 'https://api.discogs.com';
const USER_AGENT = 'VinylVault/0.1 +https://vinylvault.app';
const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MARKET_TTL_MS = 60 * 60 * 1000;

const token = () => process.env.DISCOGS_TOKEN?.trim() || '';
export const discogsEnabled = () => Boolean(token());

/** Discogs marketplace grade names → the app's Goldmine codes. */
const GRADE_FROM_DISCOGS: Record<string, string> = {
  'Mint (M)': 'M',
  'Near Mint (NM or M-)': 'NM',
  'Very Good Plus (VG+)': 'VG+',
  'Very Good (VG)': 'VG',
  'Good Plus (G+)': 'G+',
  'Good (G)': 'G',
  'Fair (F)': 'F',
  'Poor (P)': 'P',
};

const cache = new Map<string, { at: number; value: unknown }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DiscogsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function rawGet(path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(`${API}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Authorization: `Discogs token=${token()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 && attempt === 0) {
      await sleep(Math.min(30, Number(res.headers.get('retry-after')) || 5) * 1000);
      continue;
    }
    if (!res.ok) throw new DiscogsError(res.status, `Discogs ${res.status} for ${path.split('?')[0]}`);
    return res.json();
  }
  throw new DiscogsError(429, 'Discogs rate limit');
}

/** Serialized, throttled, cached GET. */
function get<T>(path: string, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T);
  const run = queue.then(() => rawGet(path));
  queue = run.catch(() => {});
  return run.then((value) => {
    cache.set(path, { at: Date.now(), value });
    return value as T;
  });
}

export interface ReleaseQuery {
  artist?: string;
  title?: string;
  catno?: string;
  country?: string;
  year?: number;
  barcode?: string;
}

interface SearchResult {
  id: number;
  title: string;
  country?: string;
  year?: string;
  catno?: string;
  barcode?: string[];
  format?: string[];
}

export interface ReleaseHit {
  id: number;
  url: string;
  country?: string;
  year?: number;
  catno?: string;
}

const norm = (s = '') => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const digits = (s = '') => s.replace(/\D/g, '').replace(/^0+/, '');

function score(r: SearchResult, q: ReleaseQuery): number {
  let s = 0;
  if (q.catno && norm(r.catno) === norm(q.catno)) s += 3;
  if (q.country && r.country && norm(r.country) === norm(q.country)) s += 2;
  if (q.year && Number(r.year) === q.year) s += 2;
  if (q.barcode && r.barcode?.some((b) => digits(b) === digits(q.barcode))) s += 4;
  if (r.format?.some((f) => /vinyl/i.test(f))) s += 1;
  return s;
}

/** Find the Discogs release that best matches a pressing. Tries barcode, then catalog number, then artist + title. */
export async function findRelease(q: ReleaseQuery): Promise<ReleaseHit | null> {
  const attempts: Record<string, string>[] = [];
  if (q.barcode && digits(q.barcode).length >= 8) attempts.push({ barcode: q.barcode });
  if (q.catno) attempts.push({ catno: q.catno, ...(q.artist ? { artist: q.artist } : {}) });
  if (q.artist && q.title) attempts.push({ artist: q.artist, release_title: q.title, ...(q.country ? { country: q.country } : {}), ...(q.year ? { year: String(q.year) } : {}) });

  for (const params of attempts) {
    const qs = new URLSearchParams({ type: 'release', format: 'Vinyl', per_page: '10', ...params });
    const data = await get<{ results?: SearchResult[] }>(`/database/search?${qs}`);
    const results = data.results ?? [];
    if (!results.length) continue;
    const best = results.reduce((a, b) => (score(b, q) > score(a, q) ? b : a));
    return { id: best.id, url: `https://www.discogs.com/release/${best.id}`, country: best.country, year: Number(best.year) || undefined, catno: best.catno };
  }
  return null;
}

export interface PriceData {
  currency: string;
  /** When the oldest part of this data was fetched from Discogs (ISO). */
  asOf: string;
  byGrade: Record<string, number>;
  lowestListing: number | null;
  numForSale: number | null;
}

export async function getPriceData(releaseId: number): Promise<PriceData> {
  const byGrade: Record<string, number> = {};
  let currency = 'USD';
  try {
    const s = await get<Record<string, { currency: string; value: number }>>(`/marketplace/price_suggestions/${releaseId}`, MARKET_TTL_MS);
    for (const [name, v] of Object.entries(s ?? {})) {
      const g = GRADE_FROM_DISCOGS[name];
      if (g && typeof v?.value === 'number') {
        byGrade[g] = Math.round(v.value * 100) / 100;
        currency = v.currency || currency;
      }
    }
  } catch (e) {
    // Price suggestions need the token owner's seller settings; without them we still return marketplace stats.
    if (!(e instanceof DiscogsError)) throw e;
  }
  let lowestListing: number | null = null;
  let numForSale: number | null = null;
  try {
    const st = await get<{ lowest_price?: { value: number; currency: string } | null; num_for_sale?: number }>(`/marketplace/stats/${releaseId}?curr_abbr=${currency}`, MARKET_TTL_MS);
    lowestListing = typeof st.lowest_price?.value === 'number' ? Math.round(st.lowest_price.value * 100) / 100 : null;
    numForSale = typeof st.num_for_sale === 'number' ? st.num_for_sale : null;
  } catch (e) {
    if (!(e instanceof DiscogsError)) throw e;
  }
  const fetched = [`/marketplace/price_suggestions/${releaseId}`, `/marketplace/stats/${releaseId}?curr_abbr=${currency}`]
    .map((p) => cache.get(p)?.at)
    .filter((t): t is number => typeof t === 'number');
  const asOf = new Date(fetched.length ? Math.min(...fetched) : Date.now()).toISOString();
  return { currency, asOf, byGrade, lowestListing, numForSale };
}
