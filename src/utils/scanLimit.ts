import { router } from 'expo-router';
import { Alert } from 'react-native';
import { FREE_DAILY_SCANS, FREE_LAUNCH } from '@/config';

/** Called when today's scans are used up: the paywall normally, a plain notice during the free launch. */
export function showScanLimit() {
  if (FREE_LAUNCH) {
    Alert.alert('Daily scans used', `VinylVault is free while it's new, with ${FREE_DAILY_SCANS} scans a day. They reset at midnight.`);
    return;
  }
  router.push({ pathname: '/paywall', params: { reason: 'scans' } });
}
