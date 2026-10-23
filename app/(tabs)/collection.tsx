import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, FlatList, LayoutAnimation, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RecordRow, RecordTile } from '@/components/record/RecordListItems';
import { Button, Chip, EmptyState, IconButton, Row, Text } from '@/components/ui';
import { FREE_COLLECTION_LIMIT } from '@/config';
import { exportCsv, exportPdf } from '@/services/export';
import { allTags, collectionTotals, useApp } from '@/store';
import { colors, radii, spacing, verdictMeta } from '@/theme';
import type { Genre, Grade, PressingVerdict, VinylFormat } from '@/types';
import { activeFilterCount, EMPTY_FILTERS, filterRecords, topArtists, type RecordFilters, type SortKey, type ValueBucket } from '@/utils/filterRecords';
import { compactMoney, money } from '@/utils/format';

const GENRES: Genre[] = ['Rock', 'Pop', 'Jazz', 'Soul & Funk', 'Hip-Hop', 'Electronic', 'Reggae', 'Folk & Country', 'Blues', 'Classical', 'Soundtrack', 'Other'];
const FORMATS: VinylFormat[] = ['LP', '12" Single', '10"', '7" Single'];
const VERDICTS: PressingVerdict[] = ['likely_original', 'reissue', 'needs_review', 'possible_bootleg'];
const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const MIN_GRADES: Grade[] = ['NM', 'VG+', 'VG'];
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'value', label: 'Value' },
  { key: 'year', label: 'Year' },
  { key: 'artist', label: 'Artist A–Z' },
];
const VALUES: { key: ValueBucket; label: string }[] = [
  { key: 'under25', label: 'Under $25' },
  { key: '25to100', label: '$25–$100' },
  { key: '100to500', label: '$100–$500' },
  { key: 'over500', label: '$500+' },
];

