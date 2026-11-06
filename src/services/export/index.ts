import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { CollectionRecord } from '@/types';
import { collectionToCsv, collectionToHtml } from './format';

export { collectionToCsv, collectionToHtml, EXPORT_PRICE_NOTE } from './format';

export async function exportCsv(records: CollectionRecord[]) {
  const file = new File(Paths.cache, `labelsight-collection-${Date.now()}.csv`);
  file.write(collectionToCsv(records));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export collection', UTI: 'public.comma-separated-values-text' });
}

export async function exportPdf(records: CollectionRecord[]) {
  const { uri } = await Print.printToFileAsync({ html: collectionToHtml(records) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export collection', UTI: 'com.adobe.pdf' });
}
