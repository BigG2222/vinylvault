/**
 * Daily usage caps that bound model and Discogs costs. Counters live in memory
 * and reset at midnight UTC (and on restart), which is fine for one server
 * instance. Every limit can be tuned with an environment variable.
 */
import type { IncomingMessage } from 'node:http';

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const LIMITS = {
  // The app allows 10 scans a day; the margin covers retries after network errors.
  analyzePerDevice: num('DEVICE_DAILY_SCANS', 15),
  // Several phones can share one home network, so this sits well above the per-device cap.
  analyzePerIp: num('IP_DAILY_SCANS', 60),
  // Hard ceiling across everyone: the most model calls the server will make in a day.
  analyzeTotal: num('TOTAL_DAILY_SCANS', 300),
  pricePerDevice: num('DEVICE_DAILY_PRICES', 300),
};

let day = '';
const counters = new Map<string, number>();

function today() {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    counters.clear();
  }
}

/** Client address. Behind a hosting provider's proxy, set TRUST_PROXY=1 to read X-Forwarded-For. */
export function clientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function deviceId(req: IncomingMessage): string {
  const id = req.headers['x-device-id'];
  const v = Array.isArray(id) ? id[0] : id;
  // Accept only the app's own ID shape so the header can't be used to flood the counter map.
  return v && /^[A-Za-z0-9_-]{6,64}$/.test(v) ? v : '';
}

/**
 * Counts one use against every key and returns the first cap that is already
 * full, or null if the request may go ahead. Nothing is counted when refused.
 */
export function take(keys: [key: string, max: number][]): string | null {
  today();
  for (const [key, max] of keys) {
    if ((counters.get(key) ?? 0) >= max) return key.split(':')[0];
  }
  for (const [key] of keys) counters.set(key, (counters.get(key) ?? 0) + 1);
  return null;
}

export function usageSummary() {
  today();
  return { day, totalScans: counters.get('total:analyze') ?? 0, totalCap: LIMITS.analyzeTotal };
}
