import type { CollectionRecord, Genre, Grade, PressingVerdict, VinylFormat } from '../types';
import { gradeIndex } from './grading';

export type SortKey = 'recent' | 'value' | 'year' | 'artist';
export type ValueBucket = 'under25' | '25to100' | '100to500' | 'over500';

export interface RecordFilters {
  query: string;
  artists: string[];
  genres: Genre[];
  formats: VinylFormat[];
  verdicts: PressingVerdict[];
  tag: string | null;
  /** Start year of a decade, e.g. 1970. */
  decade: number | null;
  value: ValueBucket | null;
  /** Minimum media grade (inclusive), e.g. "VG+" keeps M, NM and VG+. */
  minGrade: Grade | null;
  sort: SortKey;
}

export const EMPTY_FILTERS: RecordFilters = { query: '', artists: [], genres: [], formats: [], verdicts: [], tag: null, decade: null, value: null, minGrade: null, sort: 'recent' };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Tokenized search: every word must match one of the record's searchable
 * fields, so "floyd harvest 1973" or "blue note mono" work as expected.
 */
export function matchesQuery(r: CollectionRecord, query: string): boolean {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const i = r.identity;
  const hay = fold(
    [
      i.artist, i.title, i.label, i.catalogNumber, i.catalogNumber.replace(/[\s-]/g, ''), i.country, String(i.year), i.originalYear ? String(i.originalYear) : '',
      i.genre, i.format, i.variant, i.pressingType === 'original' ? 'original first press' : i.pressingType === 'reissue' ? 'reissue' : '',
      i.barcode, ...r.tags, r.notes,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return tokens.every((t) => hay.includes(t));
}

export function filterRecords(records: CollectionRecord[], f: RecordFilters): CollectionRecord[] {
  const out = records.filter((r) => {
    if (!matchesQuery(r, f.query)) return false;
    if (f.artists.length && !f.artists.includes(r.identity.artist)) return false;
    if (f.genres.length && !f.genres.includes(r.identity.genre)) return false;
    if (f.formats.length && !f.formats.includes(r.identity.format)) return false;
    if (f.verdicts.length && !f.verdicts.includes(r.verdict)) return false;
    if (f.tag && !r.tags.includes(f.tag)) return false;
    // Decade means when this copy was pressed, which is what collectors usually care about.
    if (f.decade !== null && (r.identity.year < f.decade || r.identity.year > f.decade + 9)) return false;
    const v = r.price.avg;
    if (f.value === 'under25' && v >= 25) return false;
    if (f.value === '25to100' && (v < 25 || v > 100)) return false;
    if (f.value === '100to500' && (v < 100 || v > 500)) return false;
    if (f.value === 'over500' && v <= 500) return false;
    if (f.minGrade && gradeIndex(r.condition.media.grade) > gradeIndex(f.minGrade)) return false;
    return true;
  });
  const sorters: Record<SortKey, (a: CollectionRecord, b: CollectionRecord) => number> = {
    recent: (a, b) => b.addedAt.localeCompare(a.addedAt),
    value: (a, b) => b.price.avg - a.price.avg,
    year: (a, b) => a.identity.year - b.identity.year,
    artist: (a, b) => a.identity.artist.localeCompare(b.identity.artist) || a.identity.title.localeCompare(b.identity.title),
  };
  return out.sort(sorters[f.sort]);
}

export function activeFilterCount(f: RecordFilters): number {
  return f.artists.length + f.genres.length + f.formats.length + f.verdicts.length + (f.decade !== null ? 1 : 0) + (f.value ? 1 : 0) + (f.minGrade ? 1 : 0);
}

/** Artists in the collection, most records first, for the artist filter chips. */
export function topArtists(records: CollectionRecord[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.identity.artist, (counts.get(r.identity.artist) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([a]) => a);
}
