import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CheckList } from '@/components/record/CheckList';
import { ConditionPanel, GradePriceTable, MatchList, ObservedPanel, SalesPanel } from '@/components/record/Panels';
import { RecordArt } from '@/components/record/RecordArt';
import { Button, ConfidenceMeter, EmptyState, PremiumLock, PriceRange, ReviewNote, Row, Screen, SectionHeader, Surface, Text, VerdictBadge } from '@/components/ui';
import { getPrice } from '@/services/pricing';
import { mergeOnDeviceEvidence } from '@/services/vision/merge';
import { authenticationConfidence, computeVerdict } from '@/services/vision/verdict';
import { useApp, useScanSession } from '@/store';
import { colors, radii, spacing, verdictMeta } from '@/theme';
import type { ScanResult } from '@/types';
import { formatLine, originLine, pressingLine } from '@/utils/format';

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = useApp((s) => s.scans.find((x) => x.id === id));
  const savedRecord = useApp((s) => s.collection.find((c) => c.scanId === id));
  const isPremium = useApp((s) => s.subscription.isPremium);
  const updateScan = useApp((s) => s.updateScan);
  const saveScanToCollection = useApp((s) => s.saveScanToCollection);
  const resetDraft = useScanSession((s) => s.reset);
  const [remapped, setRemapped] = useState(false);

  if (!scan) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="alert-circle-outline" title="Scan not found" body="It may have been cleared from recent scans." action={<Button label="Back home" onPress={() => router.dismissAll()} />} />
      </Screen>
    );
  }

  const match = scan.matches[scan.selectedMatchIndex];
  const identity = match.identity;
  const has = scan.isSample
    ? { back: true, label: true, runout: Boolean(scan.observed.runout) }
    : { back: Boolean(scan.images.back), label: Boolean(scan.images.label), runout: Boolean(scan.images.runout) };

  const selectMatch = async (index: number) => {
    if (index === scan.selectedMatchIndex) return;
    const next = scan.matches[index].identity;
    // Immediate local update: re-apply the on-device rules (barcode vs era etc.) for this pressing and reprice.
    const checks = mergeOnDeviceEvidence(scan.rawChecks, { identity: next, precheck: scan.precheck, has, source: scan.source });
    const { verdict, summary } = computeVerdict({ checks, pressingType: next.pressingType });
    const price = await getPrice(next, scan.condition);
    updateScan({ ...scan, selectedMatchIndex: index, checks, verdict, verdictSummary: summary, price });
    setRemapped(true);
  };

  const rerunChecks = () => {
    if (!scan.images.front) return;
    resetDraft({
      frontUri: scan.images.front,
      backUri: scan.images.back,
      labelUri: scan.images.label,
      runoutUri: scan.images.runout,
      barcode: scan.precheck.barcode,
      confirmedIdentity: identity,
      replaceScanId: scan.id,
      source: scan.source,
    });
    router.push('/scan/processing');
  };

  const save = () => {
    const r = saveScanToCollection(scan.id);
    if (r.ok) {
      Alert.alert('Saved to collection', `${identity.title} was added.`, [
        { text: 'View record', onPress: () => router.push({ pathname: '/record/[id]', params: { id: r.recordId } }) },
        { text: 'Done', style: 'cancel' },
      ]);
    } else if (r.reason === 'limit') {
      router.push({ pathname: '/paywall', params: { reason: 'collection' } });
    } else if (r.reason === 'exists' && r.recordId) {
      router.push({ pathname: '/record/[id]', params: { id: r.recordId } });
    }
  };

  const missing = [!has.label && 'label', !has.runout && 'runout', !has.back && 'back cover'].filter(Boolean) as string[];

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: verdictMeta[scan.verdict].short }} />

      {scan.isSample && <Banner icon="information-circle" color={colors.info} text="Sample result to show how VinylVault works. Scan your own record to see real results." />}
      {!scan.isSample && scan.provider.startsWith('Demo model') && (
        <Banner icon="flask-outline" color={colors.review} bold="Demo mode. " text="This result is simulated and does not reflect your photos. Connect the vision server to analyze real records." />
      )}
      {scan.source === 'library' && (
        <Banner icon="images-outline" color={colors.info} text="Checked from uploaded photos. Listing photos can hide wear and rarely show the runout, so treat this as a first opinion." />
      )}

      <Surface style={{ gap: spacing.lg }}>
        <Row gap={spacing.lg} style={{ alignItems: 'flex-start' }}>
          <RecordArt identity={identity} uri={scan.images.front || undefined} width={96} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="label" tone="muted">
              {scan.selectedMatchIndex === 0 ? 'Top match' : 'Your selection'}
            </Text>
            <Text variant="title">{identity.title}</Text>
            <Text variant="body" tone="secondary">
              {identity.artist}
            </Text>
            <Text variant="caption" tone="secondary">
              {pressingLine(identity)} · {originLine(identity)}
            </Text>
            <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 2 }}>
              <Tag text={identity.pressingType === 'original' ? 'Original pressing' : identity.pressingType === 'reissue' ? 'Reissue' : 'Pressing unclear'} gold={identity.pressingType === 'original'} />
              <Tag text={formatLine(identity)} />
              <Tag text={identity.genre} />
              {identity.discogsVerified && <Tag text="Found on Discogs" />}
            </Row>
          </View>
        </Row>
        <ConfidenceMeter value={match.confidence} label="Pressing match confidence" />
        {identity.pressingNotes ? (
          <Text variant="caption" tone="muted">
            {identity.pressingNotes}
          </Text>
        ) : null}
        {identity.discogsUrl ? (
          <Pressable onPress={() => Linking.openURL(identity.discogsUrl!)} accessibilityRole="link" style={styles.link}>
            <Ionicons name="open-outline" size={14} color={colors.gold} />
            <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>
              View this release on Discogs
            </Text>
          </Pressable>
        ) : null}
        {scan.userConfirmedMatch && (
          <Text variant="caption" tone="muted">
            You confirmed this pressing. Checks were re-run against it.
          </Text>
        )}
      </Surface>

      <PhotoStrip scan={scan} />

      <View style={{ gap: spacing.md }}>
        <VerdictBadge verdict={scan.verdict} size="lg" />
        <ConfidenceMeter value={authenticationConfidence(scan.checks)} label="Check confidence" />
        <Text variant="body" tone="secondary">
          {scan.verdictSummary}
        </Text>
        <ReviewNote onReport={() => router.push({ pathname: '/report', params: { scanId: scan.id } })} />
        {missing.length > 0 && !scan.isSample && (
          <Pressable
            onPress={() => {
              resetDraft({});
              router.push('/scan');
            }}
            style={styles.nudge}
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={18} color={colors.review} />
            <Text variant="caption" style={{ flex: 1 }}>
              No {missing.join(', ')} photo, so those checks were skipped. Rescan with them for a stronger result.
            </Text>
          </Pressable>
        )}
      </View>

      <SectionHeader title="What we checked" />
      <Surface style={{ paddingVertical: spacing.xs }}>
        <CheckList checks={scan.checks} detailed={isPremium} />
      </Surface>
      {!isPremium && (
        <Pressable onPress={() => router.push('/paywall')} accessibilityRole="button">
          <Text variant="caption" tone="muted" align="center">
            Want the evidence behind each check? <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>Premium shows the full breakdown.</Text>
          </Text>
        </Pressable>
      )}

      <SectionHeader title="Read from your record" />
      <Surface>
        <ObservedPanel observed={scan.observed} />
        {identity.matrix ? (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Expected runout for this pressing: {identity.matrix}
          </Text>
        ) : null}
      </Surface>

      {scan.matches.length > 1 && (
        <>
          <SectionHeader title="Not the right pressing?" />
          <Surface style={{ gap: spacing.md }}>
            <Text variant="caption" tone="secondary">
              Pick the correct one. The verdict, checks and value update immediately.
            </Text>
            <MatchList matches={scan.matches} selected={scan.selectedMatchIndex} onSelect={selectMatch} />
            {remapped && scan.images.front ? <Button label="Re-run all checks for this pressing" icon="refresh" variant="secondary" onPress={rerunChecks} /> : null}
          </Surface>
        </>
      )}

      <SectionHeader title="Condition" />
      <Surface>
        <ConditionPanel condition={scan.condition} />
      </Surface>

      <SectionHeader title="Market value" />
      <Surface style={{ gap: spacing.lg }}>
        <PriceRange price={scan.price} />
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
            Recent sales
          </Text>
          <SalesPanel price={scan.price} />
        </View>
      </Surface>
      <PremiumLock locked={!isPremium} title="Value at every grade" body="See what this pressing is worth from Mint down to Poor.">
        <Surface>
          <GradePriceTable price={scan.price} media={scan.condition.media.grade} />
        </Surface>
      </PremiumLock>

      <View style={{ gap: spacing.md }}>
        {savedRecord ? (
          <Button label="View in collection" icon="albums" size="lg" onPress={() => router.push({ pathname: '/record/[id]', params: { id: savedRecord.id } })} />
        ) : (
          <Button label="Save to collection" icon="add-circle" size="lg" onPress={save} />
        )}
        <Row gap={spacing.md}>
          <Button label="This looks wrong" icon="flag-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/report', params: { scanId: scan.id } })} />
          <Button
            label="Scan another"
            icon="disc"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              resetDraft({});
              router.replace('/scan');
            }}
          />
        </Row>
      </View>

      <Footer scan={scan} />
    </Screen>
  );
}

