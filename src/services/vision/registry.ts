import { env } from '@/config';
import { MockVisionProvider } from './providers/mock';
import { ProxyVisionProvider } from './providers/proxy';
import type { VisionProvider } from './types';

let instance: VisionProvider | null = null;

export const usingServer = () => env.visionProvider === 'proxy' && Boolean(env.visionProxyUrl);

/** Single place that decides which vision backend the app talks to. */
export function getVisionProvider(): VisionProvider {
  if (instance) return instance;
  instance = usingServer() ? new ProxyVisionProvider(env.visionProxyUrl) : new MockVisionProvider();
  return instance;
}

/** For tests or a settings toggle. */
export function setVisionProvider(p: VisionProvider) {
  instance = p;
}
