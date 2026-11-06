import { DISCOGS_ATTRIBUTION, DISCOGS_NOTICE } from '@/config';
import { verdictMeta } from '@/theme/tokens';
import type { CollectionRecord } from '@/types';
import { formatDate } from '@/utils/format';

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const utc = (iso: string | number) => `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/**
 * Exports carry no Discogs prices. Discogs marks price suggestions as Restricted Data that may
 * not be passed to third parties, and an exported file can be kept and shared indefinitely.
 * Prices stay inside the app, where the 6-hour refresh rule is enforced. Each record keeps a
 * link to its Discogs release page so the user can check the current price there.
 */
const discogsLink = (r: CollectionRecord) => r.identity.discogsUrl ?? r.price.releaseUrl;

export const EXPORT_PRICE_NOTE = 'Prices are not included in exports. Open a record in the app, or its Discogs page, for current prices.';

export function collectionToCsv(records: CollectionRecord[], now = Date.now()): string {
  const header = [
    'Artist', 'Title', 'Label', 'Catalog #', 'Country', 'Year', 'Original Year', 'Format', 'Discs', 'Genre', 'Variant', 'Barcode',
    'Pressing (AI estimate)', 'Media Grade', 'Sleeve Grade', 'Discogs Release', 'Tags', 'Notes',
  ];
  const rows = records.map((r) => {
    const i = r.identity;
    return [
      i.artist, i.title, i.label, i.catalogNumber, i.country, i.year, i.originalYear, i.format, i.discs, i.genre, i.variant, i.barcode,
      verdictMeta[r.verdict].label, r.condition.media.grade, r.condition.sleeve.grade, discogsLink(r), r.tags.join('; '), r.notes,
    ];
  });
  const footer = [
    `Exported ${utc(now)}. ${EXPORT_PRICE_NOTE} Pressing results are AI estimates from photos, not proof of authenticity. Grades are estimates from photos.`,
  ];
  return [header, ...rows, [], footer].map((row) => row.map(csvCell).join(',')).join('\n');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export function collectionToHtml(records: CollectionRecord[], now = Date.now()): string {
  const usesDiscogs = records.some((r) => !!discogsLink(r));
  const rows = records
    .map((r) => {
      const i = r.identity;
      const link = discogsLink(r);
      return `<tr>
        <td><strong>${esc(i.artist)}</strong> – ${esc(i.title)}<br/><span class="m">${esc(i.label)} ${esc(i.catalogNumber)} · ${esc(i.country)} ${i.year}${i.variant ? ` · ${esc(i.variant)}` : ''}</span></td>
        <td style="color:${verdictMeta[r.verdict].color}">${verdictMeta[r.verdict].label}</td>
        <td>${r.condition.media.grade} / ${r.condition.sleeve.grade}</td>
        <td>${link ? `<a href="${esc(link)}">Discogs page</a>` : '<span class="m">–</span>'}</td>
      </tr>`;
    })
    .join('');
  return `<html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial;color:#111;padding:28px}
    h1{font-family:Georgia,serif;font-weight:600;margin:0 0 4px}
    .m{color:#666;font-size:11px}a{color:#111}
    table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
    th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
    td{border-bottom:1px solid #e5e5e5;padding:8px 4px;vertical-align:top}
  </style></head><body>
    <h1>VinylVault Collection</h1>
    <div class="m">${records.length} records · Exported ${formatDate(new Date(now).toISOString(), true)}</div>
    <p class="m"><strong>${EXPORT_PRICE_NOTE}</strong></p>
    <table><thead><tr><th>Record</th><th>Pressing (AI estimate)</th><th>Media / sleeve</th><th>Link</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="m">Grades are estimates from photos. Pressing results are AI estimates, not proof of authenticity. Photos cannot reveal how a record sounds.${usesDiscogs ? ` ${DISCOGS_ATTRIBUTION} ${DISCOGS_NOTICE}` : ''}</p>
  </body></html>`;
}
