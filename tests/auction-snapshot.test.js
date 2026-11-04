const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SNAPSHOT_FIELDS,
  compactSnapshot,
  expandSnapshot,
  readSnapshotFile,
  buildAuctionStore,
  installAuctionStore,
  refreshAuctionStoreFromApi,
  fetchAllNameSiloAuctions,
  getAuctionDataMeta,
  isAuctionDataStale,
  resetAuctionDataMeta,
} = require("../server/candidate-store/auction-snapshot");
const { resetStorePaths, getDurableCandidateBySlug, listSitemapCandidates } = require("../server/candidate-store/durable-candidates");
const { normalizeAuctionRecord } = require("../server/domain-fetch/fetch-namesilo-auctions");
const { checkBrandSafety, withinOneEdit } = require("../server/candidate-store/brand-safety");
const { segmentWords } = require("../server/candidate-store/name-words");
const { indexRejection, selectIndexedSlugs } = require("../server/candidate-store/indexing-policy");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const { resolveLifecycleState } = require("../server/candidate-store/product-lifecycle");
const { buildIndexedDomainSitemap, getCoreSitemapPaths } = require("../server/sitemap");
const { renderAuctionHubPage, isHubIndexable, listIndexableHubEntries, resolveAuctionHubRoute } = require("../server/renderers/auction-hubs");
const { describeAuctionData } = require("../server/renderers/auction-data-label");

// Times are relative to the real clock: lifecycle checks read Date.now().
const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const FETCHED = new Date(NOW - HOUR).toISOString();

function endsIn(ms) {
  return new Date(NOW + ms).toISOString().slice(0, 19).replace("T", " ");
}

function raw(domain, overrides = {}) {
  return {
    id: 1,
    domain,
    statusId: 2,
    typeId: 3,
    openingBid: 1,
    currentBid: 1,
    bidsQuantity: 0,
    hasBids: false,
    domainCreatedOn: "2012-03-01 00:00:00",
    auctionEndsOnUtc: endsIn(48 * HOUR),
    url: `https://www.namesilo.com/auctions/${domain}`,
    ...overrides,
  };
}

test.afterEach(() => {
  resetStorePaths();
  resetAuctionDataMeta();
});

test("NameSilo UTC timestamps without a zone are read as UTC", () => {
  const auction = normalizeAuctionRecord(raw("kettleskin.com", { auctionEndsOnUtc: "2026-11-06 16:00:00" }));
  assert.equal(auction.auctionEndsAt, "2026-11-06T16:00:00.000Z");
  assert.equal(auction.domainCreatedAt, "2012-03-01T00:00:00.000Z");
  assert.equal(auction.openingBid, 1);
  assert.equal(auction.bidCount, 0);
});

test("snapshot keeps only the shown fields, drops unsafe names and round-trips", () => {
  const snapshot = compactSnapshot(
    [raw("kettleskin.com", { auctionEndsOnUtc: "2026-11-06 16:00:00" }), raw("freeadultsexclips.com"), raw("casino96.net")],
    { fetchedAt: "2026-11-04 18:04:47" }
  );
  assert.deepEqual(snapshot.fields, SNAPSHOT_FIELDS);
  assert.equal(snapshot.fetchedAtUtc, "2026-11-04T18:04:47.000Z");
  assert.equal(snapshot.count, 1);
  assert.equal(snapshot.fetchedCount, 3);
  assert.equal(snapshot.excludedBrandSafety, 2);
  assert.ok(!JSON.stringify(snapshot).includes("hasBids"));
  const expanded = expandSnapshot(snapshot);
  assert.equal(expanded.fetchedAt, "2026-11-04T18:04:47.000Z");
  assert.equal(expanded.auctions[0].domain, "kettleskin.com");
  assert.equal(expanded.auctions[0].auctionEndsOnUtc, "2026-11-06 16:00:00");
  // The plain API dump format is accepted too.
  assert.equal(expandSnapshot({ fetchedAtUtc: "2026-11-04 18:04:47", auctions: [raw("a.com")] }).auctions.length, 1);
  assert.equal(expandSnapshot({ auctions: [] }), null);
});

test("the committed snapshot loads through the pipeline with honest fetch metadata", () => {
  const snapshot = readSnapshotFile();
  assert.ok(snapshot.auctions.length > 1000);
  const { records, meta } = buildAuctionStore(snapshot.auctions.slice(0, 2000), {
    fetchedAt: snapshot.fetchedAt,
    now: Date.parse(snapshot.fetchedAt) + 60 * 1000,
  });
  const first = Object.values(records)[0];
  assert.equal(first.statusVerifiedAt, snapshot.fetchedAt);
  assert.equal(first.source, "namesilo-auction");
  assert.ok(meta.loadedCount > 0);
  assert.ok(meta.indexedCount < meta.loadedCount / 10, "only a small share is indexable");
  for (const record of Object.values(records)) {
    assert.ok(checkBrandSafety(record.domain).safe, record.domain);
  }
});

