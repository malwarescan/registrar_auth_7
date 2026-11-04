const test = require("node:test");
const { SITE_NAME } = require("../server/site-identity");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  upsertProductRecord,
  promoteCandidate,
} = require("../server/candidate-store/durable-candidates");
const {
  renderFeedLandingPage,
  renderHomepageDatasetSchema,
  injectHomeDiscovery,
  resolveFeedLandingKey,
} = require("../server/renderers/data-feed-landing");

function sampleAuction(domain) {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    domain,
    root: domain.split(".")[0],
    tld: `.${domain.split(".").pop()}`,
    currentBid: 10,
    bidCount: 1,
    auctionEndsAt: future,
    auctionUrl: `https://www.namesilo.com/auctions/${domain}`,
    categoryGuesses: ["Workflow software"],
    buyerUseCases: ["Help desk automation"],
  };
}

function seedFreshRecord(domain) {
  const record = upsertProductRecordFromAuction(sampleAuction(domain));
  const now = Date.now();
  record.statusVerifiedAt = new Date(now).toISOString();
  record.statusExpiresAt = new Date(now + 15 * 60 * 1000).toISOString();
  record.baseScores = { ...record.baseScores, overall: 72, tldTrust: 96, brandability: 75, pronounceability: 78 };
  upsertProductRecord(record);
  return record;
}

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-data-landing-"));
  configureStorePaths({
    durablePath: path.join(tempDir, "durable-candidates.json"),
    publishedPath: path.join(tempDir, "published-candidates.json"),
    recordsDir: path.join(tempDir, "product-records"),
  });
  fs.writeFileSync(path.join(tempDir, "durable-candidates.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(tempDir, "published-candidates.json"), "[]\n", "utf8");
  fs.mkdirSync(path.join(tempDir, "product-records"), { recursive: true });
  return tempDir;
}

test.afterEach(() => resetStorePaths());

test("resolveFeedLandingKey maps data routes", () => {
  assert.equal(resolveFeedLandingKey("/data/domain-listings"), "domain-listings");
  assert.equal(resolveFeedLandingKey("/data/domain-graph/"), "domain-graph");
  assert.equal(resolveFeedLandingKey("/data/unknown"), null);
});

test("homepage dataset schema references listing feed download", () => {
  const schema = renderHomepageDatasetSchema("https://urlsnatcher.com");
  assert.equal(schema["@type"], "Dataset");
  assert.equal(schema["@id"], "https://urlsnatcher.com/data/#dataset");
  assert.equal(schema.name, `${SITE_NAME} expired-domain auction data`);
  assert.deepEqual(schema.creator, { "@id": "https://urlsnatcher.com/#organization" });
  assert.ok(schema.distribution.some((entry) => entry.contentUrl.includes("/api/domain-listings.ndjson")));
});

test("feed landing page includes Dataset and DataFeed schema", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("datalandingshop.com");
    promoteCandidate("datalandingshop-com");
    const html = renderFeedLandingPage("domain-listings", "https://urlsnatcher.com");
    assert.ok(html.includes(`<title>Expired Domain Auction Listings Feed | ${SITE_NAME}</title>`));
    assert.match(html, /<a href="\/"/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /"@type":"Dataset"/);
    assert.match(html, /"@type":"DataFeed"/);
    assert.match(html, /\/api\/domain-listings\.ndjson/);
    assert.match(html, /datalandingshop\.com/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("injectHomeDiscovery adds site graph and feed discovery links, no Dataset", () => {
  const html = injectHomeDiscovery("<!DOCTYPE html><html><head></head><body></body></html>", "https://urlsnatcher.com");
  assert.match(html, /rel="alternate" type="application\/x-ndjson" href="\/api\/domain-listings\.ndjson"/);
  assert.match(html, /"@type":"Organization","@id":"https:\/\/urlsnatcher\.com\/#organization"/);
  assert.match(html, /"@type":"WebSite","@id":"https:\/\/urlsnatcher\.com\/#website"/);
  assert.match(html, /"@type":"WebPage"/);
  assert.doesNotMatch(html, /"@type":"Dataset"/);
  assert.doesNotMatch(html, /numberOfItems/);
});
