/**
 * Vision + pricing proxy for VinylVault.
 *
 * The app never holds an API key: it POSTs photos here, and this server calls
 * Claude with a strict JSON schema and returns the structured result, enriched
 * with Discogs release IDs when a Discogs token is configured. GET /v1/price
 * returns Discogs price suggestions for a release.
 *
 * Production checklist: authenticate app requests (App Attest / Play Integrity
 * or signed user tokens), rate-limit per user to enforce plan limits
 * server-side, avoid logging images, and review the Discogs API terms before
 * charging for an app that shows Discogs data.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { discogsEnabled, findRelease, getPriceData, type ReleaseQuery } from './discogs.ts';
import { clientIp, deviceId, LIMITS, take, usageSummary } from './limits.ts';
import { SYSTEM_PROMPT, VISION_SCHEMA } from './schema.ts';

const MODEL = process.env.VISION_MODEL ?? 'claude-opus-5-5';
// CardVault's server uses 8787, so both can run side by side.
const PORT = Number(process.env.PORT ?? 8788);
const MAX_BODY_BYTES = 16 * 1024 * 1024;
// When set, /v1/* requests must send the app's EXPO_PUBLIC_APP_KEY in X-App-Key. APP_KEY_SHA256 (the key's
// SHA-256 in hex) lets render.yaml carry a fingerprint instead of the key itself, and takes precedence.
const APP_KEY = process.env.APP_KEY ?? '';
const APP_KEY_SHA256 = (process.env.APP_KEY_SHA256 ?? '').toLowerCase();
const PRIVACY_HTML = new URL('../public/privacy.html', import.meta.url);
const SUPPORT_HTML = new URL('../public/support.html', import.meta.url);

// Reads ANTHROPIC_API_KEY (or another configured credential) from the environment.
const client = new Anthropic();

type Role = 'front' | 'back' | 'label' | 'runout';

interface AnalyzeBody {
  images: { role: Role; base64: string }[];
  confirmedIdentity?: Record<string, unknown>;
  hints?: {
    ocr?: { text: string; catalogNumbers: string[]; labels: string[]; countries: string[]; years: number[]; channels: string | null } | null;
    barcode?: string | null;
    qualityIssues?: string[];
  };
}

const ROLE_LABEL: Record<Role, string> = {
  front: 'Front cover:',
  back: 'Back cover:',
  label: 'Center label (side A):',
  runout: 'Runout / dead wax close-up:',
};

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function analyze(body: AnalyzeBody) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of body.images.slice(0, 4)) {
    content.push({ type: 'text', text: ROLE_LABEL[img.role] ?? 'Photo:' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 } });
  }

  const has = (r: Role) => body.images.some((i) => i.role === r);
  const hints = body.hints ?? {};
  const notes = [
    !has('back') && 'No back cover photo was provided.',
    !has('label') && 'No center label photo was provided.',
    !has('runout') && 'No runout photo was provided.',
    hints.barcode === 'none' && 'The collector checked the sleeve and says it has no barcode.',
    hints.barcode && hints.barcode !== 'none' && `The phone camera scanned this barcode from the sleeve: ${hints.barcode}.`,
    hints.ocr?.text && `On-device OCR text from the label and back cover (may contain errors): ${hints.ocr.text}`,
    hints.ocr?.catalogNumbers?.length && `Catalog-number-like strings found by OCR: ${hints.ocr.catalogNumbers.join(', ')}.`,
    hints.qualityIssues?.length && `Photo quality notes from the device: ${hints.qualityIssues.join('; ')}.`,
    body.confirmedIdentity &&
      `The collector confirmed this pressing: ${JSON.stringify(body.confirmedIdentity)}. Put it first and evaluate every check against this pressing's documented details.`,
  ].filter(Boolean);
  content.push({ type: 'text', text: `${notes.join('\n')}\n\nAnalyze this record.` });

  // One retry covers the occasional response that isn't valid JSON.
  for (let attempt = 1; ; attempt++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: VISION_SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    console.log(`  ${body.images.length} photo(s), model: ${response.model}, stop: ${response.stop_reason}, output tokens: ${response.usage.output_tokens}`);
    if (response.stop_reason === 'refusal') throw new HttpError(422, 'The images could not be analyzed.');
    if (response.stop_reason === 'max_tokens') throw new HttpError(502, 'Analysis was cut off.');
    // The JSON can arrive split across several text blocks, so join them all.
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    if (!text) throw new HttpError(502, 'Empty model response.');
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      const blocks = response.content.map((b) => b.type).join(', ');
      console.error(`  Unreadable JSON (attempt ${attempt}; blocks: ${blocks}): ${(e as Error).message}`);
      writeFileSync(new URL('../last-bad-response.json', import.meta.url), JSON.stringify(response.content, null, 2));
      if (attempt < 2) continue;
      throw new HttpError(502, 'The analysis came back unreadable.');
    }
    for (const m of result.matches ?? []) {
      if (typeof m.format === 'string') m.format = m.format.replace(/^(\d+)in\b/, '$1"');
    }
    if (discogsEnabled()) await enrichWithDiscogs(result.matches ?? [], hints.barcode);
    return { ...result, model: response.model };
  }
}

/** Look each candidate up on Discogs so the app can link to it and price it. Failures leave the match as-is. */
async function enrichWithDiscogs(matches: Record<string, any>[], scannedBarcode?: string | null) {
  for (const [i, m] of matches.slice(0, 3).entries()) {
    try {
      const hit = await findRelease({
        artist: m.artist,
        title: m.title,
        catno: m.catalog_number,
        country: m.country,
        year: m.year,
        // A scanned barcode belongs to the physical copy, so only use it for the top candidate.
        barcode: m.barcode || (i === 0 && scannedBarcode && scannedBarcode !== 'none' ? scannedBarcode : undefined),
      });
      if (hit) {
        m.discogs_release_id = hit.id;
        m.discogs_url = hit.url;
        m.discogs_verified = Boolean(hit.catno && m.catalog_number && hit.catno.replace(/\W/g, '').toUpperCase() === String(m.catalog_number).replace(/\W/g, '').toUpperCase());
      }
    } catch (e) {
      console.warn('Discogs lookup failed:', (e as Error).message);
    }
  }
}

