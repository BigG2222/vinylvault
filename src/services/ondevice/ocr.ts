import { NativeModules } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { extractHints } from './textHints';
import type { OcrHints } from './types';

export { extractHints };

/** ML Kit is only linked in a development/production build, not Expo Go. */
export const isOcrAvailable = () => Boolean(NativeModules.TextRecognition);

export async function recognizeText(uri: string): Promise<OcrHints | null> {
  if (!isOcrAvailable()) return null;
  try {
    const result = await TextRecognition.recognize(uri);
    return extractHints(result.text);
  } catch {
    return null;
  }
}
