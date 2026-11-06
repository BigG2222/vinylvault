# VinylVault policy check, 6 Nov 2026 (before the first production release on Google Play)

Builds on `policy-check-2026-11-03.md`. Google granted production access (email of 5 Nov). This check covers publishing versionCode 7 to production. Nothing has been sent to Google yet.

Read today:
- Policy Center overview: latest update 29 Oct 2026, nothing newer.
- Recent updates (answer/18100766, 29 Oct 2026).
- Intellectual Property (answer/9888072).
- Deceptive Behavior and Misrepresentation (answer/9888077).
- Metadata (answer/9898842).
- AI-Generated Content (answer/13985936).
- A Play search for "vinyl vault" (GB) and a web search for "Vinyl Vault" trademarks.
- Discogs developer terms: returned 403 today. The full read on 3 Nov (terms last updated 27 May 2025) is used.

Apple isn't part of this check: no iOS submission is planned.

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | Owner's rule: no demo or placeholder data | PASS | Fixed in versionCode 6. Release builds start empty, and old sample records are removed on update. Tests cover it (`samples.test.ts`). |
| 2 | Discogs: Restricted Data must not pass to third parties; no display after 6 hours | **PASS (fixed 6 Nov, versionCode 7)** | Was a risk: CSV and PDF exports carried Discogs prices in files the user can keep and share. Now exports list records, grades and Discogs links only (`src/services/export/format.ts`). The export menu says "Prices aren't included". Test `export.test.ts` checks that no price, currency or total appears in either file. In-app prices still refresh after 6 hours. |
| 3 | Discogs: non-commercial, personal licence | PASS for a free launch; **owner's rule before charging** | App is free, with no ads and nothing sold (`FREE_LAUNCH = true`). The listing's "FREE WHILE IT'S NEW" hints at charging later: before any paid tier, get written permission from Discogs, or charging must not depend on Discogs data. |
| 4 | Discogs: attribution and name use | PASS | "Data provided by Discogs" with link, and a not-affiliated notice. "Discogs" isn't in the app name. |
| 5 | Intellectual Property: trademarks (confusingly similar names) | **PASS (renamed 6 Nov to Labelsight)** | VinylVault was a risk. Play shows "Vinyl Vault" by Morfords (also a record app) and other "...Vinyl Vault" apps, and US "VINYL VAULT" marks exist for record holders. The owner chose **Labelsight** ("Labelsight: Record Scanner"). On 6 Nov a Play search for "labelsight" (GB) gave "No results", and a web search found no business, product or app with the name. Other names were rejected because they were taken: RunOut for Discogs, Deadwax, and Sleevewise (an iPhone vinyl app). This isn't a full legal trademark search. Only names users see changed. The package `com.vinylvault.app`, the server address and the saved-data keys stay, so collections survive the update. The Discogs User-Agent is unchanged. |
| 6 | Impersonation and Misrepresentation | PASS | No claim to be official or linked to Discogs or any other brand. No competitor names. |
| 7 | Metadata: title 30 characters or less, no ranking or price claims, screenshots reflect the app | PASS | "Labelsight: Record Scanner" is 26 characters. The 4 screenshots and the feature graphic were remade on 6 Nov with the new name. The icon has no name on it. The screenshots show the real app with example records, and the description says "Screenshots show example data". The listing doesn't claim prices in exports. |
| 8 | Hidden or dormant features | RISK (low), unchanged | The paywall code ships switched off by a fixed value. It can't be turned on without a new build (no remote config or OTA updates). |
| 9 | AI-generated content: in-app reporting | PASS | "This looks wrong" on every result, including "offensive or harmful". |
| 10 | User data: consent, privacy policy, Data safety | PASS | AI permission screen names Anthropic before the first photo. Exports stay on the phone and send nothing new, so Data safety is unchanged. |
| 11 | Permissions | PASS | versionCode 7 merged release manifest (rebuilt 6 Nov after the rename): CAMERA, INTERNET, VIBRATE, ACCESS_NETWORK_STATE, BILLING and the app-internal receiver permission, same as versionCode 6. None of the 29 Oct permission changes (local network, contacts, location, SMS or call log) apply. |
| 12 | Payments and subscriptions | PASS | Nothing sold. The 29 Oct eligibility-discount and Japan payment rules don't apply. |
| 13 | Functionality and stability | PASS, limited evidence | 68 of 68 tests pass, and type checks are clean. **Not yet tested on a phone (v6 or v7).** |
| 14 | Testing and production access | PASS | Production access granted (Google Play Support email, 5 Nov). |
| 15 | Trader status (EU DSA; declared in Play Console from Nov 2026) | **OPEN, owner's decision** | Deadline for existing accounts: 1 Feb 2027. Not required to publish today. It's one decision for the whole account, and NearAid and Halo earn money. |
| 16 | Policy status | PASS | Account and VinylVault clean on 6 Nov. |

## Before pressing "Send for review" on production

1. Done: name chosen (Labelsight). The live /privacy, /terms and /support pages still say VinylVault until the server is redeployed: push to GitHub, then Render deploys (or Manual Deploy). The store listing name and description change in Play Console (Main store listing), along with the new screenshots and feature graphic.
2. Owner tests on the phone. The suggested route is to put versionCode 7 on the closed test (Alpha) first, update from the Play Store, then scan a record and export a CSV.
3. Done: versionCode 7 manifest checked (row 11).
4. Owner gives OK on this check and on the production release (countries, notes).

## Result

No fails. Rows 2 and 5 were fixed in versionCode 7 (no prices in exports, new name). Open: trader status (row 15, owner's decision, not needed to publish), the phone test (row 13), the server redeploy, and the listing update.
