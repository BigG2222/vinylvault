import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DISCOGS_ATTRIBUTION } from '@/config';
import { collectionTotals } from '@/store';
import { verdictMeta } from '@/theme';
import type { CollectionRecord } from '@/types';
import { formatDate, money } from '@/utils/format';

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function collectionToCsv(records: CollectionRecord[]): string {
  const header = [
    'Artist', 'Title', 'Label', 'Catalog #', 'Country', 'Year', 'Original Year', 'Format', 'Discs', 'Genre', 'Variant', 'Barcode',
    'Pressing', 'Media Grade', 'Sleeve Grade', 'Low', 'Avg', 'High', 'Currency', 'Price Source', 'Price As Of', 'Discogs Release', 'Tags', 'Notes',
  ];
  const rows = records.map((r) => {
    const i = r.identity;
    return [
      i.artist, i.title, i.label, i.catalogNumber, i.country, i.year, i.originalYear, i.format, i.discs, i.genre, i.variant, i.barcode,
      verdictMeta[r.verdict].label, r.condition.media.grade, r.condition.sleeve.grade, r.price.low, r.price.avg, r.price.high, r.price.currency,
      r.price.source === 'discogs' ? 'Discogs' : 'Demo estimate', formatDate(r.price.asOf, true), i.discogsUrl, r.tags.join('; '), r.notes,
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function exportCsv(records: CollectionRecord[]) {
  const file = new File(Paths.cache, `vinylvault-collection-${Date.now()}.csv`);
  file.write(collectionToCsv(records));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export collection', UTI: 'public.comma-separated-values-text' });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export async function exportPdf(records: CollectionRecord[]) {
  const totals = collectionTotals(records);
  const cur = totals.currency;
  const usesDiscogs = records.some((r) => r.price.source === 'discogs');
  const rows = records
    .map((r) => {
      const i = r.identity;
      return `<tr>
        <td><strong>${esc(i.artist)}</strong> – ${esc(i.title)}<br/><span class="m">${esc(i.label)} ${esc(i.catalogNumber)} · ${esc(i.country)} ${i.year}${i.variant ? ` · ${esc(i.variant)}` : ''}</span></td>
        <td style="color:${verdictMeta[r.verdict].color}">${verdictMeta[r.verdict].label}</td>
        <td>${r.condition.media.grade} / ${r.condition.sleeve.grade}</td>
        <td class="r">${money(r.price.low, false, r.price.currency)} – ${money(r.price.high, false, r.price.currency)}<br/><span class="m">avg ${money(r.price.avg, false, r.price.currency)}</span></td>
      </tr>`;
    })
    .join('');
  const html = `<html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial;color:#111;padding:28px}
    h1{font-family:Georgia,serif;font-weight:600;margin:0 0 4px}
    .m{color:#666;font-size:11px}.r{text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:18px;font-size:12px}
    th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
    td{border-bottom:1px solid #e5e5e5;padding:8px 4px;vertical-align:top}
  </style></head><body>
    <h1>VinylVault Collection</h1>
    <div class="m">${records.length} records · Exported ${formatDate(new Date().toISOString(), true)}</div>
    <p><strong>Estimated value:</strong> ${money(totals.low, false, cur)} – ${money(totals.high, false, cur)} (avg ${money(totals.avg, false, cur)})${totals.excluded ? ` · ${totals.excluded} record(s) in other currencies not included` : ''}</p>
    <table><thead><tr><th>Record</th><th>Pressing</th><th>Media / sleeve</th><th class="r">Value range</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="m">Grades and values are estimates from photos and are not appraisals. Photos cannot reveal how a record sounds.${usesDiscogs ? ` ${DISCOGS_ATTRIBUTION}` : ''}</p>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export collection', UTI: 'com.adobe.pdf' });
}
