# VinylVault

Vinyl record scanner and collection app for iOS and Android (Expo SDK 57, React Native 0.86, expo-router). It is the sister app to CardVault and reuses its architecture, design system and server pattern. The two projects are kept separate.

Photograph the front cover, back cover and center label, and optionally the runout etching and the barcode. VinylVault suggests the top 2–3 candidate pressings with confidence scores. It grades the vinyl and the sleeve separately on the Goldmine scale and runs eight pressing checks. The verdict (**Likely Original Pressing / Reissue / Needs Review / Possible Bootleg**) is computed on-device from those checks with fixed rules, so the headline always agrees with the explanations beneath it. Value is always a low/average/high range.

No result is presented as certain. Every result shows confidence scores and the note in `RESULT_DISCLAIMER` (`src/config/index.ts`). Condition grades carry `AUDIO_CAVEAT`, because photos can't reveal how a record sounds.

## Run it

```bash
npm install
npm test                 # unit tests: verdict rules, merge, parsing, grading/value ranges, filters, text hints
npm run typecheck
npx expo start --go --port 8083   # Expo Go (mock model, simulated store). CardVault uses 8081.
```

On Windows, `scripts\start-phone.cmd` and `scripts\start-server.cmd` do the same with `npm.cmd`/`npx.cmd`. In Expo Go on Android, use **Enter URL manually** → `exp://192.168.4.73:8083`.

OCR (ML Kit) and real purchases (RevenueCat) need a development or release build. `scripts\build-android.cmd` builds a release APK locally. It runs `expo prebuild`, applies `scripts/patch-android.js` (low-memory Gradle settings, arm64 only, lint vital skipped, CMake 3.31.6 for Windows long paths) and installs over USB if a phone is attached.

Copy `.env.example` to `.env` to switch the vision backend and set RevenueCat keys.

### Server (vision + Discogs)

```bash
cd server && npm install
npm start                # http://0.0.0.0:8788, reads server/.env
```

`server/.env` holds `ANTHROPIC_API_KEY` and, optionally, `DISCOGS_TOKEN`. Then set `EXPO_PUBLIC_VISION_PROVIDER=proxy` and `EXPO_PUBLIC_VISION_PROXY_URL=http://<LAN IP>:8788` in the app's `.env`.

- `POST /v1/analyze` sends the photos and on-device hints to Claude (`claude-opus-5-5`, override with `VISION_MODEL`). It uses strict JSON-schema output (`server/src/schema.ts`), effort `high` and server-side refusal fallbacks (`fallbacks: "default"`). With a Discogs token, each candidate is looked up on Discogs, which adds a release link and ID.
- `GET /v1/price` returns Discogs price suggestions by grade, plus the lowest current listing and the number for sale.
- `GET /health` reports the model and whether a Discogs token is configured. The Profile tab shows this.

## Discogs

- **Auth:** a personal access token from discogs.com/settings/developers. It stays on the server and is never put in the app.
- **Rate limit:** 60 authenticated requests a minute. The client queues requests about 1.1 s apart, retries a 429 once after `Retry-After`, and caches responses for at most 6 hours.
- **Price suggestions:** these need the token owner's Discogs **seller settings** filled in, and they come back in that account's selling currency. Without seller settings, only marketplace stats (the lowest listing) are available.
- **No individual sales:** the API doesn't return them. For Discogs prices the app says so plainly and links to the release's public sales-history page. It never invents sales. Demo prices include demo sales, clearly labelled as demo.
- **Attribution:** "Data provided by Discogs." is shown next to Discogs data (`DISCOGS_ATTRIBUTION`).
- **Before launch:** read the Discogs API Terms of Use, especially the restricted-data, commercial-use and caching sections, before charging for an app that shows Discogs data.

## Architecture

