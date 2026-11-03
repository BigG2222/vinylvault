# VinylVault: Google Play listing (draft)

Copy each section into Play Console → Grow users → Store presence → Main store listing.

## App name (max 30 characters)

VinylVault: Record Scanner

## Short description (max 80 characters)

Photograph a vinyl record to identify the pressing, grade it and check its value

## Full description (max 4,000 characters)

VinylVault identifies vinyl records from photos. Photograph the front cover, back cover and centre label (and, if you like, the runout etching and barcode) and VinylVault suggests the most likely pressings, estimates the condition and shows price suggestions from Discogs.

WHAT YOU GET FROM EACH SCAN
• Pressing match: the top candidate pressings with label, catalogue number, country and year, each with a confidence score. If we're not sure, you pick.
• Condition estimate: separate Goldmine-style grades for the vinyl and the sleeve, with the wear we could see (scuffs, ring wear, seam splits, writing).
• Pressing checks: eight checks such as label print, runout etching, catalogue numbers and barcode-versus-era, each explained in plain language. The result is an AI estimate from photos, not proof of authenticity.
• Value: price suggestions from Discogs for your copy's condition, shown as a low to high range with the date. When Discogs has no price, the app says "No price available" and links to the record on Discogs.

WORKS FOR OLDER RECORDS TOO
Most records from before about 1980 have no barcode. VinylVault doesn't need one: it reads the cover, the label text and the runout.

YOUR COLLECTION
Save records to your collection, add notes and folders, filter by artist, genre, decade, condition or value, and export to CSV or PDF. Your collection stays on your phone.

FREE WHILE IT'S NEW
Every feature is included, with 10 scans a day.

GOOD TO KNOW
• Results are AI estimates from photos, not appraisals or proof of authenticity. Every result shows how confident it is, and you can report anything that looks wrong.
• Photos are analysed by Claude, an AI service from Anthropic, only after you agree. You can turn this off in Profile.
• Photos can't hear: play a record before you buy or sell it on a grade.
• An internet connection is needed for identification and prices.
• Data provided by Discogs. This application uses Discogs' API but is not affiliated with, sponsored or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC.

Screenshots show example data.

## Category and tags

- Category: Music & Audio
- Tags: Music, Collecting

## Contact details

- Email: lanansipsip@gmail.com
- Privacy policy: https://vinylvault-vision.onrender.com/privacy
- Terms of use: https://vinylvault-vision.onrender.com/terms

## Graphics (in this folder)

- App icon: play-icon-512.png (512 × 512)
- Feature graphic: feature-graphic-1024x500.png
- Phone screenshots: 2 to 8 needed (Home, a scan result, the collection, a record's detail)
- Screenshots regenerated 30 Oct 2026 by `scripts/store-screenshots.mjs`, which swaps every real artist, album, label and catalogue number in the sample data for made-up ones (Violet Engine, Milo Daniels, Lew Mercer…); sample prices are labelled "Example value (sample records)" and "not market data". App Store set (`app-store/`, IOS=1) still to regenerate.

---

# App content answers (Play Console → Policy → App content)

## Data safety

- Does your app collect or share any of the required user data types? **Yes**
- Is all user data encrypted in transit? **Yes** (HTTPS)
- Do you provide a way for users to request that their data is deleted? **No, but user data is automatically deleted within 90 days** (photos: Anthropic deletes API inputs within 30 days; reports: server logs are deleted within 30 days; install IDs: daily counts cleared every day). The privacy policy also says to email us to have a report deleted sooner.
- Accounts: none. No sign-in with outside accounts.

Data types collected (updated 28 Oct 2026 to match what the app really does; **check the console matches this table**):

| Data type | Collected | Shared | Processed ephemerally | Required | Purpose |
|---|---|---|---|---|---|
| Photos and videos → Photos | Yes | No (Anthropic is a service provider, which Play doesn't count as sharing) | **No** (Anthropic keeps API inputs for up to 30 days, longer only to enforce its usage policy or by law: privacy.claude.com, article 7996866) | Yes, to scan | App functionality |
| Device or other IDs | Yes (random install ID for daily limits, also sent with reports) | No | No (kept for the day; in report logs up to 30 days) | Yes | App functionality, Fraud prevention, security and compliance |
| App activity → Other user-generated content | Yes (the optional note and reason in a "This looks wrong" report, plus the record the result named) | No | No (server logs, deleted within 30 days) | No (optional) | App functionality |

Not collected: name, email, location, contacts, financial info, web history, audio, files, calendar, health, messages, advertising ID. (Emails someone chooses to send to support are outside the app.)

## Other declarations

- Ads: **No, the app contains no ads**
- Target audience: **18 and over** (simplest; the app isn't aimed at children)
- Content rating questionnaire: category **Utility, productivity, communication or other**; answer No to violence, sexual content, profanity, drugs, gambling. Users can't interact or share content with each other; no location sharing; no purchases of digital goods (free launch: the paywall can't be opened while FREE_LAUNCH is on, and release builds can't grant Premium without a real store purchase).
- Government app: No. Financial features: No. Health: No. News: No.
- App access: **All functionality is available without special access** (no login).
