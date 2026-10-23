# Reply to App Review: Guideline 2.1 Information Needed (submission 60d9fac2, 22 Oct 2026)

Paste the reply below into App Store Connect → App Review → the message thread, and attach the screen recording.
Paste the same text into App Store Connect → the 1.0 version page → App Review Information → Notes.

---

Hello, and thank you for reviewing VinylVault. Here is the information you asked for. The screen recording, made on an iPhone running the latest iOS, is attached.

1. Screen recording
Attached. It starts from launching the app and shows the typical flow: the short introduction, scanning a record (front cover, back cover, centre label), the result (pressing match, condition grades, pressing checks and value range), saving the record to the collection, and browsing the collection. VinylVault has no accounts, no login, no user-generated content shared with other users, and no paid content or in-app purchases.

2. Purpose and target audience
VinylVault helps vinyl record collectors and buyers identify which pressing of a record they have, estimate its condition, and see what it is worth. The same album can exist in dozens of pressings with very different values, and telling them apart normally means comparing small details on the label, sleeve and runout etching by hand. VinylVault reads those details from photos and suggests the most likely pressings with confidence scores, separate condition grades for the vinyl and sleeve, plain-language pressing checks, and a low/average/high value range. It is aimed at adult record collectors, second-hand record shoppers and people sorting inherited collections.

3. How to use the main features
No login, account or sample file is needed. Open the app, tap Continue on the first introduction page, then "Start scanning free". A few clearly labelled sample records are added to the collection so every screen can be explored straight away.
- Scan a record: tap "Scan a record" on the Home tab, allow camera access, and photograph the front cover, back cover and centre label of any vinyl record (the runout and barcode steps are optional and can be skipped). The analysis takes about 30 seconds.
- Check from photos: tap "Check from photos" on the Home tab to run the same analysis on photos already in the photo library (for example, a seller's listing photos).
- Result: shows the matched pressing, condition grades, pressing checks, and value range. Tap "Save to collection".
- Collection tab: search, filter, sort, add notes and tags, and export to CSV or PDF.
- Profile tab: daily scan count, support and feedback links, and the privacy policy.
The app is free with 10 scans per device per day.

4. External services used
- Anthropic Claude API (AI image analysis): the photos are sent over HTTPS to our own server, which asks Claude to identify the record and describe its condition. Photos are not stored.
- Discogs API (music database): our server looks up the identified record to provide release details, links and marketplace price data. Nothing about the user is sent.
- Render (cloud hosting) runs our server at vinylvault-vision.onrender.com, which also hosts the privacy policy and support pages.
- Google ML Kit text recognition runs on the device to read label text; no data leaves the phone for this.
There is no authentication service, payment processor, advertising or analytics SDK.

5. Regional differences
The app works the same in every region. All text is in English. Price data from Discogs is shown in US dollars in all regions.

6. Regulated industry or third-party material
VinylVault does not operate in a regulated industry. Release data and prices come from the Discogs API, used under the Discogs API Terms of Use, with "Data provided by Discogs." shown next to that data as those terms require. The only images shown are the photos the user takes or chooses.

Kind regards,
Glen Hankin
