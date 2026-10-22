// Takes store phone screenshots (Google Play 1080 × 1920, or App Store 1320 × 2868 with IOS=1) of the web build with headless Chrome.
// Usage: start `npx expo start --web --port 8082`, then `node scripts/store-screenshots.mjs`.
// Talks to Chrome over the DevTools protocol directly, so it needs no extra packages (Node 22+).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.APP_URL ?? 'http://localhost:8082';
// IOS=1 makes App Store 6.9-inch shots (1320 × 2868) into store-listing/app-store/.
const IOS = process.env.IOS === '1';
const OUT = new URL(IOS ? '../store-listing/app-store/' : '../store-listing/', import.meta.url);
const VIEW = IOS ? { width: 440, height: 956 } : { width: 360, height: 640 };
const PORT = 9333;
const SHOTS = [
  ['screenshot-1-home.png', '/'],
  ['screenshot-2-result.png', '/scan/result?id=scan_sample_pink-floyd-dsotm-uk-1973'],
  ['screenshot-3-collection.png', '/collection'],
  ['screenshot-4-record.png', '/record/sample_lee-morgan-sidewinder-1964'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vv-shots-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => undefined);
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then((r) => r.result.value);
  const clickText = (label) =>
    evaluate(`(() => { const b = [...document.querySelectorAll('[role=button]')].find(e => e.innerText.trim() === ${JSON.stringify(label)}); if (b) b.click(); return !!b; })()`);

  await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 3, mobile: true });
  await send('Page.navigate', { url: BASE });
  // First run: finish onboarding so the sample collection is loaded. The first web bundle can take a while.
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (await clickText('Start scanning free')) {
      await sleep(2500);
      break;
    }
    await clickText('Skip');
  }

  for (const [file, path] of SHOTS) {
    await send('Page.navigate', { url: BASE + path });
    await sleep(5000);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(new URL(file, OUT), Buffer.from(data, 'base64'));
    console.log('saved', file);
  }
  ws.close();
} finally {
  chrome.kill();
}
