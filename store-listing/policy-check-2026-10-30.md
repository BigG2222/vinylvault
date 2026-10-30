# VinylVault policy check, 30 Oct 2026 (before submitting versionCode 5 to closed testing)

Builds on the full audit in `policy-check-2026-10-28.md` (Google Developer Program Policies and Apple Guidelines fetched 28 Oct). Google's policy update email of 29 Oct 2026 was read: its new and changed rules (local network, contacts, AppFunctions, eligibility-based subscription discounts, location, all-files access, SMS/call log, crypto) don't apply to VinylVault.

What goes to Google in this submission: release 5 (1.0.0), new short and full description, 4 new phone screenshots, Data safety change (Photos not processed ephemerally).

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | Misleading claims (Deceptive Behaviour) | PASS | The app never invents prices: when Discogs has none it says "No price available" (commit 4f9f8be, 64 tests). The listing says "price suggestions from Discogs" and "AI estimate from photos, not proof of authenticity". Store description and app match. |
| 2 | Screenshots: trademarks and real people (Metadata / IP) | PASS | New screenshots use made-up artists, albums, labels and catalogue numbers (`scripts/store-screenshots.mjs`, checked visually, and the saved Play images were downloaded and checked). Cover art is drawn by code. Sample prices are labelled "Example value (sample records)", "not market data", "SAMPLE". |
| 3 | AI-generated content: in-app reporting | PASS | "This looks wrong" report on every result, sent to the server (`app/report.tsx`). |
| 4 | User data: consent before sending photos to a third-party AI | PASS | `AiConsent.tsx` names Claude by Anthropic and the 30-day retention; the Profile → Privacy switch withdraws consent. |
| 5 | Data safety matches the app and the privacy page | PASS | Console after today's edit: Photos (collected, not ephemeral, required, App functionality), Other user-generated content (optional, App functionality + Analytics), Device or other IDs (App functionality + Fraud prevention); nothing shared; encrypted in transit; deleted automatically. The live privacy page (checked today) gives the 30-day retention for photos at Anthropic and for reports. |
| 6 | Paywall / payments | PASS | Free launch: `/paywall` redirects home and release builds can't grant Premium. The listing says "Every feature is included, with 10 scans a day". The build carries `com.android.vending.BILLING` (RevenueCat SDK), as approved builds 2–4 did; no purchase is offered. |
| 7 | Permissions | PASS | Merged release manifest: CAMERA, INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING. No location, contacts, microphone, storage or AD_ID. |
| 8 | Third-party data terms (Discogs) | PASS | Not-affiliated notice and trademark line in the listing; prices expire after 6 hours (`expireOldPrices`). |
| 9 | Terms and privacy links | PASS | https://vinylvault-vision.onrender.com/terms and /privacy return 200 (checked 30 Oct). |
| 10 | Policy status | PASS | Play Console Policy status: no issues for the account or the app (30 Oct). |

No fails. Waiting for the owner's OK before "Send changes for review".
