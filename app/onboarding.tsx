import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Row, Text } from '@/components/ui';
import { FALLBACK_PRICING, FREE_COLLECTION_LIMIT, FREE_DAILY_SCANS, FREE_LAUNCH } from '@/config';
import { useApp } from '@/store';
import { colors, radii, spacing } from '@/theme';

type Page = { key: string };
// The pricing page only makes sense once subscriptions are on.
const PAGES: Page[] = FREE_LAUNCH ? [{ key: 'what' }, { key: 'tips' }] : [{ key: 'what' }, { key: 'tips' }, { key: 'pricing' }];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Page>>(null);
  const completeOnboarding = useApp((s) => s.completeOnboarding);

  const goTo = (i: number) => {
    setIndex(i);
    list.current?.scrollToOffset({ offset: i * width, animated: true });
  };
  const next = () => {
    if (index < PAGES.length - 1) goTo(index + 1);
    else finish();
  };
  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0E1A33', colors.bg]} style={StyleSheet.absoluteFill} />
      <Row style={styles.top}>
        <Text variant="label" tone="gold">
          VinylVault
        </Text>
        {index < PAGES.length - 1 && <Button label="Skip" variant="ghost" size="sm" onPress={() => goTo(PAGES.length - 1)} />}
      </Row>
      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
            {item.key === 'what' && <WhatPage />}
            {item.key === 'tips' && <TipsPage />}
            {item.key === 'pricing' && <PricingPage />}
          </ScrollView>
        )}
      />
      <View style={styles.footer}>
        <Row style={{ justifyContent: 'center' }} gap={6}>
          {PAGES.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </Row>
        <Button label={index === PAGES.length - 1 ? 'Start scanning free' : 'Continue'} size="lg" full onPress={next} />
        {index === PAGES.length - 1 && (
          <Text variant="caption" tone="muted" align="center">
            No account or payment needed. Upgrade anytime from Profile.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <Row gap={spacing.md} style={{ alignItems: 'flex-start' }}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="secondary">
          {body}
        </Text>
      </View>
    </Row>
  );
}

function WhatPage() {
  return (
    <View style={styles.page}>
      <Text variant="display">Know which pressing you own.</Text>
      <Text variant="body" tone="secondary">
        Photograph the covers and the label. VinylVault narrows down the exact pressing, grades the vinyl and sleeve, checks for bootleg signs and shows a value range.
      </Text>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        <Feature icon="search" title="Pressings you can verify" body="Top matches with confidence scores, by label, catalog number, country and year. Pick the right one if we're unsure." />
        <Feature icon="disc" title="Goldmine grades" body="Separate grades for the vinyl and the sleeve, with what we saw: scuffs, scratches, ring wear, seam splits, writing." />
        <Feature icon="shield-checkmark" title="Eight pressing checks" body="Label print, runout etching, catalog numbers, barcode vs era and known bootleg signs, each explained in plain language." />
        <Feature icon="trending-up" title="Honest value ranges" body="Low, average and high for your copy's condition, with dates and sources. A range, not a single number." />
      </View>
    </View>
  );
}

function TipsPage() {
  const tips: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['sunny', 'One lamp, off to the side', 'Glossy sleeves and labels reflect. Turn off overhead lights and avoid flash.'],
    ['ellipse-outline', 'Label straight on', 'Fill the circle with side A. Small label text is where most bootlegs slip up.'],
    ['finger-print', 'Tilt for the runout', 'The dead-wax etching shows up when light grazes it. Hold the record at an angle under the lamp.'],
    ['barcode-outline', 'Barcode, or none', 'Scan it if there is one. If there isn’t, say so: that matters for older pressings.'],
    ['ear-outline', 'Photos can’t hear', 'Grades come from what is visible. Play the record to check for noise before you buy or sell.'],
  ];
  return (
    <View style={styles.page}>
      <Text variant="display">Better photos, better answers.</Text>
      <Text variant="body" tone="secondary">
        Identification and checks are only as good as the photos. A minute of care makes a real difference.
      </Text>
      <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
        {tips.map(([icon, title, body]) => (
          <Feature key={title} icon={icon} title={title} body={body} />
        ))}
      </View>
    </View>
  );
}

function PricingPage() {
  return (
    <View style={styles.page}>
      <Text variant="display">Free is genuinely useful.</Text>
      <View style={styles.planCard}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Free</Text>
          <Text variant="heading">$0</Text>
        </Row>
        <PlanLine text={`${FREE_DAILY_SCANS} scans every day`} />
        <PlanLine text={`Full collection for up to ${FREE_COLLECTION_LIMIT} records`} />
        <PlanLine text="Pressing result and a plain-language explanation for every check" />
        <PlanLine text="Media and sleeve grades, and value ranges" />
      </View>
      <View style={[styles.planCard, { borderColor: colors.gold + '77' }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading" tone="gold">
            Premium
          </Text>
          <Text variant="caption" tone="secondary">
            {FALLBACK_PRICING.monthly.label}/mo or {FALLBACK_PRICING.yearly.label}/yr
          </Text>
        </Row>
        <PlanLine text="Unlimited scans and collection" gold />
        <PlanLine text="Detailed evidence for every check" gold />
        <PlanLine text="Value at every grade, folders, advanced filters, CSV/PDF export" gold />
        <Text variant="caption" tone="muted">
          {FALLBACK_PRICING.trialDays}-day free trial. The exact price is shown before you start, and you can cancel in two taps.
        </Text>
      </View>
      <Row gap={spacing.sm} style={styles.highlight}>
        <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
        <Text variant="caption" color={colors.cream} style={{ flex: 1 }}>
          Every result shows confidence scores. If something looks wrong, report it and we'll review it.
        </Text>
      </Row>
    </View>
  );
}

function PlanLine({ text, gold }: { text: string; gold?: boolean }) {
  return (
    <Row gap={spacing.sm}>
      <Ionicons name="checkmark" size={16} color={gold ? colors.gold : colors.authentic} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { justifyContent: 'space-between', paddingHorizontal: spacing.xxl, height: 44 },
  page: { gap: spacing.lg, paddingTop: spacing.lg },
  footer: { padding: spacing.xxl, gap: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { width: 22, backgroundColor: colors.gold },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold + '14',
    borderWidth: 1,
    borderColor: colors.gold + '2A',
  },
  planCard: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  highlight: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.gold + '10', alignItems: 'flex-start' },
});
