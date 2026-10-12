import type { CameraView } from 'expo-camera';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { assessFrame, type FramingFeedback, type GuideShape } from './framing';
import { frameStats, type FrameStats, type GuideRect } from './imageStats';
import { loadSmallRGBA, screenRectToPhoto } from './sampler';

export interface LiveFraming {
  feedback: FramingFeedback;
  stats: FrameStats | null;
}

/**
 * Samples a low-quality still roughly once a second and runs the on-device
 * framing analysis. expo-camera has no frame-processor API; for 15+ fps
 * analysis swap this for react-native-vision-camera frame processors.
 */
export function useLiveFraming(
  cameraRef: RefObject<CameraView | null>,
  opts: { enabled: boolean; guide: GuideRect; shape: GuideShape; screen: { width: number; height: number } },
): LiveFraming {
  const [stats, setStats] = useState<FrameStats | null>(null);
  const busy = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    setStats(null);
  }, [opts.shape]);

  useEffect(() => {
    if (!opts.enabled) return;
    let alive = true;
    const tick = async () => {
      const cam = cameraRef.current;
      if (!alive || busy.current || !cam) return;
      busy.current = true;
      try {
        const pic = await cam.takePictureAsync({ quality: 0.1, skipProcessing: true, shutterSound: false });
        if (!pic || !alive) return;
        const img = await loadSmallRGBA(pic.uri, 72);
        const rect = screenRectToPhoto(optsRef.current.guide, optsRef.current.screen, { width: pic.width, height: pic.height });
        if (alive) setStats(frameStats(img, rect));
      } catch {
        // Camera busy (e.g. mid-capture), so skip this tick.
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(tick, 1100);
    const first = setTimeout(tick, 600);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(first);
    };
  }, [cameraRef, opts.enabled]);

  const feedback: FramingFeedback = stats
    ? assessFrame(stats, opts.shape)
    : { state: 'searching', message: opts.shape === 'label' ? 'Center the label in the circle' : opts.shape === 'runout' ? 'Fill the frame with the dead wax' : 'Place the whole cover inside the frame', quality: 0.1 };
  return { feedback, stats };
}