async function price(url: URL) {
  if (!discogsEnabled()) return { available: false, reason: 'no_token' };
  const p = url.searchParams;
  let releaseId = Number(p.get('release_id')) || 0;
  let releaseUrl: string | undefined;
  if (!releaseId) {
    const q: ReleaseQuery = {
      artist: p.get('artist') ?? undefined,
      title: p.get('title') ?? undefined,
      catno: p.get('catno') ?? undefined,
      country: p.get('country') ?? undefined,
      year: Number(p.get('year')) || undefined,
      barcode: p.get('barcode') ?? undefined,
    };
    const hit = await findRelease(q);
    if (!hit) return { available: false, reason: 'not_found' };
    releaseId = hit.id;
    releaseUrl = hit.url;
  }
  const data = await getPriceData(releaseId);
  return {
    available: true,
    releaseId,
    url: releaseUrl ?? `https://www.discogs.com/release/${releaseId}`,
    ...data,
    asOf: new Date().toISOString(),
  };
}

async function readJson(req: IncomingMessage): Promise<AnalyzeBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Images too large.');
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as AnalyzeBody;
  if (!Array.isArray(body.images) || !body.images.some((i) => i.role === 'front')) throw new HttpError(400, 'A front cover image is required.');
  return body;
}

function hasAppKey(req: IncomingMessage) {
  if (!APP_KEY && !APP_KEY_SHA256) return true;
  const sentKey = String(req.headers['x-app-key'] ?? '');
  const sent = APP_KEY_SHA256 ? Buffer.from(createHash('sha256').update(sentKey).digest('hex')) : Buffer.from(sentKey);
  const want = Buffer.from(APP_KEY_SHA256 || APP_KEY);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

const LIMIT_MESSAGE: Record<string, string> = {
  device: 'Daily scan limit reached on this phone. It resets at midnight UTC.',
  ip: 'Daily scan limit reached on this network. It resets at midnight UTC.',
  total: 'VinylVault is very busy today. Please try again tomorrow.',
};

/** Applies the daily caps for one analysis; throws 429 when any is full. */
function takeScan(req: IncomingMessage) {
  const dev = deviceId(req);
  const keys: [string, number][] = [
    ['total:analyze', LIMITS.analyzeTotal],
    [`ip:analyze:${clientIp(req)}`, LIMITS.analyzePerIp],
  ];
  if (dev) keys.push([`device:analyze:${dev}`, LIMITS.analyzePerDevice]);
  const full = take(keys);
  if (full) {
    console.log(`  refused: ${full} daily limit`);
    throw new HttpError(429, LIMIT_MESSAGE[full]);
  }
}

function takePrice(req: IncomingMessage) {
  const dev = deviceId(req) || clientIp(req);
  if (take([[`device:price:${dev}`, LIMITS.pricePerDevice]])) throw new HttpError(429, 'Daily price lookup limit reached.');
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

createServer(async (req, res) => {
  // Allow the Expo web preview (a different localhost port) to call the server during development.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Key, X-Device-Id');
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();

  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/health') console.log(`${new Date().toLocaleTimeString()} ${req.method} ${url.pathname}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, model: MODEL, discogs: discogsEnabled(), usage: usageSummary() });
    if (req.method === 'GET' && url.pathname === '/privacy') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return void res.end(readFileSync(PRIVACY_HTML));
    }
    if (req.method === 'GET' && url.pathname === '/support') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return void res.end(readFileSync(SUPPORT_HTML));
    }
    if (url.pathname.startsWith('/v1/') && !hasAppKey(req)) return send(res, 401, { error: 'Unauthorized' });
    if (req.method === 'GET' && url.pathname === '/v1/price') {
      takePrice(req);
      return send(res, 200, await price(url));
    }
    if (req.method === 'POST' && url.pathname === '/v1/analyze') {
      const body = await readJson(req);
      takeScan(req);
      return send(res, 200, await analyze(body));
    }
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(`${new Date().toLocaleTimeString()} ${req.method} ${url.pathname} failed: ${e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)}`);
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    if (e instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'Busy, retry shortly.' });
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic rejected the API key. Check ANTHROPIC_API_KEY in server/.env.');
      return send(res, 502, { error: 'Server API key problem.' });
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error(e.message);
      return send(res, 422, { error: 'The images could not be analyzed.' });
    }
    if (e instanceof Anthropic.APIConnectionError) return send(res, 503, { error: 'Upstream unavailable.' });
    if (e instanceof SyntaxError) return send(res, 400, { error: 'Invalid JSON.' });
    console.error(e);
    send(res, 500, { error: 'Internal error' });
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`VinylVault server on :${PORT} using ${MODEL}`);
  console.log(discogsEnabled() ? 'Discogs: token found, prices and release links are on.' : 'Discogs: no token, the app will show demo prices.');
  console.log(`Limits per day: ${LIMITS.analyzePerDevice} scans per phone, ${LIMITS.analyzePerIp} per network, ${LIMITS.analyzeTotal} in total.${APP_KEY || APP_KEY_SHA256 ? ' App key required.' : ''}`);
});
