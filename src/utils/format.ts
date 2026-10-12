const formatters = new Map<string, { whole: Intl.NumberFormat; cents: Intl.NumberFormat }>();

function fmt(currency: string) {
  let f = formatters.get(currency);
  if (!f) {
    f = {
      whole: new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }),
      cents: new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }),
    };
    formatters.set(currency, f);
  }
  return f;
}

/** Prices carry their own currency (Discogs price suggestions use the account's selling currency). */
export function money(value: number, precise = false, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '—';
  const f = fmt(currency);
  if (precise || value < 100) return f.cents.format(value);
  return f.whole.format(value);
}

export function compactMoney(value: number, currency = 'USD'): string {
  const symbol = fmt(currency).whole.formatToParts(0).find((p) => p.type === 'currency')?.value ?? '$';
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000) return `${symbol}${Math.round(value / 1000)}K`;
  if (value >= 1_000) return `${symbol}${(value / 1000).toFixed(1)}K`;
  return money(value, false, currency);
}

export function moneyRange(low: number, high: number, currency = 'USD'): string {
  return `${compactMoney(low, currency)} – ${compactMoney(high, currency)}`;
}

export function percent(value01: number): string {
  return `${Math.round(value01 * 100)}%`;
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function formatDate(iso: string, withYear = false): string {
  const d = new Date(iso);
  return (withYear ? fullDate : shortDate).format(d);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso, true);
}

/** "Abbey Road · Apple PCS 7088" style subtitle for a pressing. */
export function pressingLine(i: { label: string; catalogNumber: string }): string {
  return i.catalogNumber ? `${i.label} ${i.catalogNumber}` : i.label;
}

/** "UK · 1969" or "US · 1977 (orig. 1959)". */
export function originLine(i: { country: string; year: number; originalYear?: number }): string {
  const orig = i.originalYear && i.originalYear !== i.year ? ` (orig. ${i.originalYear})` : '';
  return `${i.country} · ${i.year}${orig}`;
}

export function formatLine(i: { format: string; discs: number; variant?: string }): string {
  const disc = i.discs > 1 ? `${i.discs}×${i.format}` : i.format;
  return i.variant ? `${disc} · ${i.variant}` : disc;
}

export function confidenceLabel(c: number): 'Very high' | 'High' | 'Moderate' | 'Low' {
  if (c >= 0.93) return 'Very high';
  if (c >= 0.82) return 'High';
  if (c >= 0.65) return 'Moderate';
  return 'Low';
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Small deterministic string hash, used to pick stable mock results per image. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
