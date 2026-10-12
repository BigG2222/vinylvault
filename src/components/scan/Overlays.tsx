import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { FramingFeedback, GuideShape } from '@/services/ondevice/framing';
import { FRAMING_THRESHOLDS } from '@/services/ondevice/framing';
import type { FrameStats, GuideRect } from '@/services/ondevice/imageStats';
import { colors, radii, spacing } from '@/theme';

export function guidePixels(guide: GuideRect, screen: { width: number; height: number }) {
  return { left: guide.x * screen.width, top: guide.y * screen.height, width: guide.w * screen.width, height: guide.h * screen.height };
}

export function qualityColor(q: number) {
  return q >= 1 ? colors.authentic : q >= 0.55 ? colors.gold : colors.cream;
}

/**
 * Dims everything outside the guide. Covers get square corner brackets; the
 * label gets a circle with a spindle-hole marker; the runout gets a ring
 * showing where the dead wax sits around the label.
 */
export function FramingOverlay({ guide, screen, quality, shape }: { guide: GuideRect; screen: { width: number; height: number }; quality: number; shape: GuideShape }) {
  const g = guidePixels(guide, screen);
  const color = qualityColor(quality);
  const L = 30;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.dim, { top: 0, left: 0, right: 0, height: g.top }]} />
      <View style={[styles.dim, { top: g.top + g.height, left: 0, right: 0, bottom: 0 }]} />
      <View style={[styles.dim, { top: g.top, left: 0, width: g.left, height: g.height }]} />
      <View style={[styles.dim, { top: g.top, left: g.left + g.width, right: 0, height: g.height }]} />
      <View style={[styles.guide, g]}>
        {shape === 'cover' &&
          (['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View
              key={c}
              style={[
                styles.corner,
                { width: L, height: L, borderColor: color },
                c === 'tl' && { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
                c === 'tr' && { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
                c === 'bl' && { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
                c === 'br' && { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
              ]}
            />
          ))}
        {shape === 'label' && (
          <View style={[styles.circle, { borderColor: color, borderRadius: g.width / 2 }]}>
            <View style={[styles.spindle, { borderColor: color }]} />
          </View>
        )}
        {shape === 'runout' && (
          <View style={[styles.circle, { borderColor: color, borderRadius: g.width / 2, borderStyle: 'dashed' }]}>
            <View style={[styles.innerLabel, { width: g.width * 0.55, height: g.width * 0.55, borderRadius: g.width, borderColor: color + '88' }]} />
          </View>
        )}
      </View>
    </View>
  );
}

export function StatusPill({ feedback }: { feedback: FramingFeedback }) {
  const icon: keyof typeof Ionicons.glyphMap =
    feedback.state === 'ready' ? 'checkmark-circle' : feedback.state === 'too_dark' ? 'sunny' : feedback.state === 'glare' ? 'flash-off' : feedback.state === 'blurry' ? 'hand-left' : 'scan';
  const color = qualityColor(feedback.quality);
  return (
    <View style={styles.pill} accessibilityLiveRegion="polite" accessibilityLabel={feedback.message}>
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="caption" style={{ fontWeight: '600' }}>
        {feedback.message}
      </Text>
    </View>
  );
}

type ItemState = 'pending' | 'active' | 'ok';

/**
 * Live, honest on-device feedback. Each line reflects a real measurement from
 * the current frame.
 */
export function LiveChecklist({ stats, shape }: { stats: FrameStats | null; shape: GuideShape }) {
  const t = FRAMING_THRESHOLDS;
  const framedOk = shape === 'runout' ? !!stats : !!stats && stats.edgeAlignment >= (shape === 'cover' ? t.alignedAlignment : t.searchingAlignment);
  const lightOk = !!stats && stats.meanLuma >= t.minLuma && stats.glareRatio <= t.maxGlare;
  const sharpOk = !!stats && stats.sharpness >= t.minSharpness;
  const items: { label: string; activeLabel: string; state: ItemState }[] = [
    { label: shape === 'label' ? 'Label centered' : shape === 'runout' ? 'Dead wax in view' : 'Edges detected', activeLabel: 'Finding edges…', state: framedOk ? 'ok' : 'active' },
    { label: 'Lighting even', activeLabel: 'Checking lighting…', state: !framedOk ? 'pending' : lightOk ? 'ok' : 'active' },
    { label: shape === 'cover' ? 'Print in focus' : 'Text in focus', activeLabel: 'Checking focus…', state: !framedOk || !lightOk ? 'pending' : sharpOk ? 'ok' : 'active' },
  ];
  return (
    <View style={styles.checklist}>
      {items.map((it) => (
        <View key={it.label} style={styles.checkItem}>
          {it.state === 'ok' ? (
            <Ionicons name="checkmark-circle" size={14} color={colors.authentic} />
          ) : it.state === 'active' ? (
            <ActivityIndicator size="small" color={colors.gold} style={{ transform: [{ scale: 0.7 }] }} />
          ) : (
            <Ionicons name="ellipse-outline" size={14} color={colors.textMuted} />
          )}
          <Text variant="caption" color={it.state === 'pending' ? colors.textMuted : colors.text} style={{ fontSize: 12 }}>
            {it.state === 'active' ? it.activeLabel : it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(4,7,14,0.62)' },
  guide: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute' },
  circle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  spindle: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  innerLabel: { borderWidth: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  checklist: { gap: 6, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.overlay },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 18 },
});
