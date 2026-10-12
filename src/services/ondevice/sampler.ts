import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';
import type { GuideRect, RGBAImage } from './imageStats';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (clean[i + 2]) out[o++] = (n >> 8) & 255;
    if (clean[i + 3]) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/** Downsample an image and decode it to raw RGBA for the on-device statistics. */
export async function loadSmallRGBA(uri: string, width = 72): Promise<RGBAImage> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!out.base64) throw new Error('Downsample produced no data');
  const decoded = jpeg.decode(base64ToBytes(out.base64), { useTArray: true, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}

/**
 * Map the on-screen guide rectangle onto photo pixel space, assuming the
 * camera preview uses "cover" scaling (what CameraView does by default).
 */
export function screenRectToPhoto(
  guide: GuideRect,
  screen: { width: number; height: number },
  photo: { width: number; height: number },
): GuideRect {
  const scale = Math.max(screen.width / photo.width, screen.height / photo.height);
  const visibleW = screen.width / scale;
  const visibleH = screen.height / scale;
  const offX = (photo.width - visibleW) / 2;
  const offY = (photo.height - visibleH) / 2;
  return {
    x: (offX + guide.x * visibleW) / photo.width,
    y: (offY + guide.y * visibleH) / photo.height,
    w: (guide.w * visibleW) / photo.width,
    h: (guide.h * visibleH) / photo.height,
  };
}

/** Crop a captured photo down to the card area (with a small safety margin). */
export async function cropToGuide(uri: string, photo: { width: number; height: number }, rect: GuideRect, margin = 0.04) {
  const x = Math.max(0, (rect.x - margin * rect.w) * photo.width);
  const y = Math.max(0, (rect.y - margin * rect.h) * photo.height);
  const w = Math.min(photo.width - x, rect.w * (1 + 2 * margin) * photo.width);
  const h = Math.min(photo.height - y, rect.h * (1 + 2 * margin) * photo.height);
  const ctx = ImageManipulator.manipulate(uri);
  ctx.crop({ originX: Math.round(x), originY: Math.round(y), width: Math.round(w), height: Math.round(h) });
  ctx.resize({ width: Math.min(1600, Math.round(w)) });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return out.uri;
}

/** Prepare an image for upload: bounded size, JPEG, base64. */
export async function toUploadBase64(uri: string, maxWidth = 1280): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: maxWidth });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!out.base64) throw new Error('Could not encode image for upload');
  return out.base64;
}
