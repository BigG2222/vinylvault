import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { CHECK_TITLES } from '@/services/vision/verdict';
import { checkStatusMeta, colors, spacing } from '@/theme';
import type { AuthCheck } from '@/types';
import { percent } from '@/utils/format';

const SOURCE_LABEL = { on_device: 'On-device', cloud: 'Cloud AI', combined: 'On-device + cloud' } as const;

/**
 * Per-check explanations. Everyone sees the status and one-line summary;
 * premium users can expand each check for the evidence and confidence.
 */
export function CheckList({ checks, detailed }: { checks: AuthCheck[]; detailed: boolean }) {
  const ordered = [...checks].sort((a, b) => Number(a.status === 'not_applicable') - Number(b.status === 'not_applicable'));
  return (
    <View>
      {ordered.map((c, i) => (
        <CheckRow key={c.id} check={c} detailed={detailed} last={i === ordered.length - 1} />
      ))}
    </View>
  );
}

function CheckRow({ check, detailed, last }: { check: AuthCheck; detailed: boolean; last: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = checkStatusMeta[check.status];
  const expandable = detailed && Boolean(check.detail) && check.status !== 'not_applicable';
  const dim = check.status === 'not_applicable';
  return (
    <Pressable
      disabled={!expandable}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((o) => !o);
      }}
      style={[styles.row, !last && styles.border]}
      accessibilityRole={expandable ? 'button' : undefined}
      accessibilityLabel={`${CHECK_TITLES[check.id]}: ${meta.label}. ${check.summary}`}
      accessibilityState={expandable ? { expanded: open } : undefined}
    >
      <Ionicons name={meta.icon} size={20} color={meta.color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2, opacity: dim ? 0.55 : 1 }}>
        <View style={styles.head}>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {CHECK_TITLES[check.id]}
          </Text>
          <Text variant="caption" color={meta.color} style={{ fontWeight: '600' }}>
            {meta.label}
          </Text>
          {expandable && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />}
        </View>
        <Text variant="caption" tone="secondary">
          {check.summary}
        </Text>
        {open && (
          <View style={styles.detail}>
            <Text variant="caption" tone="primary">
              {check.detail}
            </Text>
            <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {SOURCE_LABEL[check.source]} · confidence {percent(check.confidence)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detail: { marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: 10 },
});
