import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DISCOGS_ATTRIBUTION, DISCOGS_NOTICE } from '@/config';
import { isExportablePrice, isPriceExpired } from '@/services/pricing';
import { collectionTotals } from '@/store';
import { verdictMeta } from '@/theme';
import type { CollectionRecord } from '@/types';
import { formatDate, money } from '@/utils/format';

const csvCell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const utc = (iso: string | number) => `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/**
 * Exports only carry Discogs price suggestions within the 6-hour limit of the Discogs API terms,
 * each with the time it was fetched and a line to check current prices on Discogs. Expired prices,
 * "No price available" and example values (sample records) leave the value columns empty.
 */
const priceNote = (r: CollectionRecord, now: number) =>
  isExportablePrice(r.price, now)
    ? `Discogs price suggestion as of ${utc(r.price.asOf)}; check Discogs for current prices`
    : isPriceExpired(r.price, now)
      ? 'Discogs price expired: open the record in the app to refresh'
      : 'No price available';

export function collectionToCsv(records: CollectionRecord[], now = Date.now()): string {
  const header = [
    'Artist', 'Title', 'Label', 'Catalog #', 'Country', 'Year', 'Original Year', 'Format', 'Discs', 'Genre', 'Variant', 'Barcode',
    'Pressing (AI estimate)', 'Media Grade', 'Sleeve Grade', 'Low', 'Avg', 'High', 'Currency', 'Price Note', 'Discogs Release', 'Tags', 'Notes',
  ];
  const rows = records.map((r) => {
    const i = r.identity;
    const ok = isExportablePrice(r.price, now);
    return [
      i.artist, i.title, i.label, i.catalogNumber, i.country, i.year, i.originalYear, i.format, i.discs, i.genre, i.variant, i.barcode,
      verdictMeta[r.verdict].label, r.condition.media.grade, r.condition.sleeve.grade, ok ? r.price.low : '', ok ? r.price.avg : '', ok ? r.price.high : '', ok ? r.price.currency : '',
      priceNote(r, now), i.discogsUrl ?? r.price.releaseUrl, r.tags.join('; '), r.notes,
    ];
  });
  const footer = [
    `Exported ${utc(now)}. Prices are Discogs price suggestions at the time shown, not sales or appraisals: check current prices on Discogs. Pressing results are AI estimates from photos, not proof of authenticity.`,
  ];
  return [header, ...rows, [], footer].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function exportCsv(records: CollectionRecord[]) {
  const file = new File(Paths.cache, `vinylvault-collection-${Date.now()}.csv`);
  file.write(collectionToCsv(records));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export collection', UTI: 'public.comma-separated-values-text' });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export async function exportPdf(records: CollectionRecord[]) {
  const now = Date.now();
  // dev=false: example values are never exported, so an example-only total isn't either.
  const totals = collectionTotals(records, now, false);
  const cur = totals.currency;
  const usesDiscogs = records.some((r) => isExportablePrice(r.price, now));
  const leftOut = totals.unpriced + totals.examplesLeftOut + (totals.isExample ? totals.priced : 0);
  const rows = records
    .map((r) => {
      const i = r.identity;
      return `<tr>
        <td><strong>${esc(i.artist)}</strong> – ${esc(i.title)}<br/><span class="m">${esc(i.label)} ${esc(i.catalogNumber)} · ${esc(i.country)} ${i.year}${i.variant ? ` · ${esc(i.variant)}` : ''}</span></td>
        <td style="color:${verdictMeta[r.verdict].color}">${verdictMeta[r.verdict].label}</td>
        <td>${r.condition.media.grade} / ${r.condition.sleeve.grade}</td>
        <td class="r">${isExportablePrice(r.price, now) ? `${money(r.price.low, false, r.price.currency)} – ${money(r.price.high, false, r.price.currency)}<br/><span class="m">avg ${money(r.price.avg, false, r.price.currency)} · as of ${utc(r.price.asOf)}</span>` : `<span class="m">${esc(priceNote(r, now))}</span>`}</td>
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
    <div class="m">${records.length} records · Exported ${formatDate(new Date(now).toISOString(), true)}</div>
    <p>${totals.priced && !totals.isExample ? `<strong>Total of Discogs price suggestions:</strong> ${money(totals.low, false, cur)} – ${money(totals.high, false, cur)} (avg ${money(totals.avg, false, cur)})` : '<strong>No Discogs prices to total.</strong>'}${totals.excluded ? ` · ${totals.excluded} record(s) in other currencies not included` : ''}${leftOut ? ` · ${leftOut} record(s) with no price not included` : ''}${totals.expired ? ` · ${totals.expired} record(s) awaiting a Discogs price refresh not included` : ''}</p>
    <p class="m"><strong>Exported ${utc(now)}. Each price shows when it was fetched from Discogs: check current prices on Discogs.</strong> They are Discogs price suggestions, not sales or appraisals, and change over time.</p>
    <table><thead><tr><th>Record</th><th>Pressing (AI estimate)</th><th>Media / sleeve</th><th class="r">Value range</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="m">Grades are estimates from photos and values are not appraisals. Pressing results are AI estimates, not proof of authenticity. Photos cannot reveal how a record sounds.${usesDiscogs ? ` ${DISCOGS_ATTRIBUTION} ${DISCOGS_NOTICE}` : ''}</p>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export collection', UTI: 'com.adobe.pdf' });
}
