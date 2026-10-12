import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessFrame, guideRectForScreen } from '../services/ondevice/framing';
import { edgeAlignment, glareRatio, laplacianVariance, toGray, type RGBAImage } from '../services/ondevice/imageStats';
import { extractHints, mergeHints } from '../services/ondevice/textHints';

function image(w: number, h: number, px: (x: number, y: number) => [number, number, number]): RGBAImage {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return { width: w, height: h, data };
}

describe('image statistics', () => {
  it('a sharp edge image has higher Laplacian variance than a flat one', () => {
    assert.equal(laplacianVariance(toGray(image(40, 40, () => [120, 120, 120]))), 0);
    assert.ok(laplacianVariance(toGray(image(40, 40, (x) => (x % 4 < 2 ? [0, 0, 0] : [255, 255, 255])))) > 1000);
  });

  it('detects glare share', () => {
    assert.ok(Math.abs(glareRatio(toGray(image(10, 10, (x) => (x < 3 ? [255, 255, 255] : [100, 100, 100])))) - 0.3) < 1e-9);
  });

  it('edge alignment is high when a square cover sits on the guide', () => {
    const cover = toGray(image(80, 80, (x, y) => (x >= 10 && x < 70 && y >= 10 && y < 70 ? [200, 60, 50] : [20, 22, 30])));
    const on = edgeAlignment(cover, { x: 10 / 80, y: 10 / 80, w: 60 / 80, h: 60 / 80 });
    const off = edgeAlignment(cover, { x: 0.35, y: 0.35, w: 0.3, h: 0.3 });
    assert.ok(on > 1.45, `on guide ${on}`);
    assert.ok(off < on);
  });
});

describe('framing', () => {
  const good = { meanLuma: 140, sharpness: 200, glareRatio: 0.01, edgeAlignment: 2, specularity: 0 };
  it('is ready only when every gate passes', () => {
    assert.equal(assessFrame(good, 'cover').state, 'ready');
    assert.equal(assessFrame({ ...good, meanLuma: 30 }).state, 'too_dark');
    assert.equal(assessFrame({ ...good, edgeAlignment: 1 }).state, 'searching');
    assert.equal(assessFrame({ ...good, glareRatio: 0.2 }).state, 'glare');
    assert.equal(assessFrame({ ...good, sharpness: 10 }).state, 'blurry');
  });

  it('does not require edges for the runout close-up', () => {
    assert.equal(assessFrame({ ...good, edgeAlignment: 1 }, 'runout').state, 'ready');
  });

  it('cover guides are square on screen', () => {
    const screen = { width: 400, height: 860 };
    const g = guideRectForScreen(screen, 'cover');
    assert.ok(Math.abs(g.w * screen.width - g.h * screen.height) < 1e-6);
    assert.ok(guideRectForScreen(screen, 'label').w < g.w);
  });
});

describe('label and sleeve text hints', () => {
  it('pulls catalog numbers, labels, countries, speed and channels from label text', () => {
    const h = extractHints('HARVEST  SHVL 804  STEREO  33 1/3 RPM  Side 1  ℗ 1973  Made in Gt. Britain  The Gramophone Co. Ltd  NCB');
    assert.deepEqual(h.catalogNumbers, ['SHVL 804']);
    assert.ok(h.labels.includes('harvest'));
    assert.deepEqual(h.countries, ['UK']);
    assert.deepEqual(h.speeds, [33]);
    assert.equal(h.channels, 'stereo');
    assert.deepEqual(h.years, [1973]);
  });

  it('handles US style numbers and ignores rights-society noise', () => {
    const h = extractHints('Harvest SMAS-11163 Printed in U.S.A. BMI 45 RPM');
    assert.ok(h.catalogNumbers.includes('SMAS-11163'));
    assert.ok(!h.catalogNumbers.some((c) => c.startsWith('RPM') || c.startsWith('BMI')));
    assert.deepEqual(h.countries, ['US']);
  });

  it('merges hints from label and back cover', () => {
    const m = mergeHints([extractHints('Apple PCS 7088 Made in England'), null, extractHints('Parlophone PCS 7088 mono')])!;
    assert.deepEqual(m.catalogNumbers, ['PCS 7088']);
    assert.ok(m.labels.includes('apple') && m.labels.includes('parlophone'));
    assert.equal(m.channels, 'mono');
    assert.equal(mergeHints([null, null]), null);
  });
});