export default function Collection() {
  const { width } = useWindowDimensions();
  const collection = useApp((s) => s.collection);
  const isPremium = useApp((s) => s.subscription.isPremium);
  const viewMode = useApp((s) => s.prefs.viewMode);
  const setPref = useApp((s) => s.setPref);
  const customTags = useApp((s) => s.customTags);
  const [filters, setFilters] = useState<RecordFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const visible = useMemo(() => filterRecords(collection, filters), [collection, filters]);
  const totals = useMemo(() => collectionTotals(visible), [visible]);
  const artists = useMemo(() => topArtists(collection), [collection]);
  const genresPresent = useMemo(() => GENRES.filter((g) => collection.some((r) => r.identity.genre === g)), [collection]);
  const owned = collection.filter((c) => !c.isSample).length;
  const filterCount = activeFilterCount(filters);
  const tags = allTags(customTags);
  const filtered = filterCount > 0 || Boolean(filters.query) || Boolean(filters.tag);

  const set = (patch: Partial<RecordFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const premiumOnly = (fn: () => void) => () => (isPremium ? fn() : router.push({ pathname: '/paywall', params: { reason: 'filters' } }));

  const onExport = () => {
    if (!isPremium) {
      router.push({ pathname: '/paywall', params: { reason: 'export' } });
      return;
    }
    const records = visible;
    Alert.alert('Export collection', `${records.length} records${filtered ? ' (current filters)' : ''}`, [
      { text: 'CSV spreadsheet', onPress: () => exportCsv(records).catch(() => Alert.alert('Export failed')) },
      { text: 'PDF report', onPress: () => exportPdf(records).catch(() => Alert.alert('Export failed')) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const cols = 2;
  const tileW = (width - spacing.xl * 2 - spacing.md) / cols;

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">Collection</Text>
        <Row gap={0}>
          <IconButton icon={viewMode === 'grid' ? 'list' : 'grid'} label="Toggle grid or list" onPress={() => setPref('viewMode', viewMode === 'grid' ? 'list' : 'grid')} />
          <IconButton icon="share-outline" label="Export collection" onPress={onExport} />
        </Row>
      </Row>

      <View style={styles.totals}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            {filtered ? 'Filtered value' : 'Total value'}
          </Text>
          <Text variant="number" tone="gold">
            {compactMoney(totals.low, totals.currency)} – {compactMoney(totals.high, totals.currency)}
          </Text>
          <Text variant="caption" tone="secondary">
            avg {money(totals.avg, false, totals.currency)}
            {totals.excluded ? ` · ${totals.excluded} in other currencies not included` : ''}
            {totals.expired ? ` · ${totals.expired} awaiting a Discogs price refresh` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="number">{visible.length}</Text>
          <Text variant="caption" tone="secondary">
            {isPremium ? 'records' : `${owned}/${FREE_COLLECTION_LIMIT} saved`}
          </Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={filters.query}
          onChangeText={(query) => set({ query })}
          placeholder="Artist, title, label, catalog #, year"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search collection"
        />
        {filters.query ? <IconButton icon="close-circle" size={18} color={colors.textMuted} label="Clear search" onPress={() => set({ query: '' })} /> : null}
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowFilters((v) => !v);
          }}
          style={[styles.filterBtn, (showFilters || filterCount > 0) && { borderColor: colors.gold }]}
          accessibilityRole="button"
          accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ''}`}
        >
          <Ionicons name="options" size={16} color={filterCount ? colors.gold : colors.textSecondary} />
          {filterCount > 0 && (
            <Text variant="caption" tone="gold" style={{ fontWeight: '700' }}>
              {filterCount}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="All" selected={!filters.tag} onPress={() => set({ tag: null })} />
        {tags.map((t) => (
          <Chip key={t} label={t} icon="folder-outline" locked={!isPremium} selected={filters.tag === t} onPress={premiumOnly(() => set({ tag: filters.tag === t ? null : t }))} />
        ))}
      </ScrollView>

      {showFilters && (
        <View style={styles.panel}>
          {artists.length > 1 && (
            <FilterGroup title="Artist">
              {artists.map((a) => (
                <Chip key={a} label={a} selected={filters.artists.includes(a)} onPress={() => set({ artists: toggle(filters.artists, a) })} />
              ))}
            </FilterGroup>
          )}
          <FilterGroup title="Genre">
            {(genresPresent.length ? genresPresent : GENRES).map((g) => (
              <Chip key={g} label={g} selected={filters.genres.includes(g)} onPress={() => set({ genres: toggle(filters.genres, g) })} />
            ))}
          </FilterGroup>
          <FilterGroup title="Pressing">
            {VERDICTS.map((v) => (
              <Chip key={v} label={verdictMeta[v].short} color={verdictMeta[v].color} selected={filters.verdicts.includes(v)} onPress={() => set({ verdicts: toggle(filters.verdicts, v) })} />
            ))}
          </FilterGroup>
          <FilterGroup title="Format">
            {FORMATS.map((f) => (
              <Chip key={f} label={f} selected={filters.formats.includes(f)} onPress={() => set({ formats: toggle(filters.formats, f) })} />
            ))}
          </FilterGroup>
          <FilterGroup title="Decade pressed" locked={!isPremium}>
            {DECADES.map((d) => (
              <Chip key={d} label={`${d}s`} locked={!isPremium} selected={filters.decade === d} onPress={premiumOnly(() => set({ decade: filters.decade === d ? null : d }))} />
            ))}
          </FilterGroup>
          <FilterGroup title="Value" locked={!isPremium}>
            {VALUES.map((v) => (
              <Chip key={v.key} label={v.label} locked={!isPremium} selected={filters.value === v.key} onPress={premiumOnly(() => set({ value: filters.value === v.key ? null : v.key }))} />
            ))}
          </FilterGroup>
          <FilterGroup title="Vinyl condition" locked={!isPremium}>
            {MIN_GRADES.map((g) => (
              <Chip key={g} label={`${g} or better`} locked={!isPremium} selected={filters.minGrade === g} onPress={premiumOnly(() => set({ minGrade: filters.minGrade === g ? null : g }))} />
            ))}
          </FilterGroup>
          <FilterGroup title="Sort by">
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={filters.sort === s.key} onPress={() => set({ sort: s.key })} />
            ))}
          </FilterGroup>
          {filterCount > 0 && <Button label="Clear filters" variant="ghost" size="sm" onPress={() => setFilters((f) => ({ ...EMPTY_FILTERS, query: f.query, tag: f.tag, sort: f.sort }))} />}
        </View>
      )}
    </View>
  );

  const empty = collection.length ? (
    <EmptyState icon="search-outline" title="No matches" body="Try a different search or clear some filters." action={<Button label="Clear all" variant="secondary" onPress={() => setFilters(EMPTY_FILTERS)} />} />
  ) : (
    <EmptyState icon="albums-outline" title="Start your collection" body="Scan a record and tap Save. Your records, grades, values and pressing results live here." action={<Button label="Scan a record" icon="disc" onPress={() => router.push('/scan')} />} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <FlatList
        key={viewMode}
        data={visible}
        numColumns={viewMode === 'grid' ? cols : 1}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl * 2 }}
        columnWrapperStyle={viewMode === 'grid' ? { gap: spacing.md, marginBottom: spacing.md } : undefined}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) =>
          viewMode === 'grid' ? (
            <RecordTile record={item} width={tileW} onPress={() => router.push({ pathname: '/record/[id]', params: { id: item.id } })} />
          ) : (
            <RecordRow record={item} onPress={() => router.push({ pathname: '/record/[id]', params: { id: item.id } })} />
          )
        }
      />
    </SafeAreaView>
  );
}

function FilterGroup({ title, locked, children }: { title: string; locked?: boolean; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row gap={6}>
        <Text variant="label" tone="muted">
          {title}
        </Text>
        {locked && (
          <Text variant="label" tone="gold" style={{ fontSize: 9 }}>
            Premium
          </Text>
        )}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 38, paddingHorizontal: spacing.md, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  panel: { gap: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border },
});
