const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  upsertProductRecord,
  promoteToIndexNow,
  listSitemapCandidates,
} = require("../server/candidate-store/durable-candidates");
const {
  isSitemapFresh,
  validateSitemapEligibility,
  getSitemapFreshnessMs,
} = require("../server/candidate-store/sitemap-freshness");
const { validateIndexNowEligibility } = require("../server/candidate-store/seo-tier");
const { countListingCandidates } = require("../server/candidate-store/listing-feed");
const { resolveProductOgImageUrl } = require("../server/product-asset");
const { INDEX_NOW_BATCH_PATH } = require("../server/candidate-store/store-paths");

function sampleAuction(domain, overrides = {}) {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    domain,
    root: domain.split(".")[0],
    tld: `.${domain.split(".").pop()}`,
    currentBid: 10,
    bidCount: 1,
    auctionEndsAt: future,
    auctionUrl: `https://www.namesilo.com/auctions/${domain}`,
    ...overrides,
  };
}

function seedFreshRecord(domain, overrides = {}) {
  const record = upsertProductRecordFromAuction(sampleAuction(domain, overrides));
  const now = Date.now();
  record.statusVerifiedAt = new Date(now).toISOString();
  record.statusExpiresAt = new Date(now + 15 * 60 * 1000).toISOString();
  record.baseScores = { ...record.baseScores, overall: 72, ...(overrides.baseScores || {}) };
  if (!record.categoryGuesses?.length) record.categoryGuesses = ["Commercial software"];
  if (!record.buyerUseCases?.length) record.buyerUseCases = ["Commercial software brand"];
  upsertProductRecord({ ...record, ...overrides });
  return record;
}

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-sitemap-fresh-"));
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

test("expired statusExpiresAt remains sitemap eligible when statusVerifiedAt is recent", () => {
  const tempDir = makeTempStore();
  try {
    const now = Date.parse("2026-06-13T07:00:00.000Z");
    seedFreshRecord("freshsitemap.com", {
      auctionEndsAt: new Date(now + 60 * 60 * 1000).toISOString(),
    });
    promoteToIndexNow("freshsitemap-com");
    const slug = "freshsitemap-com";
    const { getDurableCandidateBySlug } = require("../server/candidate-store/durable-candidates");
    const record = getDurableCandidateBySlug(slug);
    record.statusVerifiedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    record.statusExpiresAt = new Date(now - 30 * 60 * 1000).toISOString();
    upsertProductRecord(record);

    assert.equal(validateIndexNowEligibility(record, now), "statusExpiresAt must be in the future");
    assert.equal(isSitemapFresh(record, now), true);
    assert.equal(validateSitemapEligibility(record, now), null);
    assert.equal(listSitemapCandidates({ now }).length, 1);
    assert.equal(countListingCandidates("indexed", { now }), 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("statusVerifiedAt older than sitemap freshness window is excluded", () => {
  const tempDir = makeTempStore();
  try {
    const now = Date.parse("2026-06-13T07:00:00.000Z");
    seedFreshRecord("stalewindow.com");
    promoteToIndexNow("stalewindow-com");
    const { getDurableCandidateBySlug } = require("../server/candidate-store/durable-candidates");
    const record = getDurableCandidateBySlug("stalewindow-com");
    record.statusVerifiedAt = new Date(now - getSitemapFreshnessMs() - 1000).toISOString();
    record.statusExpiresAt = new Date(now + 15 * 60 * 1000).toISOString();
    upsertProductRecord(record);

    assert.equal(isSitemapFresh(record, now), false);
    assert.equal(listSitemapCandidates({ now }).length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ended auction excluded from sitemap even if recently verified", () => {
  const tempDir = makeTempStore();
  try {
    const now = Date.now();
    seedFreshRecord("ended.com");
    promoteToIndexNow("ended-com");
    const { getDurableCandidateBySlug } = require("../server/candidate-store/durable-candidates");
    upsertProductRecord({
      ...getDurableCandidateBySlug("ended-com"),
      status: "auction-ended",
      lifecycleState: "ended",
      auctionEndsAt: new Date(now - 3600000).toISOString(),
      statusVerifiedAt: new Date(now).toISOString(),
      statusExpiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    });
    assert.equal(listSitemapCandidates({ now }).length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("index-now batch store keeps sitemap populated after short TTL expiry", () => {
  if (!fs.existsSync(INDEX_NOW_BATCH_PATH)) return;
  configureStorePaths({ indexNowBatchPath: INDEX_NOW_BATCH_PATH });
  const now = Date.parse("2026-06-13T07:00:00.000Z");
  const { loadIndexNowBatch } = require("../server/candidate-store/index-now-batch");
  const batch = loadIndexNowBatch({ refreshTtl: false });
  for (const record of Object.values(batch)) {
    record.statusExpiresAt = new Date(now - 60 * 60 * 1000).toISOString();
    if (!record.statusVerifiedAt) {
      record.statusVerifiedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    }
  }
  const candidates = listSitemapCandidates({ now });
  assert.equal(candidates.length, 500);
});

test("missing domain image resolves to default OG asset URL", () => {
  const url = resolveProductOgImageUrl("missing-slug-com", { isProduction: true });
  assert.equal(url, "https://urlsnatcher.com/assets/domain-og-default.png");
});
