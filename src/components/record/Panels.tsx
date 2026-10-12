import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Row, Text } from '@/components/ui';
import { AUDIO_CAVEAT } from '@/config';
import { colors, radii, spacing } from '@/theme';
import type { ConditionEstimate, Grade, GradeEstimate, IdentificationMatch, ObservedText, PriceEstimate, SaleRecord } from '@/types';
import { formatDate, formatLine, money, originLine, percent, pressingLine } from '@/utils/format';
import { GRADE_LABELS, GRADE_MEANING, GRADES } from '@/utils/grading';

const SEVERITY_COLOR = { light: colors.textSecondary, moderate: colors.review, heavy: colors.risk } as const;

/** Media and sleeve graded separately on the Goldmine scale, with what was seen and the audio caveat. */
export function ConditionPanel({ condition }: { condition: ConditionEstimate }) {
  return (
    <View style={{ gap: spacing.lg }}>
      <GradeBlock title="Vinyl (media)" g={condition.media} />
      <View style={styles.divider} />
      <GradeBlock title="Sleeve" g={condition.sleeve} />
      <Row gap={spacing.sm} style={styles.caveat}>
        <Ionicons name="ear-outline" size={16} color={colors.review} style={{ marginTop: 1 }} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {AUDIO_CAVEAT}
        </Text>
      </Row>
    </View>
  );
}

function GradeBlock({ title, g }: { title: string; g: GradeEstimate }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            {title}
          </Text>
          <Text variant="heading">{GRADE_LABELS[g.grade]}</Text>
        </View>
        <View style={styles.gradeBox} accessibilityLabel={`Estimated grade ${g.grade}, ${percent(g.confidence)} confidence`}>
          <Text variant="number" tone="gold">
            {g.grade}
          </Text>
        </View>
      </Row>
      <View style={styles.scale}>
        {GRADES.map((x) => (
          <View key={x} style={[styles.scaleCell, x === g.grade && { backgroundColor: colors.gold }]}>
            <Text variant="caption" color={x === g.grade ? colors.textInverse : colors.textMuted} style={{ fontSize: 10, fontWeight: '700' }}>
              {x}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="secondary">
        {g.summary}
      </Text>
      {g.issues.map((issue, i) => (
        <Row key={i} gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
          <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[issue.severity] }]} />
          <Text variant="caption" style={{ flex: 1 }}>
            {issue.note}
          </Text>
        </Row>
      ))}
      <Text variant="caption" tone="muted">
        {GRADE_MEANING[g.grade]} Grade confidence {percent(g.confidence)}.
      </Text>
    </View>
  );
}

/** Suggested value at every grade (Premium). Highlights this copy's media grade. */
export function GradePriceTable({ price, media }: { price: PriceEstimate; media: Grade }) {
  const rows = GRADES.filter((g) => typeof price.byGrade[g] === 'number');
  if (!rows.length) {
    return (
      <Text variant="caption" tone="muted">
        No per-grade prices are available for this release yet.
      </Text>
    );
  }
  const max = Math.max(...rows.map((g) => price.byGrade[g]!));
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((g) => {
        const v = price.byGrade[g]!;
        const active = g === media;
        return (
          <Row key={g} gap={spacing.md}>
            <Text variant="caption" style={{ width: 34, fontWeight: '700' }} color={active ? colors.gold : colors.textSecondary}>
              {g}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(4, (v / max) * 100)}%`, backgroundColor: active ? colors.gold : colors.borderStrong }]} />
            </View>
            <Text variant="caption" style={{ width: 72, textAlign: 'right', fontVariant: ['tabular-nums'], fontWeight: active ? '700' : '400' }}>
              {money(v, false, price.currency)}
            </Text>
          </Row>
        );
      })}
      <Text variant="caption" tone="muted">
        {price.source === 'discogs' ? 'Discogs suggested prices by media grade.' : 'Demo values by grade.'} Your copy is highlighted.
      </Text>
    </View>
  );
}

/**
 * Recent sales with dates. The Discogs API does not return individual sales,
 * so for Discogs prices this says so and links to the public sales history.
 */
export function SalesPanel({ price }: { price: PriceEstimate }) {
  if (price.recentSales.length) {
    return (
      <View>
        <SalesList sales={price.recentSales.slice(0, 5)} currency={price.currency} />
        {price.source === 'demo' && (
          <Text variant="caption" color={colors.review} style={{ marginTop: spacing.xs }}>
            Demo sales for illustration.
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="secondary">
        Individual sale prices aren't available through the Discogs API.
        {typeof price.lowestListing === 'number' ? ` The lowest current listing is ${money(price.lowestListing, false, price.currency)}.` : ''}
      </Text>
      {price.salesHistoryUrl && (
        <Pressable onPress={() => Linking.openURL(price.salesHistoryUrl!)} accessibilityRole="link" style={styles.link}>
          <Ionicons name="open-outline" size={14} color={colors.gold} />
          <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>
            See recent sales on Discogs
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function SalesList({ sales, currency }: { sales: SaleRecord[]; currency: string }) {
  return (
    <View>
      {sales.map((s, i) => (
        <Row key={i} style={[styles.saleRow, i < sales.length - 1 && styles.border]}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ fontWeight: '600' }}>
              {s.source}
            </Text>
            <Text variant="caption" tone="muted">
              {formatDate(s.date, true)} · {s.condition}
            </Text>
          </View>
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
            {money(s.price, false, currency)}
          </Text>
        </Row>
      ))}
    </View>
  );
}

export function MatchList({ matches, selected, onSelect }: { matches: IdentificationMatch[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {matches.map((m, i) => {
        const active = i === selected;
        const id = m.identity;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            style={[styles.match, active && { borderColor: colors.gold, backgroundColor: colors.gold + '10' }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${id.artist}, ${id.title}, ${pressingLine(id)}, ${originLine(id)}, ${percent(m.confidence)} confidence`}
          >
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.gold : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {id.title}
                <Text variant="caption" tone="muted">
                  {'  '}
                  {id.pressingType === 'original' ? 'Original' : id.pressingType === 'reissue' ? 'Reissue' : ''}
                </Text>
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {pressingLine(id)} · {originLine(id)}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {formatLine(id)}
              </Text>
            </View>
            <Text variant="caption" tone={i === 0 ? 'primary' : 'muted'} style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {percent(m.confidence)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What was read off the record, so the collector can sanity-check the identification. */
export function ObservedPanel({ observed }: { observed: ObservedText }) {
  const rows: [string, string | undefined][] = [
    ['Catalog #', observed.catalogNumber],
    ['Label', observed.labelName],
    ['Runout', observed.runout],
    ['Barcode', observed.barcode === 'none' ? 'None (you confirmed)' : observed.barcode],
  ];
  return (
    <View style={{ gap: spacing.xs }}>
      {rows.map(([k, v]) => (
        <Row key={k} style={{ alignItems: 'flex-start' }}>
          <Text variant="caption" tone="muted" style={{ width: 84 }}>
            {k}
          </Text>
          <Text variant="caption" style={{ flex: 1, fontWeight: v ? '600' : '400' }} color={v ? colors.text : colors.textMuted}>
            {v || 'Not read'}
          </Text>
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  gradeBox: { minWidth: 56, alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold + '44' },
  scale: { flexDirection: 'row', gap: 3 },
  scaleCell: { flex: 1, height: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgElevated },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  caveat: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.review + '12', alignItems: 'flex-start' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bgElevated, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  saleRow: { paddingVertical: spacing.sm + 2 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  match: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
});