test("brand-safety filter blocks adult, slur, gambling, piracy, typosquat and test names", () => {
  const blocked = {
    "shefucksmen.com": "adult",
    "analkennel.com": "adult",
    "casino96.net": "gambling",
    "bolabet123.com": "gambling",
    "protonmovies.com": "piracy",
    "vumoo.live": "piracy",
    "gooogle.pics": "brand-typosquat",
    "paypa1.com": "brand-typosquat",
    "drive-icloud.com": "brand-typosquat",
    "test123.com": "test-name",
    "qwerty.top": "test-name",
    "faggotry.net": "slur",
  };
  for (const [domain, category] of Object.entries(blocked)) {
    assert.equal(checkBrandSafety(domain).category, category, domain);
  }
  for (const domain of ["analytics.com", "canal.com", "method.com", "peacock.com", "betterhomes.com", "alphabet.com", "apply.com", "targetpractice.com", "christianalexander.info", "3521242.sbs", "rewindlab.com"]) {
    assert.equal(checkBrandSafety(domain).safe, true, domain);
  }
  assert.ok(withinOneEdit("gogle", "google"));
  assert.ok(withinOneEdit("googel", "google"));
  assert.ok(!withinOneEdit("goggles", "google"));
});

test("unsafe names never enter the store", () => {
  const { records, meta } = buildAuctionStore([raw("kettleskin.com"), raw("pornsonmom.com")], { fetchedAt: FETCHED, now: NOW });
  assert.deepEqual(Object.keys(records), ["kettleskin-com"]);
  assert.equal(meta.excluded.brandSafety, 1);
  assert.equal(meta.excluded.byCategory.adult, 1);
});

test("names are split into common words only when the whole name is words", () => {
  assert.deepEqual(segmentWords("seedjuice"), ["seed", "juice"]);
  assert.deepEqual(segmentWords("kettleskin"), ["kettle", "skin"]);
  assert.equal(segmentWords("09kybuo0c"), null);
  assert.equal(segmentWords("uxun"), null);
  assert.equal(segmentWords("pathpulselabcore"), null, "more than three words");
});

test("indexing policy: only a small set of clean, word-based, running auctions", () => {
  const { records } = buildAuctionStore(
    [
      raw("kettleskin.com"),
      raw("batbot.com", { bidsQuantity: 36, currentBid: 454 }),
      raw("09kybuo0c.com"),
      raw("23aqyfe2.com", { bidsQuantity: 9 }),
      raw("kettleskin.top"),
      raw("cash-wise.com"),
      raw("pathpulselab.com"),
      raw("clearkeygolf.com", { bidsQuantity: 1 }),
      raw("uxun.com", { bidsQuantity: 49, currentBid: 610 }),
    ],
    { fetchedAt: FETCHED, now: NOW }
  );
  const byDomain = (domain) => records[domain.replace(/\./g, "-")];
  assert.equal(indexRejection(byDomain("kettleskin.com"), NOW), null);
  assert.equal(indexRejection(byDomain("clearkeygolf.com"), NOW), null);
  assert.match(indexRejection(byDomain("09kybuo0c.com"), NOW), /quality flag/);
  assert.match(indexRejection(byDomain("23aqyfe2.com"), NOW), /random-string|quality flag/, "random strings are never indexable, even with bids");
  assert.match(indexRejection(byDomain("kettleskin.top"), NOW), /extension/);
  assert.match(indexRejection(byDomain("cash-wise.com"), NOW), /letters/);
  assert.match(indexRejection(byDomain("pathpulselab.com"), NOW), /three-word/);
  assert.match(indexRejection(byDomain("uxun.com"), NOW), /common words/);

  const all = Object.values(records);
  assert.equal(byDomain("batbot.com").seoTier, "index-now");
  assert.equal(byDomain("09kybuo0c.com").seoTier, "hold-noindex");
  // Auctions with bids come first and the cap is respected.
  assert.deepEqual([...selectIndexedSlugs(all, { now: NOW, max: 1 })], ["batbot-com"]);
  assert.equal(selectIndexedSlugs(all, { now: NOW }).size, 3);
});

test("ended auctions turn noindex and leave the sitemap without a refresh", () => {
  const meta = installAuctionStore(
    buildAuctionStore([raw("kettleskin.com"), raw("healridge.com", { auctionEndsOnUtc: endsIn(HOUR) })], { fetchedAt: FETCHED })
  );
  assert.equal(meta.indexedCount, 2);
  const after = NOW + HOUR + 1000;
  assert.equal(listSitemapCandidates({ now: NOW }).length, 2);
  assert.equal(listSitemapCandidates({ now: after }).length, 1);
  assert.equal(resolveDomainPage("healridge-com", {}, null, { now: NOW }).indexable, true);
  assert.equal(resolveDomainPage("healridge-com", {}, null, { now: after }).indexable, false);
  // A record whose end time has passed reads as ended with no refresh at all.
  const record = getDurableCandidateBySlug("healridge-com");
  assert.equal(resolveLifecycleState(record, after), "ended");
  assert.equal(record.statusVerifiedAt, FETCHED);
  assert.ok(isAuctionDataStale(meta, NOW + 49 * HOUR));
  assert.ok(!isAuctionDataStale(meta, NOW));
  // Past the 24h verification window nothing stays in the sitemap.
  assert.equal(listSitemapCandidates({ now: NOW + 24 * HOUR }).length, 0);
});

