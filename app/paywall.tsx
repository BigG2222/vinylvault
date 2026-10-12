import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton, Row, Text } from '@/components/ui';
import { FREE_COLLECTION_LIMIT, FREE_DAILY_SCANS } from '@/config';
import { getPlans, isMockStore, purchase, restore, type Plan, type PlanId } from '@/services/subscriptions';
import { useApp } from '@/store';
import { colors, radii, spacing } from '@/theme';

const REASONS: Record<string, { title: string; body: string }> = {
  scans: { title: "You've used today's free scans", body: `Free includes ${FREE_DAILY_SCANS} scans a day and resets at midnight. Premium removes the limit.` },
  collection: { title: 'Your collection is full', body: `Free collections hold ${FREE_COLLECTION_LIMIT} records. Premium has no limit, and nothing you've saved is ever locked.` },
  export: { title: 'Export your collection', body: 'CSV for spreadsheets, PDF for insurance and sales.' },
  filters: { title: 'Organize like a pro', body: 'Folders, tags and advanced filters by decade, value and condition.' },
};

const ROWS: { label: string; free: string | boolean; premium: string | boolean }[] = [
  { label: 'Scans', free: `${FREE_DAILY_SCANS}/day`, premium: 'Unlimited' },
  { label: 'Collection size', free: `${FREE_COLLECTION_LIMIT} records`, premium: 'Unlimited' },
  { label: 'Pressing result + explanations', free: true, premium: true },
  { label: 'Media & sleeve grades', free: true, premium: true },
  { label: 'Value ranges', free: true, premium: true },
  { label: 'Detailed evidence per check', free: false, premium: true },
  { label: 'Value at every grade', free: false, premium: true },
  { label: 'Folders, tags, advanced filters', free: false, premium: true },
  { label: 'CSV / PDF export', free: false, premium: true },
  { label: 'Priority support', free: false, premium: true },
];

export default function Paywall() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const setSubscription = useApp((s) => s.setSubscription);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPlans().then(setPlans);
  }, []);

  const plan = plans?.find((p) => p.id === selected);
  const monthly = plans?.find((p) => p.id === 'monthly');
  const yearly = plans?.find((p) => p.id === 'yearly');
  const savings = monthly && yearly ? Math.round((1 - yearly.price / (monthly.price * 12)) * 100) : 0;
  const head = (reason && REASONS[reason]) || { title: 'VinylVault Premium', body: 'Deeper pressing checks, no limits, and tools for serious collections.' };

  const buy = async () => {
    if (!plan) return;
    setBusy(true);
    const r = await purchase(plan);
    setBusy(false);
    if (r.ok) {
      setSubscription(r.state);
      router.back();
    } else if (!r.cancelled) {
      Alert.alert('Purchase not completed', r.message ?? 'Please try again.');
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      const s = await restore();
      setSubscription(s);
      Alert.alert(s.isPremium ? 'Premium restored' : 'No subscription found', s.isPremium ? 'Welcome back.' : 'We could not find an active subscription for this account.');
      if (s.isPremium) router.back();
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = plan?.trialDays ? `Start ${plan.trialDays}-day free trial` : `Subscribe for ${plan?.priceString ?? ''}`;
  const terms = plan
    ? plan.trialDays
      ? `Free for ${plan.trialDays} days, then ${plan.priceString}/${plan.period}. You won't be charged if you cancel before the trial ends. Cancel anytime from Profile → Manage subscription or in your ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} settings.`
      : `${plan.priceString}/${plan.period}, renews automatically. Cancel anytime from Profile → Manage subscription.`
    : '';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient colors={['#1A1810', colors.bg]} style={StyleSheet.absoluteFill} />
      <Row style={{ justifyContent: 'flex-end', paddingHorizontal: spacing.md }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </Row>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="label" tone="gold">
            Premium
          </Text>
          <Text variant="display">{head.title}</Text>
          <Text variant="body" tone="secondary">
            {head.body}
          </Text>
        </View>

        <View style={styles.table}>
          <Row style={styles.tableHead}>
            <Text variant="label" tone="muted" style={{ flex: 1 }}>
              {' '}
            </Text>
            <Text variant="label" tone="muted" style={styles.col}>
              Free
            </Text>
            <Text variant="label" tone="gold" style={styles.col}>
              Premium
            </Text>
          </Row>
          {ROWS.map((r) => (
            <Row key={r.label} style={styles.tableRow}>
              <Text variant="caption" style={{ flex: 1 }}>
                {r.label}
              </Text>
              <Cell v={r.free} />
              <Cell v={r.premium} gold />
            </Row>
          ))}
        </View>

        {!plans ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {[yearly, monthly].filter((p): p is Plan => Boolean(p)).map((p) => {
              const active = p.id === selected;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setSelected(p.id)}
                  style={[styles.plan, active && styles.planActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`${p.id === 'yearly' ? 'Yearly' : 'Monthly'}, ${p.priceString} per ${p.period}`}
                >
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.gold : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Row gap={spacing.sm}>
                      <Text variant="bodyStrong">{p.id === 'yearly' ? 'Yearly' : 'Monthly'}</Text>
                      {p.id === 'yearly' && savings > 0 && (
                        <View style={styles.save}>
                          <Text variant="caption" color={colors.textInverse} style={{ fontSize: 10, fontWeight: '800' }}>
                            SAVE {savings}%
                          </Text>
                        </View>
                      )}
                    </Row>
                    <Text variant="caption" tone="secondary">
                      {p.id === 'yearly' && p.perMonth ? `${p.perMonth}/mo, billed yearly` : 'Billed monthly'}
                      {p.trialDays ? ` · ${p.trialDays}-day free trial` : ''}
                    </Text>
                  </View>
                  <Text variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
                    {p.priceString}
                    <Text variant="caption" tone="secondary">
                      /{p.period === 'year' ? 'yr' : 'mo'}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={ctaLabel} size="lg" full loading={busy} disabled={!plan} onPress={buy} />
        <Text variant="caption" tone="muted" align="center">
          {terms}
        </Text>
        <Row style={{ justifyContent: 'center' }} gap={spacing.lg}>
          <Pressable onPress={doRestore} hitSlop={8}>
            <Text variant="caption" tone="secondary" style={{ fontWeight: '600' }}>
              Restore purchases
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://vinylvault.app/terms')} hitSlop={8}>
            <Text variant="caption" tone="secondary">
              Terms
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://vinylvault.app/privacy')} hitSlop={8}>
            <Text variant="caption" tone="secondary">
              Privacy
            </Text>
          </Pressable>
        </Row>
        {isMockStore && __DEV__ && (
          <Text variant="caption" tone="muted" align="center" style={{ fontSize: 11 }}>
            Dev: no RevenueCat key set. Purchases are simulated locally.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Cell({ v, gold }: { v: string | boolean; gold?: boolean }) {
  if (typeof v === 'string') {
    return (
      <Text variant="caption" color={gold ? colors.goldBright : colors.textSecondary} style={[styles.col, { fontWeight: '600' }]}>
        {v}
      </Text>
    );
  }
  return (
    <View style={styles.col}>
      <Ionicons name={v ? 'checkmark' : 'remove'} size={16} color={v ? (gold ? colors.gold : colors.authentic) : colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl },
  table: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  tableHead: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tableRow: { paddingVertical: spacing.sm + 2 },
  col: { width: 76, textAlign: 'center', alignItems: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  planActive: { borderColor: colors.gold, backgroundColor: colors.gold + '10' },
  save: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  footer: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
});
