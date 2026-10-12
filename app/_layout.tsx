import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, UIManager, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureSubscriptions, getSubscriptionState } from '@/services/subscriptions';
import { setMockScenario } from '@/services/vision/providers/mock';
import { useApp } from '@/store';
import { colors } from '@/theme';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

export default function RootLayout() {
  const hydrated = useApp((s) => s.hydrated);
  const setSubscription = useApp((s) => s.setSubscription);
  const demoScenario = useApp((s) => s.prefs.demoScenario);

  useEffect(() => {
    configureSubscriptions(setSubscription);
    getSubscriptionState()
      .then(setSubscription)
      .catch(() => {});
  }, [setSubscription]);

  useEffect(() => setMockScenario(demoScenario), [demoScenario]);

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan/index" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="scan/upload" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan/processing" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="scan/result" options={{ headerShown: true, title: 'Result', headerBackTitle: 'Home' }} />
        <Stack.Screen name="record/[id]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
