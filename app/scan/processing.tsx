import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Row, Text } from '@/components/ui';
import { runScanPipeline, STAGE_COPY, type PipelineStage } from '@/services/vision/pipeline';
import { VisionError } from '@/services/vision/types';
import { useApp, useScanSession } from '@/store';
import { colors, radii, spacing } from '@/theme';

const ORDER: PipelineStage[] = ['precheck', 'prepare', 'identify', 'authenticate', 'pricing'];

export default function Processing() {
  const draft = useScanSession((s) => s.draft);
  const recordScan = useApp((s) => s.recordScan);
  const updateScan = useApp((s) => s.updateScan);
  const updateRecord = useApp((s) => s.updateRecord);
  const [stage, setStage] = useState<PipelineStage>('precheck');
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!draft.frontUri) {
      router.replace('/scan');
      return;
    }
    setError(null);
    abort.current = new AbortController();
    try {
      const result = await runScanPipeline(
        { frontUri: draft.frontUri, backUri: draft.backUri, labelUri: draft.labelUri, runoutUri: draft.runoutUri, barcode: draft.barcode, confirmedIdentity: draft.confirmedIdentity, source: draft.source },
        setStage,
        abort.current.signal,
      );
      if (draft.replaceScanId) {
        // Re-run after a match correction: keep the original scan id and timestamp.
        const original = useApp.getState().scans.find((s) => s.id === draft.replaceScanId);
        updateScan({ ...result, id: draft.replaceScanId, createdAt: original?.createdAt ?? result.createdAt });
        router.replace({ pathname: '/scan/result', params: { id: draft.replaceScanId } });
        return;
      }
      recordScan(result);
      if (draft.rescanRecordId) {
        updateRecord(draft.rescanRecordId, {
          checks: result.checks,
          verdict: result.verdict,
          condition: result.condition,
          price: result.price,
          images: result.images,
          observed: result.observed,
          scanId: result.id,
        });
      }
      router.replace({ pathname: '/scan/result', params: { id: result.id } });
    } catch (e) {
      if (abort.current?.signal.aborted) return;
      if (e instanceof VisionError) {
        const copy: Record<VisionError['kind'], { title: string; body: string }> = {
          offline: { title: "You're offline", body: 'The on-device pre-check finished, but identification and the pressing checks need a connection. Your photos are kept, so retry when you are back online. This scan will not count against your daily limit.' },
          timeout: { title: 'This is taking longer than usual', body: 'The analysis service is slow right now. Your photos are kept. Try again in a moment.' },
          refused: { title: "We couldn't read this record", body: 'Try again with the whole cover or label in frame, in even light, without glare.' },
          bad_response: { title: 'Something went wrong', body: 'We got an incomplete result and would rather not guess. Please try again.' },
          server: { title: 'Service unavailable', body: 'Our analysis service had a problem. Your photos are kept. Please try again.' },
        };
        setError(copy[e.kind]);
      } else {
        setError({ title: 'Something went wrong', body: 'Please try again. If it keeps happening, contact support from your profile.' });
      }
    }
  }, [draft, recordScan, updateScan, updateRecord]);

  useEffect(() => {
    run();
    return () => abort.current?.abort();
    // Run once on mount; retries call run() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = ORDER.indexOf(stage);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.photos}>
        {draft.frontUri && <Image source={{ uri: draft.frontUri }} style={styles.photo} contentFit="cover" />}
        {draft.backUri && <Image source={{ uri: draft.backUri }} style={[styles.photo, { marginLeft: -30, transform: [{ rotate: '6deg' }] }]} contentFit="cover" />}
      </View>

      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <Text variant="title" align="center">
          {error ? error.title : 'Analyzing your record'}
        </Text>
        {!error && (
          <Text variant="caption" tone="secondary" align="center">
            On-device pre-check, then cloud identification and pressing checks
          </Text>
        )}
      </View>

      {error ? (
        <View style={{ gap: spacing.lg }}>
          <Text variant="body" tone="secondary" align="center">
            {error.body}
          </Text>
          <Button label="Try again" icon="refresh" size="lg" onPress={run} />
          <Button label="Retake photos" variant="secondary" onPress={() => router.replace('/scan')} />
          <Button label="Cancel" variant="ghost" onPress={() => router.dismissAll()} />
        </View>
      ) : (
        <View style={styles.stages}>
          {ORDER.map((s, i) => {
            const state = i < current || stage === 'done' ? 'done' : i === current ? 'active' : 'pending';
            return (
              <Row key={s} gap={spacing.md} style={styles.stageRow}>
                <View style={styles.stageIcon}>
                  {state === 'done' ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.authentic} />
                  ) : state === 'active' ? (
                    <ActivityIndicator color={colors.gold} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color={state === 'pending' ? colors.textMuted : colors.text}>
                    {STAGE_COPY[s].title}
                    {s === 'precheck' || s === 'prepare' ? <Text variant="caption" tone="muted">{'  '}on device</Text> : null}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {s === 'authenticate' && !draft.runoutUri ? 'Eight checks (runout skipped: no photo)' : STAGE_COPY[s].detail}
                  </Text>
                </View>
              </Row>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.xxl, gap: spacing.xxl, justifyContent: 'center' },
  photos: { flexDirection: 'row', justifyContent: 'center' },
  photo: { width: 128, height: 128, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  stages: { gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stageRow: { paddingVertical: spacing.sm },
  stageIcon: { width: 24, alignItems: 'center' },
});