function PhotoStrip({ scan }: { scan: ScanResult }) {
  const shots = (
    [
      ['Front', scan.images.front],
      ['Back', scan.images.back],
      ['Label', scan.images.label],
      ['Runout', scan.images.runout],
    ] as const
  ).filter(([, uri]) => Boolean(uri));
  if (shots.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {shots.map(([label, uri]) => (
        <View key={label} style={{ gap: 4 }}>
          <Image source={{ uri: uri! }} style={[styles.shot, label === 'Label' && { borderRadius: 40 }]} contentFit="cover" accessibilityLabel={`${label} photo`} />
          <Text variant="caption" tone="muted" align="center" style={{ fontSize: 11 }}>
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Tag({ text, gold }: { text: string; gold?: boolean }) {
  return (
    <View style={[styles.tag, gold && { borderColor: colors.gold + '77', backgroundColor: colors.gold + '14' }]}>
      <Text variant="caption" color={gold ? colors.gold : colors.textSecondary} style={{ fontSize: 11, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

function Banner({ icon, color, text, bold }: { icon: 'information-circle' | 'flask-outline' | 'images-outline'; color: string; text: string; bold?: string }) {
  return (
    <Row gap={spacing.sm} style={[styles.banner, { backgroundColor: color + '14', alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {bold ? <Text variant="caption" style={{ fontWeight: '700' }}>{bold}</Text> : null}
        {text}
      </Text>
    </Row>
  );
}

function Footer({ scan }: { scan: ScanResult }) {
  const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  return (
    <Text variant="caption" tone="muted" align="center">
      {scan.provider} · on-device {s(scan.timing.onDeviceMs)} · cloud {s(scan.timing.cloudMs)}
    </Text>
  );
}


const styles = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.review + '14', borderWidth: 1, borderColor: colors.review + '44' },
  banner: { padding: spacing.md, borderRadius: radii.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  shot: { width: 80, height: 80, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
});
