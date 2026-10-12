import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '@/theme';
import { Text } from './Text';

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  contentStyle,
  ...scrollProps
}: { children: ReactNode; scroll?: boolean; edges?: Edge[]; contentStyle?: StyleProp<ViewStyle> } & ScrollViewProps) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false} {...scrollProps}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Surface({ children, style, raised, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; raised?: boolean; onPress?: () => void }) {
  const base = [styles.surface, raised && { backgroundColor: colors.surfaceRaised }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfacePressed }]}>
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  locked,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  locked?: boolean;
}) {
  const accent = color ?? colors.gold;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: accent + '22', borderColor: accent },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? accent : colors.textSecondary} />}
      <Text variant="caption" color={selected ? accent : colors.textSecondary} style={{ fontWeight: '600' }}>
        {label}
      </Text>
      {locked && <Ionicons name="lock-closed" size={11} color={colors.goldDim} />}
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.gold} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text variant="body" tone="secondary" align="center" style={{ maxWidth: 300 }}>
        {body}
      </Text>
      {action}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

export function Row({ children, style, gap = spacing.sm, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; accessibilityLabel?: string }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

export function IconButton({ icon, onPress, label, color = colors.text, size = 22 }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; color?: string; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.surfacePressed }]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2, gap: spacing.xl },
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold + '14',
    borderWidth: 1,
    borderColor: colors.gold + '33',
    marginBottom: spacing.xs,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
