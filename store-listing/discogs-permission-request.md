# Request to Discogs: permission for a paid version of VinylVault

Send through the Discogs Help Center: https://support.discogs.com → "Submit a request" →
choose the API / developer topic. Send it from the Discogs account that owns the API token (BIgG95).

---

**Subject:** Permission request: commercial use of the Discogs API in VinylVault (vinyl identification app)

Hello Discogs API team,

I'm the developer of VinylVault, a mobile app for Android and iPhone that helps record collectors identify which pressing of a vinyl record they have. The user photographs the cover, back cover and label; our own AI analysis suggests the most likely pressing and estimates its condition from the photos. We then use the Discogs API to look up that release, link to it on Discogs, and show its current marketplace value.

VinylVault is currently free, and I would like to ask for your written permission before introducing an optional paid subscription. Your API Terms of Use say that charging for an application that integrates the API, and commercial use of Restricted Data, need Discogs' express written permission, so I'm asking before we change anything.

**How VinylVault uses the API today**
- Calls are made from our server with my personal access token (account BIgG95), throttled to stay well under 60 requests per minute and capped per user per day.
- CC0 data: release lookup by catalogue number, barcode, artist and title, so we can link each result to its Discogs release page.
- Marketplace Data: price suggestions for the release (from my own account's seller settings) and marketplace stats (lowest listing, number for sale), shown as a value range for the user's copy.
- We follow the terms: "Data provided by Discogs." appears next to every price and links to the release on discogs.com; the "not affiliated with, sponsored or endorsed by Discogs" notice is shown in the app and on our website; Discogs prices are never shown more than 6 hours after they were fetched and are deleted from users' devices after that; we don't sell, transfer or advertise with any Discogs data.

**What we'd like to do**
- Offer an optional subscription (about $9.99 a month or $59.99 a year) that unlocks unlimited scans and extra features. The subscription pays for our own AI analysis, which is the costly part of the service.
- Keep showing Discogs data, with the attribution and link back, to free and paying users alike.

**Our questions**
1. May VinylVault charge a subscription while integrating the Discogs API as described?
2. May we show Marketplace Data (price suggestions and marketplace stats) in the app once it has paid features? If not, is there a licence or partner agreement for this?
3. Is using price suggestions from my own account's seller settings acceptable for an app with many users, or would you prefer a different approach, such as a registered application with OAuth?
4. Is there anything else you'd like us to change?

Every result links back to the release on Discogs, so the app sends collectors to Discogs to buy, sell and catalogue. I'm happy to share screenshots, a test build, or any usage numbers.

Thank you for your time.

Kind regards,
Glen Hankin
VinylVault
lanansipsip@gmail.com
