# VinylVault policy check, 3 Nov 2026 (before applying for production on Google Play)

Builds on `policy-check-2026-10-28.md` and `policy-check-2026-10-30.md`. Applying sends answers to Google and doesn't publish the app. Publishing to production is a separate step that needs its own check.

Read today:
- Google Developer Policy Center overview (policy update of 29 Oct 2026)
- Testing requirements (answer/14151465)
- Deceptive Behavior (answer/9888077)
- AI-Generated Content (answer/13985936)
- Intellectual Property (answer/9888072)
- User Data (answer/9888076)
- Trader status declaration (answer/17594752, search summary only, page not opened)
- Discogs API Terms of Use (last updated 27 May 2025) and Application Name and Description Policy. This is the first full read of the Discogs terms: they returned 403 on 28 Oct.

Apple isn't part of this check: no iOS submission is planned.

| # | Rule | Result | Evidence |
|---|---|---|---|
| 1 | Owner's store rule: no demo or placeholder data in store builds | PASS (fixed 3 Nov, versionCode 6) | Was a fail: every new user got sample records with real artists, example prices and example recent sales. Now `completeOnboarding` (`src/store/index.ts`) adds them only in development, and `withoutSamples` removes saved ones when an older install updates. Tested in a production-mode web preview: first run has 0 records and 0 scans; an injected old sample was removed on reload. Not yet tested on a phone. |
| 1a | Store listing accuracy: screenshots | PASS | The 4 screenshots show made-up example records, which the app no longer adds. The full description now ends "Screenshots show example data." Changing it is part of this submission. |
| 1b | Misleading claims: first-run text | PASS (fixed 3 Nov) | The last intro page said "Upgrade anytime from Profile" although nothing is on sale. It now appears only if subscriptions are switched on (`app/onboarding.tsx`). |
| 2 | Testing requirement: 12 testers, 14 days | PASS | Play Console dashboard 3 Nov: all 3 ticks, "Apply for production" available. Testers Community dashboard: day 15 of 16. |
| 3 | Manipulating the review process: don't mislead reviewers | PASS if the answers below are used | Testers Community's pre-filled answers claim things that didn't happen, so they aren't used. Google's form asks directly about "a paid testing provider", so saying so is expected. |
| 4 | Tester engagement | **RISK** | Google's numbers, last 28 days: 18 device acquisitions, 8 first opens, 14 monthly active devices. Testing feedback page is empty. Google may ask for more testing, but it treats that as continued testing. |
| 5 | Name and impersonation (Google IP and Deceptive Behavior; owner's rule on competitor names) | **RISK** | "Vinyl Vault" by Morfords Entertainment (`com.morfords.vinylvault`, 1+ downloads, updated 4 Jun 2026) also scans record labels. Others on Play: Vinyl Record Vault, Vinylx Record Vault, Groovex Vinyl Vault, Vylara Vinyl Vault. Names weren't copied, and no trademark search has been done. A store name can change before production. |
| 6 | Discogs: Restricted Data, no commercial use; licence is "limited, personal" | **RISK** | Price suggestions are Marketplace Data. The app is free with no ads, so no commercial use today, but "FREE WHILE IT'S NEW" signals a future charge. All users see suggestions from one personal token. `discogs-permission-request.md` has no sign of being sent (no Discogs reply in Gmail; the Help Center can't be checked from here). |
| 7 | Discogs: no display after 6 hours; no transfer to third parties | **RISK** | App screens obey the limit. CSV and PDF exports keep Discogs prices with an "as of" time in a file the user can keep and share (`src/services/export/index.ts`). |
| 8 | Discogs: required notices and name use | PASS | "Data provided by Discogs." with link; not-affiliated notice in the listing, app and privacy page. "Discogs" isn't in the app name. |
| 9 | Dormant features (Deceptive Behavior) | **RISK (low)** | The paywall code and RevenueCat SDK ship in the build (BILLING permission), switched off by a fixed value, `FREE_LAUNCH = true` (`src/config/index.ts:11`), with empty RevenueCat keys in `.env`. It can't be turned on remotely, only by a new build. No expo-updates or remote config found. |
| 10 | AI-generated content: in-app reporting | PASS | "This looks wrong" on every result, inside the app (`app/report.tsx`), including an "offensive or harmful" reason. Reports go to Render logs, which weren't readable today (signed out), so nobody has confirmed reading them. |
| 11 | User data: consent, privacy policy, Data safety | PASS | `AiConsent.tsx` asks before the first photo and names Anthropic; Profile can withdraw. Live /privacy read today: matches the listing's Data safety table. Console form itself last checked 30 Oct, unchanged since. |
| 12 | Account deletion | N/A | No accounts. |
| 13 | Permissions | PASS | Merged release manifest for versionCode 6: CAMERA, INTERNET, VIBRATE, ACCESS_NETWORK_STATE, BILLING and the app-internal receiver permission. |
| 14 | Payments | PASS | Nothing is sold. Listing: "Every feature is included, with 10 scans a day". |
| 15 | Functionality and stability | PASS, limited evidence | 66 of 66 tests pass today, and type checks are clean. /health, /privacy, /terms and /support all return 200. Android vitals: data unavailable (too few users). |
| 16 | Policy status | PASS | Play Console 3 Nov: no issues for the account or VinylVault. |
| 17 | Trader status | **OPEN, owner's decision** | Google's 29 Oct email says "Starting in November 2026" and its help page gives existing accounts until 1 Feb 2027. Account details doesn't appear to show a declaration. Not a blocker for this application. Decide before production. |

## Draft answers (nothing entered or sent)

All 3 pages of the form were read today, using a practice copy that was discarded. Google limits written answers to 300 characters. Page 2's install choices are 0-10K, 10K-100K, 100K-1M, 1M+ and "I don't know". Page 3 asks "What changes did you make to your app based on what you learned during your closed test?" and "How did you decide that your app is ready for production?".

versionCode 6 and the description change were sent to Google on 3 Nov with the owner's OK. Production application submitted 3 Nov at 13:59 with the owner's OK, using the answers below; the owner confirmed they tested the app themselves and chose 0-10K installs.

**How did you recruit users for your closed test?**
I used a paid testing provider, Testers Community, which supplied testers through a Google Group. Play Console shows at least 12 opted in. I did not recruit record collectors for this test. I also tested the app myself.

**How easy was it to recruit testers?** Easy (a paid service supplied them).

**Describe the engagement you received from testers.**
Play Console shows 18 installs, 8 first opens and 14 active devices in 28 days. I can't confirm testers used every feature or scanned their own records as real users would. Real users would scan records they own, compare pressings and build a collection.

**Summary of feedback, and how you collected it.**
No tester wrote anything in Play's Testing feedback. The provider's report was generic: no crashes, and it suggested a walkthrough the app already has. So this test gave me little useful feedback. Future reports will come from the in-app "This looks wrong" button.

**Target audience (page 2).**
Adult vinyl record collectors, buyers and sellers who want help working out which pressing they have and what condition it is in.

**Value proposition (page 2).**
Photograph a record to get likely pressings, a condition estimate, pressing checks and Discogs price suggestions. It works on older records with no barcode. Results are AI estimates, not proof of authenticity.

**Estimated installs in the first year (page 2).** The lowest range offered (owner to confirm).

**Changes after closed testing (page 3).**
These came from my own policy review, not tester feedback: an AI permission screen with a switch to withdraw, in-app result reports, no made-up prices when no real one exists, clearer AI-estimate wording, and sample records removed.

**How you decided the app is ready (page 3).**
I checked it against Play's policies, all 66 automated tests pass, its server pages are live and Policy status shows no issues. Vitals has too little data to judge crash rates, so I will watch them and result reports closely after launch.

## Result

No fails left. Rows 1 and 1b were fixed in versionCode 6. Open risks remain in rows 4 to 7 and 9, and the owner decides on them. Both submissions were made with the owner's OK and are waiting on Google. Before publishing to production: run a new check, and settle the name, Discogs and trader status.
