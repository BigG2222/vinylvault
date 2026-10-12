import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Row, Screen, SectionHeader, Surface, Text } from '@/components/ui';
import { env, FALLBACK_PRICING, FREE_COLLECTION_LIMIT, FREE_DAILY_SCANS, SUPPORT_EMAIL } from '@/config';
import type { Scenario } from '@/data/generate';
import { isOcrAvailable } from '@/services/ondevice/ocr';
import { isMockStore, manageSubscription } from '@/services/subscriptions';
import { usingServer } from '@/services/vision/registry';
import { scansRemaining, useApp } from '@/store';
import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

type Health = { state: 'checking' } | { state: 'ok'; model: string; discogs: boolean } | { state: 'down' };

function useServerHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const check = useCallback(async () => {
    if (!usingServer()) return;
    setHealth({ state: 'checking' });
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${env.visionProxyUrl.replace(/\/$/, '')}/health`, { signal: controller.signal });
      clearTimeout(t);
      const j = await res.json();
      setHealth({ state: 'ok', model: String(j.model ?? ''), discogs: Boolean(j.discogs) });
    } catch {
      setHealth({ state: 'down' });
    }
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  return { health, check };
}

export default function Profile() {
  const subscription = useApp((s) => s.subscription);
  const usage = useApp((s) => s.usage);
  const collection = useApp((s) => s.collection);
  const reports = useApp((s) => s.reports);
  const prefs = useApp((s) => s.prefs);
  const setPref = useApp((s) => s.setPref);
  const setSubscription = useApp((s) => s.setSubscription);
  const clearSampleData = useApp((s) => s.clearSampleData);
  const { health, check } = useServerHealth();
  const remaining = scansRemaining({ usage, subscription });
  const owned = collection.filter((c) => !c.isSample).length;
  const hasSamples = collection.some((c) => c.isSample);

  const manage = async () => {
    await manageSubscription(subscription.managementUrl);
    if (isMockStore) setSubscription({ isPremium: false, willRenew: false, expiresAt: null, activePlan: null, managementUrl: null });
  };

  const support = (subject: string) => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);

  return (
    <Screen>
      <Text variant="title">Profile</Text>

      <Surface style={{ gap: spacing.lg, borderColor: subscription.isPremium ? colors.gold + '66' : colors.border }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="label" tone="muted">
              Plan
            </Text>
            <Text variant="title" tone={subscription.isPremium ? 'gold' : 'primary'}>
              {subscription.isPremium ? 'Premium' : 'Free'}
            </Text>
          </View>
          {subscription.isPremium && <Ionicons name="ribbon" size={28} color={colors.gold} />}
        </Row>

        {subscription.isPremium ? (
          <Text variant="caption" tone="secondary">
            {subscription.activePlan === 'yearly' ? `Yearly · ${FALLBACK_PRICING.yearly.label}/yr` : `Monthly · ${FALLBACK_PRICING.monthly.label}/mo`}
            {subscription.expiresAt ? ` · ${subscription.willRenew ? 'Renews' : 'Ends'} ${formatDate(subscription.expiresAt, true)}` : ''}
          </Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Meter label="Free scans today" value={FREE_DAILY_SCANS - remaining} max={FREE_DAILY_SCANS} caption={`${remaining} left · resets at midnight`} />
            <Meter label="Collection" value={owned} max={FREE_COLLECTION_LIMIT} caption={`${owned} of ${FREE_COLLECTION_LIMIT} records saved`} />
          </View>
        )}

        {subscription.isPremium ? (
          <Button label="Manage or cancel subscription" variant="secondary" icon="settings-outline" onPress={manage} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Button label="See Premium" icon="sparkles" onPress={() => router.push('/paywall')} />
            <Text variant="caption" tone="muted" align="center">
              {FALLBACK_PRICING.monthly.label}/month or {FALLBACK_PRICING.yearly.label}/year · {FALLBACK_PRICING.trialDays}-day free trial
            </Text>
          </View>
        )}
      </Surface>

      <SectionHeader title="Analysis" />
      <Surface style={{ gap: spacing.md }}>
        <StatusRow
          label="Identification & checks"
          value={!usingServer() ? 'Demo model (offline)' : health?.state === 'ok' ? 'Your server · connected' : health?.state === 'down' ? 'Your server · not reachable' : 'Your server · checking…'}
          color={!usingServer() ? colors.review : health?.state === 'ok' ? colors.authentic : health?.state === 'down' ? colors.risk : colors.textSecondary}
        />
        <StatusRow
          label="Prices"
          value={!usingServer() ? 'Demo values' : health?.state === 'ok' ? (health.discogs ? 'Discogs' : 'Demo values (no Discogs token on server)') : '—'}
          color={usingServer() && health?.state === 'ok' && health.discogs ? colors.authentic : colors.review}
        />
        <StatusRow label="On-device label reading" value={isOcrAvailable() ? 'On' : 'Needs the installed app (not Expo Go)'} color={isOcrAvailable() ? colors.authentic : colors.textMuted} />
        {usingServer() && (
          <>
            <Text variant="caption" tone="muted">
              Server: {env.visionProxyUrl}
            </Text>
            <Button label="Check connection" size="sm" variant="secondary" icon="refresh" onPress={check} />
          </>
        )}
      </Surface>

      <SectionHeader title="Support" />
      <Surface style={{ paddingVertical: spacing.xs }}>
        <LinkRow icon="flag-outline" label="Report an incorrect result" onPress={() => router.push('/report')} />
        <LinkRow icon="chatbubble-ellipses-outline" label={subscription.isPremium ? 'Priority support' : 'Contact support'} onPress={() => support(subscription.isPremium ? 'Priority support' : 'Support')} />
        <LinkRow icon="bulb-outline" label="Send feedback" onPress={() => support('Feedback')} />
        <LinkRow
          icon="document-text-outline"
          label={`Reports submitted (${reports.length})`}
          onPress={() => Alert.alert('Your reports', reports.length ? `${reports.length} report(s). We reply by email within 3 business days.` : 'No reports yet. Use "This looks wrong" on any result.')}
          last
        />
      </Surface>

      {hasSamples && (
        <>
          <SectionHeader title="Data" />
          <Surface style={{ gap: spacing.md }}>
            <Text variant="caption" tone="secondary">
              Sample records were added so you could explore the app. They don't count toward your free limit.
            </Text>
            <Button
              label="Remove sample records"
              variant="secondary"
              size="sm"
              onPress={() =>
                Alert.alert('Remove sample records?', 'Your own scans are not affected.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: clearSampleData },
                ])
              }
            />
          </Surface>
        </>
      )}

      {__DEV__ && (
        <>
          <SectionHeader title="Developer" />
          <Surface style={{ gap: spacing.md }}>
            <Text variant="caption" tone="secondary">
              Demo outcome for the offline mock model
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {(['auto', 'clean', 'minor', 'review', 'bootleg'] as (Scenario | 'auto')[]).map((s) => (
                <Chip key={s} label={s} selected={prefs.demoScenario === s} onPress={() => setPref('demoScenario', s)} />
              ))}
            </View>
            {isMockStore && (
              <Button
                label={subscription.isPremium ? 'Simulate: revert to Free' : 'Simulate: Premium'}
                size="sm"
                variant="secondary"
                onPress={() =>
                  setSubscription(
                    subscription.isPremium
                      ? { isPremium: false, willRenew: false, expiresAt: null, activePlan: null, managementUrl: null }
                      : { isPremium: true, willRenew: true, expiresAt: null, activePlan: 'yearly', managementUrl: null },
                  )
                }
              />
            )}
          </Surface>
        </>
      )}

      <Text variant="caption" tone="muted" align="center">
        VinylVault 0.1.0 · Grades and values are estimates, not appraisals.
      </Text>
    </Screen>
  );
}

function StatusRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }} gap={spacing.md}>
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <Text variant="caption" color={color} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </Row>
  );
}

function Meter({ label, value, max, caption }: { label: string; value: number; max: number; caption: string }) {
  const pct = Math.min(1, value / max);
  const color = pct >= 1 ? colors.review : colors.gold;
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" style={{ fontWeight: '600' }}>
          {label}
        </Text>
        <Text variant="caption" tone="secondary" style={{ fontVariant: ['tabular-nums'] }}>
          {value}/{max}
        </Text>
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text variant="caption" tone="muted">
        {caption}
      </Text>
    </View>
  );
}

function LinkRow({ icon, label, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, !last && styles.border, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
