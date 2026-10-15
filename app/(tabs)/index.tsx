import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RecentScanRow } from '@/components/record/RecordListItems';
import { EmptyState, Row, Screen, SectionHeader, Surface, Text } from '@/components/ui';
import { FREE_DAILY_SCANS, FREE_LAUNCH } from '@/config';
import { collectionTotals, scansRemaining, useApp, useScanSession } from '@/store';
import { colors, radii, spacing } from '@/theme';
import { compactMoney, money } from '@/utils/format';
import { showScanLimit } from '@/utils/scanLimit';

const TIPS = [
  'Photograph the label straight on. It is where most bootlegs give themselves away.',
  'Tilt the record under a desk lamp to make the runout etching readable.',
  'Shoot covers on a plain, dark surface so the edges and print can be measured.',
  'Glossy sleeves reflect. Turn off overhead lights and use one lamp off to the side.',
  'Pre-1975 pressings shouldn’t have a printed barcode. Tap “No barcode” when there isn’t one.',
];

export default function Home() {
  const collection = useApp((s) => s.collection);
  const scans = useApp((s) => s.scans);
  const usage = useApp((s) => s.usage);
  const subscription = useApp((s) => s.subscription);
  const resetDraft = useScanSession((s) => s.reset);

  const totals = useMemo(() => collectionTotals(collection), [collection]);
  const remaining = scansRemaining({ usage, subscription });
  const unlimited = subscription.isPremium && !FREE_LAUNCH;
  const tip = TIPS[new Date().getDate() % TIPS.length];

  const startScan = () => {
    if (remaining <= 0) {
      showScanLimit();
      return;
    }
    resetDraft({});
    router.push('/scan');
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text variant="label" tone="gold">
            VinylVault
          </Text>
          <Text variant="title">Ready to spin</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.scansBadge}
          accessibilityRole="button"
          accessibilityLabel={unlimited ? 'Premium, unlimited scans' : `${remaining} of ${FREE_DAILY_SCANS} free scans left today`}
        >
          {unlimited ? (
            <>
              <Ionicons name="infinite" size={14} color={colors.gold} />
              <Text variant="caption" tone="gold" style={{ fontWeight: '700' }}>
                Premium
              </Text>
            </>
          ) : (
            <Text variant="caption" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {remaining}/{FREE_DAILY_SCANS} <Text variant="caption" tone="secondary">scans left</Text>
            </Text>
          )}
        </Pressable>
      </Row>

      <Pressable onPress={startScan} accessibilityRole="button" accessibilityLabel="Scan a record" style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}>
        <LinearGradient colors={['#1B3566', '#0F1D3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="disc" size={40} color={colors.textInverse} />
          </View>
          <Text variant="title" align="center">
            Scan a record
          </Text>
          <Text variant="caption" tone="secondary" align="center">
            Covers, label, runout and barcode · pressing, grade, authenticity and value
          </Text>
          {remaining <= 0 && (
            <Text variant="caption" tone="gold" align="center" style={{ fontWeight: '600' }}>
              Today's scans are used. They reset at midnight.
            </Text>
          )}
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={() => (remaining <= 0 ? showScanLimit() : router.push('/scan/upload'))}
        style={({ pressed }) => [styles.uploadRow, pressed && { backgroundColor: colors.surfacePressed }]}
        accessibilityRole="button"
        accessibilityLabel="Check a record from saved photos"
      >
        <Ionicons name="images-outline" size={20} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Check from photos</Text>
          <Text variant="caption" tone="secondary">
            Use a seller's listing photos before you buy
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <Surface onPress={() => router.push('/(tabs)/collection')}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 4, flex: 1 }}>
            <Text variant="label" tone="muted">
              Collection value
            </Text>
            <Text variant="numberLarge" tone="gold">
              {compactMoney(totals.low, totals.currency)} – {compactMoney(totals.high, totals.currency)}
            </Text>
            <Text variant="caption" tone="secondary">
              Average {money(totals.avg, false, totals.currency)} · {collection.length} records
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Row>
      </Surface>

      <SectionHeader title="Recent scans" action={scans.length ? 'Collection' : undefined} onAction={() => router.push('/(tabs)/collection')} />
      {scans.length ? (
        <Surface style={{ paddingVertical: spacing.xs, paddingHorizontal: spacing.xs }}>
          {scans.slice(0, 5).map((s) => (
            <RecentScanRow key={s.id} scan={s} onPress={() => router.push({ pathname: '/scan/result', params: { id: s.id } })} />
          ))}
        </Surface>
      ) : (
        <Surface>
          <EmptyState icon="disc-outline" title="No scans yet" body="Your last scans show up here with their pressing result and value range." />
        </Surface>
      )}

      <Surface style={styles.tip}>
        <Ionicons name="bulb-outline" size={18} color={colors.gold} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" tone="gold">
            Tip
          </Text>
          <Text variant="caption" tone="secondary">
            {tip}
          </Text>
        </View>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scansBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.navyBright },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tip: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
});
