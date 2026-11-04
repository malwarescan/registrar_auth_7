# URL Snatcher (urlsnatcher.com)

Expired-domain auction finder, auction lists, decision guides and data feeds, run by NameSilo. Node server (`server.js`), deployed on Railway from `main`.

```
npm install
npm start        # builds the finder bundle, then serves on PORT (default 4173)
npm test
```

## Auction data

The site lists NameSilo expired-domain auctions from NameSilo's `listAuctions` API (`statusId=2` active, `typeId=3` expired-domain auctions).

- **Committed snapshot.** `data/namesilo-auctions-snapshot.json` is loaded on boot. It keeps only the fields the site shows (domain, opening bid, current bid, bid count, domain creation date, auction end time) and the fetch time. Names that fail the brand-safety filter (adult, slurs, gambling, piracy, drugs, brand look-alikes, test names) are left out of the file and never get a page.
- **Live refresh.** When `NAMESILO_API_KEY` is set, the server fetches every active auction on boot and every 6 hours, runs it through the same pipeline and swaps it in. If a fetch fails or returns nothing, the last good data stays loaded. `GET /health` shows the data's origin, fetch time and the time of the last failed refresh.
- **Without a key** the snapshot is served as is. The committed file holds the 29,990 auctions ending soonest at its fetch time (4 November 2026, ending 5-8 November; a full live pull returned about 77,000 auctions ending up to 12 days out), so it goes stale within days; every auction's status is recalculated from its end time on each request, so ended auctions automatically show "Auction ended", turn `noindex` and drop out of the sitemap. Domain pages also leave the sitemap 24 hours after the fetch (`SITEMAP_FRESHNESS_HOURS`). The hub page `/auctions`, the guides and the data pages stay up and say when the data was fetched and that the auctions have ended.

Pipeline: `normalizeAuctionRecord` → `validateNormalizedAuction` → brand-safety filter (`server/candidate-store/brand-safety.js`) → product record with scores and quality flags → `validateProductRecord` → indexing policy (`server/candidate-store/indexing-policy.js`). Entry point: `server/candidate-store/auction-snapshot.js`.

### Set NAMESILO_API_KEY in Railway

1. Open the project in Railway and select the web service for urlsnatcher.com.
2. Go to **Variables** → **New Variable**.
3. Name: `NAMESILO_API_KEY`; value: the NameSilo API key (NameSilo account → API Manager). Use a key that is allowed to call `listAuctions` from Railway's egress IPs (leave the IP restriction off or add Railway's addresses).
4. Save. Railway redeploys the service. The deploy log should show `NameSilo auctions refreshed: N loaded, M indexable.` within a minute or two; `https://urlsnatcher.com/health` should then show `"origin":"namesilo-api"` and a recent `fetchedAt`.

Optional: `DISABLE_AUCTION_REFRESH=true` turns the refresh loop off while keeping the key available to the finder.

### Refresh the committed snapshot

```
NAMESILO_API_KEY=... node scripts/build-auction-snapshot.js --from-api
# or from a saved API dump: { "fetchedAtUtc": "...", "auctions": [ ...raw listAuctions records... ] }
node scripts/build-auction-snapshot.js --from-file=/path/to/dump.json
```

Commit `data/namesilo-auctions-snapshot.json` and push to `main`.

## Indexing policy

Auctions are short-lived, so the site does not ask search engines to index thousands of pages that disappear within days.

- A domain page is `index,follow` and listed in `/sitemap-domains-indexed.xml` only if the auction is running, was fetched within 24 hours, the name is 4-15 letters on .com/.net/.org/.co/.io/.ai/.app/.dev, splits into one or two common English words (three only with a bid), has no quality flag (random strings are never indexable), passes the brand-safety filter, and is in the best 150 (auctions with bids first). Every other domain page is `noindex,follow`.
- Ended auctions: "Auction ended", no Offer, `noindex`, out of the sitemap.
- Sitemap `lastmod` for domain pages and auction hubs is the data's fetch time.
- Stable hubs carry the lasting value: `/auctions` (always indexable) and `/auctions/with-bids`, `/auctions/dot-com`, `/auctions/word-names` (indexable while they list at least 5 running auctions, otherwise `noindex` and out of the sitemap).
