/**
 * Pure, dependency-free image statistics computed on small downsampled RGBA
 * frames (≈64–96px wide). Fast enough to run on the JS thread every second
 * for live framing feedback, and deterministic so they can be unit-tested.
 */

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

export interface FrameStats {
  meanLuma: number; // 0–255
  sharpness: number; // variance of Laplacian
  glareRatio: number; // share of near-white pixels
  /** Edge energy on the guide rectangle border relative to the rest of the frame. */
  edgeAlignment: number;
  /** 0–1: how colorful / reflective the surface is; foil and refractors score higher. */
  specularity: number;
}

export function toGray(img: RGBAImage): GrayImage {
  const { width, height, data } = img;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return { width, height, data: out };
}

export function meanLuma(g: GrayImage): number {
  let s = 0;
  for (let i = 0; i < g.data.length; i++) s += g.data[i];
  return s / g.data.length;
}

/** Variance of the 4-neighbour Laplacian — the classic focus/blur measure. */
export function laplacianVariance(g: GrayImage): number {
  const { width: w, height: h, data } = g;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function glareRatio(g: GrayImage, threshold = 245): number {
  let c = 0;
  for (let i = 0; i < g.data.length; i++) if (g.data[i] >= threshold) c++;
  return c / g.data.length;
}

function gradientMagnitude(g: GrayImage): Float32Array {
  const { width: w, height: h, data } = g;
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = data[i + 1] - data[i - 1];
      const gy = data[i + w] - data[i - w];
      out[i] = Math.abs(gx) + Math.abs(gy);
    }
  }
  return out;
}

/**
 * Guide rectangle in normalized coordinates. Must match the on-screen framing
 * overlay (standard card ratio 2.5 × 3.5 centered in the preview).
 */
export interface GuideRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Ratio of gradient energy in a thin band along the guide rectangle's edges
 * to the mean gradient energy elsewhere. >1.6 typically means a card edge is
 * sitting on the guide; ~1 means no card or a badly misaligned one.
 */
export function edgeAlignment(g: GrayImage, rect: GuideRect, band = 0.035): number {
  const grad = gradientMagnitude(g);
  const { width: w, height: h } = g;
  const x0 = rect.x * w, x1 = (rect.x + rect.w) * w;
  const y0 = rect.y * h, y1 = (rect.y + rect.h) * h;
  const bw = band * w, bh = band * h;
  let edgeSum = 0, edgeN = 0, restSum = 0, restN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = grad[y * w + x];
      const insideOuter = x >= x0 - bw && x <= x1 + bw && y >= y0 - bh && y <= y1 + bh;
      const insideInner = x > x0 + bw && x < x1 - bw && y > y0 + bh && y < y1 - bh;
      if (insideOuter && !insideInner) {
        edgeSum += v;
        edgeN++;
      } else {
        restSum += v;
        restN++;
      }
    }
  }
  const edgeMean = edgeN ? edgeSum / edgeN : 0;
  const restMean = restN ? restSum / restN : 0;
  return restMean > 0.5 ? edgeMean / restMean : edgeMean > 4 ? 3 : 1;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max === 0 ? 0 : d / max, max];
}

/** Share of pixels that are both bright and saturated — a cheap foil/refractor hint. */
export function specularity(img: RGBAImage): number {
  let c = 0;
  const n = img.width * img.height;
  for (let p = 0; p < n * 4; p += 4) {
    const [, s, v] = rgbToHsv(img.data[p], img.data[p + 1], img.data[p + 2]);
    if (v > 0.8 && s > 0.35) c++;
  }
  return c / n;
}

export interface RegionGrid {
  cols: number;
  rows: number;
  luma: Float32Array;
  /** Mean hue as unit vector components, so hues average correctly around 0/360. */
  hueX: Float32Array;
  hueY: Float32Array;
  saturation: Float32Array;
}

export function regionGrid(img: RGBAImage, cols = 8, rows = 11): RegionGrid {
  const n = cols * rows;
  const luma = new Float32Array(n), hueX = new Float32Array(n), hueY = new Float32Array(n), sat = new Float32Array(n);
  const counts = new Float32Array(n);
  for (let y = 0; y < img.height; y++) {
    const r = Math.min(rows - 1, Math.floor((y / img.height) * rows));
    for (let x = 0; x < img.width; x++) {
      const c = Math.min(cols - 1, Math.floor((x / img.width) * cols));
      const p = (y * img.width + x) * 4;
      const R = img.data[p], G = img.data[p + 1], B = img.data[p + 2];
      const [h, s] = rgbToHsv(R, G, B);
      const k = r * cols + c;
      luma[k] += 0.299 * R + 0.587 * G + 0.114 * B;
      const rad = (h * Math.PI) / 180;
      hueX[k] += Math.cos(rad) * s;
      hueY[k] += Math.sin(rad) * s;
      sat[k] += s;
      counts[k]++;
    }
  }
  for (let k = 0; k < n; k++) {
    const d = counts[k] || 1;
    luma[k] /= d; hueX[k] /= d; hueY[k] /= d; sat[k] /= d;
  }
  return { cols, rows, luma, hueX, hueY, saturation: sat };
}

/**
 * Estimate left/right and top/bottom border widths on a card-cropped image by
 * walking inward from each edge until the gradient spikes (the inner frame
 * line). Returns centering as the larger share, e.g. 0.55 → "55/45".
 */
export function estimateCentering(g: GrayImage, threshold = 28): { lr: number; tb: number } | null {
  const { width: w, height: h, data } = g;
  const scanRow = (y: number, fromLeft: boolean) => {
    const start = Math.floor(w * 0.02);
    for (let k = start; k < w * 0.3; k++) {
      const x = fromLeft ? k : w - 1 - k;
      const nx = fromLeft ? x + 1 : x - 1;
      if (Math.abs(data[y * w + nx] - data[y * w + x]) > threshold) return k;
    }
    return -1;
  };
  const scanCol = (x: number, fromTop: boolean) => {
    const start = Math.floor(h * 0.02);
    for (let k = start; k < h * 0.3; k++) {
      const y = fromTop ? k : h - 1 - k;
      const ny = fromTop ? y + 1 : y - 1;
      if (Math.abs(data[ny * w + x] - data[y * w + x]) > threshold) return k;
    }
    return -1;
  };
  const median = (xs: number[]) => {
    const v = xs.filter((x) => x > 0).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : -1;
  };
  const rowsIdx = [0.35, 0.45, 0.5, 0.55, 0.65].map((f) => Math.floor(f * h));
  const colsIdx = [0.35, 0.45, 0.5, 0.55, 0.65].map((f) => Math.floor(f * w));
  const L = median(rowsIdx.map((y) => scanRow(y, true)));
  const R = median(rowsIdx.map((y) => scanRow(y, false)));
  const T = median(colsIdx.map((x) => scanCol(x, true)));
  const B = median(colsIdx.map((x) => scanCol(x, false)));
  if (L < 0 || R < 0 || T < 0 || B < 0) return null;
  return { lr: Math.max(L, R) / (L + R), tb: Math.max(T, B) / (T + B) };
}

export function centeringRatio(share: number): string {
  const big = Math.round(share * 100);
  return `${big}/${100 - big}`;
}

export function frameStats(img: RGBAImage, rect: GuideRect): FrameStats {
  const g = toGray(img);
  return {
    meanLuma: meanLuma(g),
    sharpness: laplacianVariance(g),
    glareRatio: glareRatio(g),
    edgeAlignment: edgeAlignment(g, rect),
    specularity: specularity(img),
  };
}
