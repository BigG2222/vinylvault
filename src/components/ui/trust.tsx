import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { DISCOGS_ATTRIBUTION, RESULT_DISCLAIMER } from '@/config';
import { colors, radii, spacing, verdictMeta } from '@/theme';
import type { PressingVerdict, PriceEstimate } from '@/types';
import { compactMoney, confidenceLabel, formatDate, money, percent } from '@/utils/format';
import { Text } from './Text';

export function VerdictBadge({ verdict, size = 'md' }: { verdict: PressingVerdict; size?: 'sm' | 'md' | 'lg' }) {
  const m = verdictMeta[verdict];
  if (size === 'sm') {
    return (
      <View style={[styles.badgeSm, { backgroundColor: m.color + '1F', borderColor: m.color + '55' }]} accessibilityLabel={`Pressing: ${m.label}`}>
        <Ionicons name={m.icon} size={11} color={m.color} />
        <Text variant="caption" color={m.color} style={{ fontSize: 11, fontWeight: '700' }}>
          {m.short}
        </Text>
      </View>
    );
  }
  const lg = size === 'lg';
  return (
    <View
      style={[styles.badge, lg && styles.badgeLg, { backgroundColor: m.color + '18', borderColor: m.color + '66' }]}
      accessibilityRole="summary"
      accessibilityLabel={`Pressing result: ${m.label}. ${m.blurb}`}
    >
      <View style={[styles.badgeIcon, lg && { width: 44, height: 44, borderRadius: 22 }, { backgroundColor: m.color + '26' }]}>
        <Ionicons name={m.icon} size={lg ? 24 : 18} color={m.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="muted" style={{ fontSize: 10 }}>
          Pressing & authenticity
        </Text>
        <Text variant={lg ? 'title' : 'heading'} color={m.color}>
          {m.label}
        </Text>
      </View>
    </View>
  );
}

/** Plain-language caveat beside every result, linking to the report flow. */
export function ReviewNote({ onReport }: { onReport: () => void }) {
  return (
    <Pressable onPress={onReport} style={styles.note} accessibilityRole="button" accessibilityLabel={`${RESULT_DISCLAIMER} Opens the report form.`}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} style={{ marginTop: 1 }} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
        {RESULT_DISCLAIMER}
      </Text>
      <Ionicons name="flag-outline" size={16} color={colors.gold} style={{ marginTop: 1 }} />
    </Pressable>
  );
}