```
app/                       expo-router screens
  onboarding.tsx           What it does, photo tips, free vs premium with exact prices
  (tabs)/index.tsx         Home: scan, check from photos, collection value range, recent scans
  (tabs)/collection.tsx    Search, filters (artist, genre, pressing, format, decade, value, grade), folders/tags, grid/list, CSV/PDF export
  (tabs)/profile.tsx       Plan, server/Discogs status, report a result, support, dev tools
  scan/index.tsx           Camera: front → back → label → runout (optional) → barcode (optional), live on-device feedback
  scan/upload.tsx          Same analysis from saved photos (e.g. a seller's listing)
  scan/processing.tsx      Staged pipeline progress, offline/timeout/error states
  scan/result.tsx          Pressing match, verdict + check confidence, checks, text read, alternates, grades, value
  record/[id].tsx          Detail, notes, tags, re-check, delete
  paywall.tsx · report.tsx
src/
  services/ondevice/       Image stats, framing (cover/label/runout guides), live framing, OCR + label text hints, precheck
  services/vision/         Provider interface, mock + proxy providers, parse, merge, verdict, pipeline
  services/pricing/        Price provider (server/Discogs with demo fallback) + cache
  services/subscriptions/  RevenueCat wrapper with a simulated store fallback (from CardVault)
  utils/grading.ts         Goldmine scale, Discogs grade names, value factors, range for media + sleeve
  components/ui            CardVault design system: Text, Button, Surface, Chip, VerdictBadge, ConfidenceMeter, ReviewNote, PriceRange…
  components/record        Sleeve art, list rows, check list, condition / value / match panels
  data/                    Demo catalog of pressings, generators, sample collection
server/                    Vision + pricing proxy (Node 22.18+, official Anthropic SDK)
```

### Hybrid pipeline (`src/services/vision/pipeline.ts`)

1. **On-device pre-check:** photo quality gates; OCR of the label and back cover (catalog numbers, label names, "Made in …", stereo/mono); the barcode read by expo-camera, or the collector confirming there is none.
2. **Cloud vision:** up to 3 candidate pressings with confidence, media and sleeve grades with visible issues, evidence for each check, and the text actually read.
3. **On-device merge** (`merge.ts`): a missing label, back or runout photo makes those checks "skipped", never passed. A barcode on an original pressed before 1975 fails `barcode_era`. A scanned barcode is matched against the pressing's listed barcode. A soft cover photo downgrades a cover-print pass.
4. **Verdict rules** (`verdict.ts`):
   - 2+ fails, or a fail at ≥70% confidence on a major check (runout, label print, catalog consistency, bootleg markers) → Possible Bootleg.
   - 1 fail, 2+ uncertain checks, nothing assessable, or an unknown pressing → Needs Review.
   - Otherwise the matched pressing decides: Reissue, or Likely Original Pressing. There is deliberately no "confirmed original".
5. **Value** (`utils/grading.ts`): the average is the suggestion for the media grade; low and high are the neighbouring grades. The sleeve grade scales the whole range.

Picking a different candidate on the result screen re-runs the merge and verdict locally and reprices immediately. "Re-run all checks" sends the photos again with the confirmed pressing.

## Free vs Premium

| | Free | Premium ($9.99/mo · $59.99/yr · 7-day trial) |
|---|---|---|
| Scans | 12/day (only successful scans count) | Unlimited |
| Collection | 75 records (sample records don't count) | Unlimited |
| Verdict + one-line explanation per check | ✓ | ✓ |
| Media & sleeve grades, value range | ✓ | ✓ |
| Evidence and confidence per check | – | ✓ |
| Value at every grade, folders/tags, decade/value/grade filters, export, priority support | – | ✓ |

## Before launch

- **Accuracy claims:** no accuracy guarantees anywhere. Keep marketing copy consistent with `RESULT_DISCLAIMER` and `AUDIO_CAVEAT`.
- **Calibrate:** tune `FRAMING_THRESHOLDS` and `BARCODE_ERA_START` on real captures of originals, reissues and known bootlegs.
- **Server hardening:** app attestation, per-user rate limits (enforce plan limits on the server too), no image logging.
- **Discogs terms:** see above. Recent sales with dates need another licensed source.
- **Live framing** samples a still about once a second (expo-camera has no frame processors). Move to react-native-vision-camera for 15+ fps analysis.
- **Reports** are stored locally. Send them, with photos, to your support backend.
