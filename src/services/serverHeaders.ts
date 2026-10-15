import { env } from '@/config';

let deviceId = '';

/** The store calls this once it has loaded (or created) the install's device ID. */
export function setDeviceId(id: string) {
  deviceId = id;
}

/**
 * Sent with every request to the VinylVault server. The device ID lets the
 * server apply per-install daily limits; the app key keeps casual traffic off
 * the server. Neither is a secret in the strong sense: both ship in the app.
 */
export function serverHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (deviceId) headers['X-Device-Id'] = deviceId;
  if (env.appKey) headers['X-App-Key'] = env.appKey;
  return headers;
}
