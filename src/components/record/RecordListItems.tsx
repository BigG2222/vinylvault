import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Row, Text, VerdictBadge } from '@/components/ui';
import { colors, radii, spacing } from '@/theme';
import type { CollectionRecord, ScanResult } from '@/types';
import { compactMoney, moneyRange, pressingLine, relativeTime } from '@/utils/format';
import { RecordArt } from './RecordArt';

export function RecordTile({ record, width, onPress }: { record: CollectionRecord; width: number; onPress: () => void }) {
  const artW = width - spacing.md * 2;
  const i = record.identity;
  const c = record.price.currency;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width }, pressed && { backgroundColor: colors.surfacePressed }]}
      accessibilityRole="button"
      accessibilityLabel={`${i.artist}, ${i.title}, ${i.year} ${i.country}, ${moneyRange(record.price.low, record.price.high, c)}`}
    >
      <RecordArt identity={i} uri={record.images.front || undefined} width={artW} />
      <View style={{ gap: 3, marginTop: spacing.sm }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {i.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {i.artist}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {i.country} {i.year} · {record.condition.media.grade}/{record.condition.sleeve.grade}
        </Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <VerdictBadge verdict={record.verdict} size="sm" />
          <Text variant="caption" tone="gold" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {compactMoney(record.price.avg, c)}
          </Text>
        </Row>
      </View>
      {record.isSample && <SampleTag />}
    </Pressable>
  );
}

export function RecordRow({ record, onPress }: { record: CollectionRecord; onPress: () => void }) {
  const i = record.identity;
  const c = record.price.currency;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]} accessibilityRole="button">
      <RecordArt identity={i} uri={record.images.front || undefined} width={56} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {i.title}
          {record.isSample ? <Text variant="caption" tone="muted">{'  '}Sample</Text> : null}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {i.artist} · {pressingLine(i)} · {i.country} {i.year}
        </Text>
        <VerdictBadge verdict={record.verdict} size="sm" />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text variant="bodyStrong" tone="gold" style={{ fontVariant: ['tabular-nums'] }}>
          {compactMoney(record.price.avg, c)}
        </Text>
        <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {moneyRange(record.price.low, record.price.high, c)}
        </Text>
      </View>
    </Pressable>
  );
}

export function RecentScanRow({ scan, onPress }: { scan: ScanResult; onPress: () => void }) {
  const i = scan.matches[scan.selectedMatchIndex].identity;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]} accessibilityRole="button">
      <RecordArt identity={i} uri={scan.images.front || undefined} width={46} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {i.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {i.artist} · {relativeTime(scan.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <VerdictBadge verdict={scan.verdict} size="sm" />
        <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {moneyRange(scan.price.low, scan.price.high, scan.price.currency)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function SampleTag() {
  return (
    <View style={styles.sample}>
      <Text variant="label" style={{ fontSize: 9 }} tone="secondary">
        Sample
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md },
  sample: { position: 'absolute', top: spacing.md + 6, right: spacing.md + 6, backgroundColor: colors.overlay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
