import { Alert } from 'react-native';

/**
 * In a release build, a fatal JavaScript error closes the app without saying
 * why, and the iPhone crash log doesn't record the message. Show the error
 * instead, so a tester can screenshot it and send it to support. Imported
 * first in app/_layout.tsx so it is installed before the rest of the app loads.
 */
type Handler = (error: unknown, isFatal?: boolean) => void;
const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void } }).ErrorUtils;

export function describeError(error: unknown): string {
  const e = error as { name?: string; message?: string; stack?: string } | undefined;
  const stack = (e?.stack ?? '').split('\n').slice(1, 6).join('\n');
  return `${e?.name ?? 'Error'}: ${e?.message ?? String(error)}${stack ? `\n\n${stack}` : ''}`;
}

if (errorUtils && !__DEV__) {
  const previous = errorUtils.getGlobalHandler();
  let shown = false;
  errorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return previous(error, isFatal);
    if (shown) return;
    shown = true;
    setTimeout(() => Alert.alert('VinylVault hit a problem', `Please screenshot this and send it to support.\n\n${describeError(error)}`), 0);
  });
}
