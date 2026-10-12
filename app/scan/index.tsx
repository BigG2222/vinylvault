import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FramingOverlay, guidePixels, LiveChecklist, StatusPill } from '@/components/scan/Overlays';
import { Button, Row, Text } from '@/components/ui';
import { guideRectForScreen, type GuideShape } from '@/services/ondevice/framing';
import { cropToGuide, screenRectToPhoto } from '@/services/ondevice/sampler';
import { useLiveFraming } from '@/services/ondevice/useLiveFraming';
import { useScanSession } from '@/store';
import { colors, radii, spacing } from '@/theme';

type Step = 'front' | 'back' | 'label' | 'runout' | 'barcode';
const STEPS: Step[] = ['front', 'back', 'label', 'runout', 'barcode'];

const STEP_COPY: Record<Step, { title: string; hint: string; dot: string }> = {
  front: { title: 'Front cover', hint: 'Fill the square. Plain, dark background, no flash.', dot: 'Front' },
  back: { title: 'Back cover', hint: 'Catalog number, credits and label address live here.', dot: 'Back' },
  label: { title: 'Center label, side A', hint: 'Take the record out and shoot the label straight on.', dot: 'Label' },
  runout: { title: 'Runout etching (optional)', hint: 'Tilt the record under a lamp until the etching between the grooves and the label catches the light.', dot: 'Runout' },
  barcode: { title: 'Barcode (optional)', hint: 'Point at the barcode on the back. Older records often have none.', dot: 'Barcode' },
};

const SHAPE: Record<Exclude<Step, 'barcode'>, GuideShape> = { front: 'cover', back: 'cover', label: 'label', runout: 'runout' };

