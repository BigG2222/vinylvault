import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { CheckList } from '@/components/record/CheckList';
import { ConditionPanel, GradePriceTable, ObservedPanel, SalesPanel } from '@/components/record/Panels';
import { RecordArt } from '@/components/record/RecordArt';
import { Button, Chip, ConfidenceMeter, EmptyState, IconButton, PremiumLock, PriceRange, ReviewNote, Row, Screen, SectionHeader, Surface, Text, VerdictBadge } from '@/components/ui';
import { authenticationConfidence } from '@/services/vision/verdict';
import { allTags, scansRemaining, useApp, useScanSession } from '@/store';
import { colors, radii, spacing } from '@/theme';
import { formatDate, formatLine, originLine, pressingLine } from '@/utils/format';

type Side = 'front' | 'back' | 'label' | 'runout';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const record = useApp((s) => s.collection.find((c) => c.id === id));
  const isPremium = useApp((s) => s.subscription.isPremium);
  const customTags = useApp((s) => s.customTags);
  const updateRecord = useApp((s) => s.updateRecord);
  const removeRecord = useApp((s) => s.removeRecord);
  const addTag = useApp((s) => s.addTag);
  const usage = useApp((s) => s.usage);
  const subscription = useApp((s) => s.subscription);
  const resetDraft = useScanSession((s) => s.reset);
  const [side, setSide] = useState<Side>('front');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [newTag, setNewTag] = useState('');

  if (!record) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="albums-outline" title="Record not found" body="It may have been deleted." action={<Button label="Back to collection" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const i = record.identity;
  const artW = Math.min(240, width * 0.58);
  const sides = (['front', 'back', 'label', 'runout'] as Side[]).filter((s) => Boolean(record.images[s]));

  const toggleTag = (t: string) => {
    if (!isPremium) {
      router.push({ pathname: '/paywall', params: { reason: 'filters' } });
      return;
    }
    updateRecord(record.id, { tags: record.tags.includes(t) ? record.tags.filter((x) => x !== t) : [...record.tags, t] });
  };

  const recheck = () => {
    if (scansRemaining({ usage, subscription }) <= 0) {
      router.push({ pathname: '/paywall', params: { reason: 'scans' } });
      return;
    }
    resetDraft({ rescanRecordId: record.id });
    router.push('/scan');
  };

  const confirmDelete = () =>
    Alert.alert('Delete this record?', `${i.artist} – ${i.title} will be removed from your collection. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeRecord(record.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: i.title, headerRight: () => <IconButton icon="trash-outline" color={colors.risk} label="Delete record" onPress={confirmDelete} /> }} />

      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <RecordArt identity={i} uri={record.images[side] || undefined} width={artW} disc={side === 'front'} />
        {sides.length > 1 ? (
          <Row gap={spacing.sm}>
            {sides.map((s) => (
              <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} selected={side === s} onPress={() => setSide(s)} />
            ))}
          </Row>
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <Text variant="title">{i.title}</Text>
        <Text variant="body" tone="secondary">
          {i.artist}
        </Text>
        <Text variant="caption" tone="secondary">
          {pressingLine(i)} · {originLine(i)} · {formatLine(i)}
        </Text>
        <Text variant="caption" tone="muted">
          {i.genre} · Added {formatDate(record.addedAt, true)}
          {record.isSample ? ' · Sample' : ''}
        </Text>
        {i.discogsUrl ? (
          <Pressable onPress={() => Linking.openURL(i.discogsUrl!)} accessibilityRole="link">
            <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>
              View on Discogs
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Surface style={{ gap: spacing.lg }}>
        <PriceRange price={record.price} />
        <SalesPanel price={record.price} />
      </Surface>
      <PremiumLock locked={!isPremium} title="Value at every grade" body="What this pressing is worth from Mint down to Poor.">
        <Surface>
          <GradePriceTable price={record.price} media={record.condition.media.grade} />
        </Surface>
      </PremiumLock>

      <VerdictBadge verdict={record.verdict} />
      <ConfidenceMeter value={authenticationConfidence(record.checks)} label="Check confidence" />
      <ReviewNote onReport={() => router.push({ pathname: '/report', params: { recordId: record.id } })} />
      <SectionHeader title="What we checked" />
      <Surface style={{ paddingVertical: spacing.xs }}>
        <CheckList checks={record.checks} detailed={isPremium} />
      </Surface>
      <Surface>
        <ObservedPanel observed={record.observed} />
      </Surface>
      <Button label="Rescan & re-check" icon="refresh" variant="secondary" onPress={recheck} />

      <SectionHeader title="Condition" />
      <Surface>
        <ConditionPanel condition={record.condition} />
      </Surface>

      <SectionHeader title="Folders & tags" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {allTags(customTags).map((t) => (
          <Chip key={t} label={t} locked={!isPremium} selected={record.tags.includes(t)} onPress={() => toggleTag(t)} />
        ))}
      </View>
      {isPremium && (
        <TextInput
          value={newTag}
          onChangeText={setNewTag}
          placeholder="New folder name"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 44 }]}
          onSubmitEditing={() => {
            const t = newTag.trim();
            addTag(t);
            if (t && !record.tags.includes(t)) updateRecord(record.id, { tags: [...record.tags, t] });
            setNewTag('');
          }}
          returnKeyType="done"
        />
      )}

      <SectionHeader title="Notes" />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        onBlur={() => notes !== record.notes && updateRecord(record.id, { notes })}
        placeholder="Purchase price, where you got it, how it plays…"
        placeholderTextColor={colors.textMuted}
        multiline
        style={[styles.input, { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md }]}
        accessibilityLabel="Record notes"
      />

      <Pressable onPress={() => router.push({ pathname: '/report', params: { recordId: record.id } })} accessibilityRole="button">
        <Text variant="caption" tone="muted" align="center">
          Something wrong with this record? <Text variant="caption" tone="gold" style={{ fontWeight: '600' }}>Report or request a review</Text>
        </Text>
      </Pressable>

      <Button label="Delete record" variant="danger" icon="trash-outline" onPress={confirmDelete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { color: colors.text, fontSize: 15, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
});
