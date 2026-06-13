const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SEO_TIER,
  resolveSeoTier,
  isIndexNowTier,
  applySeoTier,
  validateIndexNowEligibility,
  isProductOfferSchemaComplete,
} = require("../server/candidate-store/seo-tier");
const { auditIndexingCandidates } = require("../server/candidate-store/indexing-audit");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  upsertProductRecord,
  promoteCandidate,
  promoteToIndexNow,
  batchPromoteIndexTier,
  listSitemapCandidates,
} = require("../server/candidate-store/durable-candidates");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const { resolveProductPageMode } = require("../server/candidate-store/product-lifecycle");

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
  return readFresh(domain);
}

function readFresh(domain) {
  const slug = domain.replace(/\./g, "-");
  const { getDurableCandidateBySlug } = require("../server/candidate-store/durable-candidates");
  return getDurableCandidateBySlug(slug);
}

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-seo-tier-"));
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

test("new durable records default to hold-noindex tier", () => {
  const tempDir = makeTempStore();
  try {
    const record = seedFreshRecord("holdme.com");
    assert.equal(resolveSeoTier(record), SEO_TIER.HOLD_NOINDEX);
    assert.equal(record.seoTier, SEO_TIER.HOLD_NOINDEX);
    assert.equal(record.indexable, false);
    assert.equal(resolveProductPageMode(record), "active-noindex");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("index-now tier renders index,follow and appears in sitemap", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("indexnow.com");
    promoteToIndexNow("indexnow-com");
    const record = readFresh("indexnow.com");
    assert.equal(resolveSeoTier(record), SEO_TIER.INDEX_NOW);
    assert.equal(isIndexNowTier(record), true);
    const resolved = resolveDomainPage("indexnow-com", {}, () => null);
    assert.equal(resolved.mode, "active-indexed");
    assert.equal(listSitemapCandidates().length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("archive tier applies to ended auctions", () => {
  const tempDir = makeTempStore();
  try {
    const record = seedFreshRecord("ended.com");
    promoteToIndexNow("ended-com");
    upsertProductRecord({
      ...readFresh("ended.com"),
      status: "auction-ended",
      lifecycleState: "ended",
      auctionEndsAt: new Date(Date.now() - 3600000).toISOString(),
    });
    const archived = readFresh("ended.com");
    assert.equal(resolveSeoTier(archived), SEO_TIER.ARCHIVE);
    assert.equal(listSitemapCandidates().length, 0);
    assert.equal(resolveProductPageMode(archived), "ended");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("validateIndexNowEligibility rejects low quality and missing signals", () => {
  const tempDir = makeTempStore();
  try {
    const low = seedFreshRecord("lowscore.com", { baseScores: { overall: 12 } });
    assert.match(validateIndexNowEligibility(low), /Quality score below threshold/);

    const noSignals = seedFreshRecord("nosignals.com");
    noSignals.categoryGuesses = [];
    noSignals.buyerUseCases = [];
    assert.equal(validateIndexNowEligibility(noSignals), "Missing category or use-case signals");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("active records have Product + Offer schema in graph", () => {
  const tempDir = makeTempStore();
  try {
    const record = seedFreshRecord("schema.com");
    assert.equal(isProductOfferSchemaComplete(record), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("auditIndexingCandidates reports tier buckets and rejection reasons", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("winner.com");
    seedFreshRecord("runner.com");
    promoteCandidate("winner-com");
    const report = auditIndexingCandidates([readFresh("winner.com"), readFresh("runner.com")]);
    assert.equal(report.indexNowRecords, 1);
    assert.equal(report.holdNoindexRecords, 1);
    assert.ok(report.indexNowEligibleRecords >= 0);
    assert.ok(Array.isArray(report.topCandidatesByScore));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("batchPromoteIndexTier promotes top eligible records up to limit", () => {
  const tempDir = makeTempStore();
  try {
    for (let index = 0; index < 8; index += 1) {
      seedFreshRecord(`batch${index}.com`, { baseScores: { overall: 60 + index } });
    }
    const result = batchPromoteIndexTier({ limit: 3 });
    assert.equal(result.promotedCount, 3);
    assert.equal(listSitemapCandidates().length, 3);
    const dry = batchPromoteIndexTier({ limit: 10, dryRun: true });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.promotedCount, 5);
    assert.equal(listSitemapCandidates().length, 3);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("applySeoTier sets consistent indexable flags", () => {
  const base = { slug: "x-com", domain: "x.com", canonicalUrl: "https://snatch.auction/domains/x-com" };
  const indexed = applySeoTier(base, SEO_TIER.INDEX_NOW);
  assert.equal(indexed.seoTier, SEO_TIER.INDEX_NOW);
  assert.equal(indexed.indexable, true);
  const held = applySeoTier(base, SEO_TIER.HOLD_NOINDEX);
  assert.equal(held.seoTier, SEO_TIER.HOLD_NOINDEX);
  assert.equal(held.indexable, false);
});