/** Barcode formats used on record sleeves. */
const BARCODE_TYPES = ['ean13', 'upc_a', 'upc_e', 'ean8'] as const;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const draft = useScanSession((s) => s.draft);
  const setDraft = useScanSession((s) => s.setDraft);

  const [step, setStep] = useState<Step>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [torch, setTorch] = useState(false);
  const barcodeLocked = useRef(false);

  const shape: GuideShape = step === 'barcode' ? 'cover' : SHAPE[step];
  const guide = useMemo(() => guideRectForScreen(screen, shape), [screen, shape]);
  const g = guidePixels(guide, screen);

  const live = useLiveFraming(cameraRef, { enabled: cameraReady && step !== 'barcode' && !capturing, guide, shape, screen });

  useEffect(() => {
    if (live.feedback.state === 'ready') Haptics.selectionAsync().catch(() => {});
  }, [live.feedback.state]);

  useEffect(() => {
    barcodeLocked.current = false;
  }, [step]);

  if (!permission) return <View style={styles.black} />;
  if (!permission.granted) return <PermissionGate canAsk={permission.canAskAgain} onAsk={requestPermission} />;

  const next = (from: Step) => {
    const i = STEPS.indexOf(from);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    else finish();
  };
  const finish = () => router.replace('/scan/processing');

  const capture = async () => {
    const cam = cameraRef.current;
    if (!cam || capturing || step === 'barcode') return;
    setCapturing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      const pic = await cam.takePictureAsync({ quality: 0.92 });
      if (!pic) return;
      const dims = { width: pic.width, height: pic.height };
      const uri = await cropToGuide(pic.uri, dims, screenRectToPhoto(guide, screen, dims));
      const key = ({ front: 'frontUri', back: 'backUri', label: 'labelUri', runout: 'runoutUri' } as const)[step];
      setDraft({ [key]: uri });
      next(step);
    } catch {
      Alert.alert('Capture failed', 'Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const skip = () => {
    if (step === 'back') {
      Alert.alert('Skip the back cover?', 'The back cover check will be skipped, and catalog numbers can only be cross-checked against the label.', [
        { text: 'Add back photo', style: 'cancel' },
        { text: 'Skip anyway', style: 'destructive', onPress: () => next('back') },
      ]);
    } else if (step === 'label') {
      Alert.alert('Skip the label?', 'The label is where most bootlegs give themselves away, so both label checks will be skipped.', [
        { text: 'Add label photo', style: 'cancel' },
        { text: 'Skip anyway', style: 'destructive', onPress: () => next('label') },
      ]);
    } else {
      next(step);
    }
  };

  const onBarcode = (r: BarcodeScanningResult) => {
    if (barcodeLocked.current || !r.data) return;
    barcodeLocked.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDraft({ barcode: r.data });
    finish();
  };

  const noBarcode = () => {
    setDraft({ barcode: 'none' });
    finish();
  };

  const ready = live.feedback.state === 'ready';
  const lastThumb = step === 'back' ? draft.frontUri : step === 'label' ? draft.backUri ?? draft.frontUri : step === 'runout' ? draft.labelUri : undefined;

  return (
    <View style={styles.black}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onCameraReady={() => setCameraReady(true)}
        animateShutter={false}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={step === 'barcode' ? onBarcode : undefined}
      />

      {step === 'barcode' ? (
        <BarcodeGuide screen={screen} />
      ) : (
        <FramingOverlay guide={guide} screen={screen} quality={live.feedback.quality} shape={shape} />
      )}

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close scanner" style={styles.roundBtn}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <StepDots step={step} />
        <Pressable onPress={() => setTorch((v) => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel={torch ? 'Turn light off' : 'Turn light on'} style={styles.roundBtn}>
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color={torch ? colors.gold : colors.text} />
        </Pressable>
      </View>

      <View style={[styles.heading, { top: Math.max(insets.top + 60, (step === 'barcode' ? screen.height * 0.3 : g.top) - 78) }]}>
        <Text variant="heading" align="center">
          {STEP_COPY[step].title}
        </Text>
        <Text variant="caption" tone="secondary" align="center">
          {STEP_COPY[step].hint}
        </Text>
      </View>

      {step !== 'barcode' && (
        <View style={{ position: 'absolute', left: g.left + spacing.sm, top: g.top + spacing.sm }}>
          <LiveChecklist stats={live.stats} shape={shape} />
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        {step === 'barcode' ? (
          <View style={{ gap: spacing.md, paddingHorizontal: spacing.xl }}>
            <StatusPill feedback={{ state: 'searching', message: 'Looking for a barcode…', quality: 0.6 }} />
            <Button label="This record has no barcode" icon="close-circle-outline" variant="secondary" full onPress={noBarcode} />
            <Button label="Skip barcode" variant="ghost" onPress={finish} />
          </View>
        ) : (
          <>
            <StatusPill feedback={live.feedback} />
            <Row style={styles.controls}>
              <View style={styles.thumbSlot}>
                {lastThumb ? <Image source={{ uri: lastThumb }} style={styles.thumb} contentFit="cover" accessibilityLabel="Last photo captured" /> : null}
              </View>
              <Pressable
                onPress={capture}
                disabled={!cameraReady || capturing}
                accessibilityRole="button"
                accessibilityLabel={`Capture ${STEP_COPY[step].dot.toLowerCase()} photo`}
                style={({ pressed }) => [styles.shutter, ready && { borderColor: colors.authentic }, pressed && { transform: [{ scale: 0.94 }] }]}
              >
                {capturing ? <ActivityIndicator color={colors.textInverse} /> : <View style={[styles.shutterInner, ready && { backgroundColor: colors.authentic }]} />}
              </Pressable>
              <View style={styles.thumbSlot}>
                {step === 'front' && !draft.rescanRecordId ? (
                  <Pressable onPress={() => router.replace('/scan/upload')} hitSlop={8} style={styles.galleryBtn} accessibilityRole="button" accessibilityLabel="Use saved photos instead">
                    <Ionicons name="images-outline" size={22} color={colors.text} />
                  </Pressable>
                ) : step !== 'front' ? (
                  <Pressable onPress={skip} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Skip ${STEP_COPY[step].dot.toLowerCase()} photo`}>
                    <Text variant="caption" tone="muted" align="center">
                      Skip
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Row>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

/** A wide box for the barcode step; expo-camera scans the whole frame, the box just tells people where to aim. */
function BarcodeGuide({ screen }: { screen: { width: number; height: number } }) {
  const w = screen.width * 0.78;
  const h = w * 0.45;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.barcodeBox, { width: w, height: h, left: (screen.width - w) / 2, top: screen.height * 0.42 - h / 2 }]}>
        <View style={styles.scanLine} />
      </View>
    </View>
  );
}

function StepDots({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  return (
    <Row gap={6} style={styles.steps} accessibilityLabel={`Step ${idx + 1} of ${STEPS.length}: ${STEP_COPY[step].dot}`}>
      {STEPS.map((s, i) => (
        <Row key={s} gap={3}>
          <View style={[styles.stepDot, i < idx && { backgroundColor: colors.authentic }, i === idx && { backgroundColor: colors.gold }]} />
          {i === idx && (
            <Text variant="caption" style={{ fontSize: 12, fontWeight: '700' }}>
              {STEP_COPY[s].dot}
            </Text>
          )}
        </Row>
      ))}
    </Row>
  );
}

function PermissionGate({ canAsk, onAsk }: { canAsk: boolean; onAsk: () => void }) {
  return (
    <SafeAreaView style={[styles.black, { padding: spacing.xxl, justifyContent: 'center', gap: spacing.lg }]}>
      <Ionicons name="camera-outline" size={40} color={colors.gold} />
      <Text variant="title">Camera access needed</Text>
      <Text variant="body" tone="secondary">
        VinylVault photographs the covers, label and runout of your record and reads its barcode to identify the pressing, estimate condition and run the pressing checks.
      </Text>
      {canAsk ? <Button label="Allow camera" size="lg" onPress={onAsk} /> : <Button label="Open Settings" size="lg" onPress={() => Linking.openSettings()} />}
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  steps: { backgroundColor: colors.overlay, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill },
  stepDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
  heading: { position: 'absolute', left: spacing.xl, right: spacing.xl, gap: 2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing.lg, paddingBottom: spacing.lg },
  controls: { justifyContent: 'space-between', paddingHorizontal: spacing.xxl },
  thumbSlot: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  galleryBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
  thumb: { width: 50, height: 50, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.cream },
  barcodeBox: { position: 'absolute', borderWidth: 3, borderColor: colors.gold, borderRadius: radii.md, justifyContent: 'center' },
  scanLine: { height: 2, marginHorizontal: spacing.md, backgroundColor: colors.risk, opacity: 0.8 },
});