test("domain sitemap uses the fetch time as lastmod", () => {
  installAuctionStore(buildAuctionStore([raw("kettleskin.com")], { fetchedAt: FETCHED }));
  const xml = buildIndexedDomainSitemap({ isProduction: true });
  assert.match(xml, /<loc>https:\/\/urlsnatcher\.com\/domains\/kettleskin-com<\/loc>/);
  assert.ok(xml.includes(`<lastmod>${FETCHED}</lastmod>`));
});

test("a failed API refresh keeps the last good data", async () => {
  installAuctionStore(buildAuctionStore([raw("kettleskin.com")], { fetchedAt: FETCHED, now: NOW }));
  const failing = async () => ({ ok: false, json: async () => ({ reply: { code: 110, detail: "Invalid API key" } }) });
  const result = await refreshAuctionStoreFromApi({ apiKey: "x", fetchFn: failing });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Invalid API key/);
  assert.equal(getAuctionDataMeta().fetchedAt, FETCHED);
  assert.ok(getDurableCandidateBySlug("kettleskin-com"));

  const empty = async () => ({ ok: true, json: async () => ({ reply: { code: 300, body: [] } }) });
  assert.equal((await refreshAuctionStoreFromApi({ apiKey: "x", fetchFn: empty })).ok, false);
  assert.equal(getAuctionDataMeta().fetchedAt, FETCHED);
});

test("a successful API refresh pages through results and replaces the store", async () => {
  const pages = { 1: [raw("kettleskin.com"), raw("healridge.com")], 2: [raw("cottagebar.com")] };
  const calls = [];
  const fetchFn = async (url) => {
    const params = new URL(url).searchParams;
    calls.push(params.get("page"));
    assert.equal(params.get("statusId"), "2");
    assert.equal(params.get("typeId"), "3");
    return { ok: true, json: async () => ({ reply: { code: 300, body: pages[params.get("page")] || [] } }) };
  };
  const all = await fetchAllNameSiloAuctions({ apiKey: "x", fetchFn, pageSize: 2 });
  assert.equal(all.length, 3);
  assert.deepEqual(calls, ["1", "2"]);
  const result = await refreshAuctionStoreFromApi({ apiKey: "x", fetchFn, pageSize: 2, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.meta.origin, "namesilo-api");
  assert.equal(result.meta.loadedCount, 3);
  assert.ok(getDurableCandidateBySlug("cottagebar-com"));
});

test("hubs stay indexable while auctions churn; empty sub-hubs are noindex", () => {
  const domains = ["kettleskin.com", "healridge.com", "cottagebar.com", "batbot.com", "fancanvas.com", "seedjuice.com"];
  installAuctionStore(buildAuctionStore(domains.map((domain) => raw(domain)), { fetchedAt: FETCHED }));
  assert.deepEqual(resolveAuctionHubRoute("/auctions/dot-com"), { slug: "dot-com" });
  assert.equal(resolveAuctionHubRoute("/auctions/nope"), null);

  const main = renderAuctionHubPage("", "https://urlsnatcher.com");
  assert.match(main, /<meta name="robots" content="index,follow" \/>/);
  assert.match(main, /"@type":"ItemList"/);
  assert.match(main, /kettleskin\.com/);
  assert.equal(isHubIndexable("dot-com"), true);
  assert.equal(isHubIndexable("with-bids"), false);
  assert.match(renderAuctionHubPage("with-bids", "https://urlsnatcher.com"), /noindex,follow/);
  const hubPaths = listIndexableHubEntries().map((entry) => entry.pathname);
  assert.ok(hubPaths.includes("/auctions/dot-com"));
  assert.ok(!hubPaths.includes("/auctions/with-bids"));
  assert.ok(listIndexableHubEntries().every((entry) => entry.lastmod === FETCHED));
  assert.ok(getCoreSitemapPaths().includes("/auctions"));
});

test("with no running auctions the hub and data label degrade honestly", () => {
  const meta = installAuctionStore(buildAuctionStore([raw("kettleskin.com", { auctionEndsOnUtc: "2026-06-13 08:00:00" })], { fetchedAt: "2026-06-12T08:00:00Z", now: Date.parse("2026-06-12T09:00:00Z") }));
  const label = describeAuctionData(meta);
  assert.equal(label.stale, true);
  assert.match(label.sentence, /12 June 2026 at 08:00 UTC/);
  assert.match(label.sentence, /have since ended/);
  const main = renderAuctionHubPage("", "https://urlsnatcher.com");
  assert.match(main, /None of the auctions in the latest data are still running/);
  assert.match(main, /index,follow/);
  assert.match(renderAuctionHubPage("dot-com", "https://urlsnatcher.com"), /noindex,follow/);
  assert.deepEqual(listIndexableHubEntries().map((entry) => entry.pathname), ["/auctions"]);
});