export function ConfidenceMeter({ value, label = 'Match confidence' }: { value: number; label?: string }) {
  const color = value >= 0.82 ? colors.authentic : value >= 0.65 ? colors.review : colors.risk;
  return (
    <View style={{ gap: 6 }} accessibilityLabel={`${label}: ${percent(value)}, ${confidenceLabel(value)}`}>
      <View style={styles.meterHead}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Text variant="caption" color={color} style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {percent(value)} · {confidenceLabel(value)}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Low / average / high price visual. Never collapses to a single number. */
export function PriceRange({ price, compact }: { price: PriceEstimate; compact?: boolean }) {
  const span = Math.max(0.01, price.high - price.low);
  const avgPos = (price.avg - price.low) / span;
  const c = price.currency;
  return (
    <View style={{ gap: spacing.md }} accessibilityLabel={`Estimated value ${money(price.low, false, c)} to ${money(price.high, false, c)}, average ${money(price.avg, false, c)}`}>
      <View style={styles.priceRow}>
        <PriceCell label="Low" value={price.low} currency={c} />
        <PriceCell label="Average" value={price.avg} currency={c} emphasis />
        <PriceCell label="High" value={price.high} currency={c} align="right" />
      </View>
      <View style={styles.rangeTrack}>
        <LinearGradient colors={[colors.goldDim, colors.gold, colors.goldBright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.rangeMarker, { left: `${Math.min(96, Math.max(4, avgPos * 100))}%` }]} />
      </View>
      {!compact && (
        <View style={{ gap: 2 }}>
          <Text variant="caption" tone="muted">
            {price.basis}
            {typeof price.numForSale === 'number' ? ` · ${price.numForSale} for sale` : ''} · updated {formatDate(price.asOf)}
          </Text>
          <PriceSourceLine price={price} />
        </View>
      )}
    </View>
  );
}

/**
 * Stands in for the price panels while an expired Discogs price is being fetched again.
 * Discogs API terms don't allow showing Discogs prices more than 6 hours old.
 */
export function ExpiredPrice({ state, onRetry }: { state: 'idle' | 'loading' | 'failed'; onRetry: () => void }) {
  return (
    <View style={{ gap: spacing.sm, alignItems: 'flex-start' }}>
      {state === 'failed' ? (
        <>
          <Text variant="caption" tone="secondary">
            Discogs prices are only shown for up to 6 hours, and we couldn't fetch today's prices. Check your connection and try again.
          </Text>
          <Pressable onPress={onRetry} accessibilityRole="button">
            <Text variant="caption" tone="gold" style={{ fontWeight: '700' }}>
              Refresh prices
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text variant="caption" tone="secondary">
            Updating Discogs prices…
          </Text>
        </View>
      )}
    </View>
  );
}

/** Says where the numbers came from: Discogs (with the required attribution) or demo values. */
export function PriceSourceLine({ price }: { price: PriceEstimate }) {
  if (price.source === 'discogs') {
    // The Discogs API terms require this notice next to Discogs data, linked to the page it came from.
    const url = price.releaseUrl ?? price.salesHistoryUrl;
    return (
      <Text
        variant="caption"
        tone="secondary"
        style={{ fontWeight: '600', textDecorationLine: url ? 'underline' : 'none' }}
        onPress={url ? () => Linking.openURL(url) : undefined}
        accessibilityRole={url ? 'link' : undefined}
      >
        {DISCOGS_ATTRIBUTION}
      </Text>
    );
  }
  return (
    <Text variant="caption" color={colors.review}>
      Demo values for illustration, not market data.
    </Text>
  );
}

function PriceCell({ label, value, currency, emphasis, align }: { label: string; value: number; currency: string; emphasis?: boolean; align?: 'right' }) {
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : emphasis ? 'center' : 'flex-start', flex: 1 }}>
      <Text variant="label" tone="muted" style={{ fontSize: 10 }}>
        {label}
      </Text>
      <Text variant={emphasis ? 'number' : 'bodyStrong'} color={emphasis ? colors.goldBright : colors.text} style={{ fontVariant: ['tabular-nums'] }}>
        {emphasis ? money(value, false, currency) : compactMoney(value, currency)}
      </Text>
    </View>
  );
}

/** Wraps premium-only content: shows a tasteful teaser and routes to the paywall. */
export function PremiumLock({ locked, title, body, children }: { locked: boolean; title: string; body: string; children: ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <Pressable onPress={() => router.push('/paywall')} style={styles.lock} accessibilityRole="button" accessibilityLabel={`${title}. Premium feature. ${body}`}>
      <View style={styles.lockIcon}>
        <Ionicons name="lock-closed" size={16} color={colors.gold} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" tone="secondary">
          {body}
        </Text>
      </View>
      <Text variant="caption" tone="gold" style={{ fontWeight: '700' }}>
        Premium
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1 },
  badgeLg: { padding: spacing.lg },
  badgeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rangeTrack: { height: 6, borderRadius: 3, overflow: 'hidden', justifyContent: 'center' },
  rangeMarker: { position: 'absolute', width: 3, height: 14, marginLeft: -1.5, borderRadius: 2, backgroundColor: colors.text },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.goldDim,
    backgroundColor: colors.gold + '0A',
  },
  lockIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold + '1A', alignItems: 'center', justifyContent: 'center' },
});
