const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildSitemapIndex,
  buildCoreSitemap,
  buildIntentSitemap,
  buildIndexedDomainSitemap,
  getCoreSitemapPaths,
  getIndexedDomainSitemapPaths,
  SITEMAP_INDEX_CHILDREN,
} = require("../server/sitemap");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  upsertProductRecord,
  promoteCandidate,
  listDurableCandidates,
} = require("../server/candidate-store/durable-candidates");

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

function seedFreshRecord(domain) {
  const record = upsertProductRecordFromAuction(sampleAuction(domain));
  const now = Date.now();
  record.statusVerifiedAt = new Date(now).toISOString();
  record.statusExpiresAt = new Date(now + 15 * 60 * 1000).toISOString();
  record.baseScores = { ...record.baseScores, overall: 72 };
  if (!record.categoryGuesses?.length) record.categoryGuesses = ["Commercial software"];
  if (!record.buyerUseCases?.length) record.buyerUseCases = ["Commercial software brand"];
  upsertProductRecord(record);
  return record;
}

test.afterEach(() => resetStorePaths());

test("sitemap index lists sub-sitemaps only", () => {
  const xml = buildSitemapIndex({ port: 4173, isProduction: false });
  assert.match(xml, /<sitemapindex/);
  assert.doesNotMatch(xml, /<urlset/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  for (const loc of locs) {
    assert.match(loc, /\.xml$/);
    assert.doesNotMatch(loc, /\/experiments\//);
  }
  for (const child of SITEMAP_INDEX_CHILDREN) {
    assert.match(xml, new RegExp(child.replace(".", "\\.")));
  }
  assert.equal((xml.match(/<sitemap>/g) || []).length, 3);
});

test("core sitemap contains core URLs in urlset", () => {
  const xml = buildCoreSitemap({ port: 4173, isProduction: false });
  assert.match(xml, /<urlset/);
  assert.doesNotMatch(xml, /<sitemapindex/);
  const paths = getCoreSitemapPaths();
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/experiments/intent-fetch/"));
  assert.ok(paths.includes("/methodology/"));
  assert.ok(paths.includes("/data/domain-listings"));
  assert.equal(paths.includes("/experiments/auction-radar/"), false);
  for (const pathname of paths) {
    assert.match(xml, new RegExp(pathname.replace(/\//g, "\\/")));
  }
});

test("intent sitemap uses urlset without query params", () => {
  const xml = buildIntentSitemap({ port: 4173, isProduction: false });
  assert.match(xml, /<urlset/);
  assert.doesNotMatch(xml, /<loc>[^<]*\?[^<]*<\/loc>/);
});

test("domain sitemap contains active indexable records only", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-sitemap-domains-"));
  try {
    const durablePath = path.join(tempDir, "durable-candidates.json");
    const publishedPath = path.join(tempDir, "published-candidates.json");
    const recordsDir = path.join(tempDir, "product-records");
    fs.writeFileSync(durablePath, "{}\n", "utf8");
    fs.writeFileSync(publishedPath, "[]\n", "utf8");
    fs.mkdirSync(recordsDir, { recursive: true });
    configureStorePaths({ durablePath, publishedPath, recordsDir });

    seedFreshRecord("indexedwinner.com");
    seedFreshRecord("hiddenlot.com");
    promoteCandidate("indexedwinner-com");

    upsertProductRecord({
      ...seedFreshRecord("endedlot.com"),
      status: "auction-ended",
      lifecycleState: "ended",
      indexable: true,
    });
    upsertProductRecord({
      ...seedFreshRecord("soldlot.com"),
      status: "auction-sold",
      lifecycleState: "sold",
      indexable: true,
    });

    const paths = getIndexedDomainSitemapPaths();
    assert.deepEqual(paths, ["/domains/indexedwinner-com"]);
    assert.equal(paths.some((entry) => entry.includes("?")), false);

    const xml = buildIndexedDomainSitemap({ port: 4173, isProduction: false });
    assert.match(xml, /indexedwinner-com/);
    assert.doesNotMatch(xml, /hiddenlot-com/);
    assert.doesNotMatch(xml, /endedlot-com/);
    assert.doesNotMatch(xml, /soldlot-com/);
    assert.doesNotMatch(xml, /<loc>[^<]*intent_id[^<]*<\/loc>/);
    assert.doesNotMatch(xml, /<loc>[^<]*\?[^<]*<\/loc>/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("unpromoted durable records are excluded from domain sitemap", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-sitemap-bulk-"));
  try {
    const durablePath = path.join(tempDir, "durable-candidates.json");
    const publishedPath = path.join(tempDir, "published-candidates.json");
    const recordsDir = path.join(tempDir, "product-records");
    fs.writeFileSync(durablePath, "{}\n", "utf8");
    fs.writeFileSync(publishedPath, "[]\n", "utf8");
    fs.mkdirSync(recordsDir, { recursive: true });
    configureStorePaths({ durablePath, publishedPath, recordsDir });

    for (let index = 0; index < 12; index += 1) {
      seedFreshRecord(`bulk${index}.com`);
    }
    const paths = getIndexedDomainSitemapPaths();
    assert.equal(paths.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("archived sold and unavailable records are excluded", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-sitemap-lifecycle-"));
  try {
    const durablePath = path.join(tempDir, "durable-candidates.json");
    const publishedPath = path.join(tempDir, "published-candidates.json");
    const recordsDir = path.join(tempDir, "product-records");
    fs.writeFileSync(durablePath, "{}\n", "utf8");
    fs.writeFileSync(publishedPath, "[]\n", "utf8");
    fs.mkdirSync(recordsDir, { recursive: true });
    configureStorePaths({ durablePath, publishedPath, recordsDir });

    seedFreshRecord("activewinner.com");
    promoteCandidate("activewinner-com");

    upsertProductRecord({
      ...seedFreshRecord("soldlot.com"),
      lifecycleState: "sold",
      status: "auction-sold",
      indexable: true,
    });
    upsertProductRecord({
      ...seedFreshRecord("unavail.com"),
      lifecycleState: "unavailable",
      indexable: true,
    });
    upsertProductRecord({
      ...seedFreshRecord("ended.com"),
      status: "auction-ended",
      lifecycleState: "ended",
      indexable: true,
    });

    const paths = getIndexedDomainSitemapPaths();
    assert.deepEqual(paths, ["/domains/activewinner-com"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sitemap URLs are deduplicated", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-sitemap-dedupe-"));
  try {
    const durablePath = path.join(tempDir, "durable-candidates.json");
    const publishedPath = path.join(tempDir, "published-candidates.json");
    const recordsDir = path.join(tempDir, "product-records");
    fs.writeFileSync(durablePath, "{}\n", "utf8");
    fs.writeFileSync(publishedPath, "[]\n", "utf8");
    fs.mkdirSync(recordsDir, { recursive: true });
    configureStorePaths({ durablePath, publishedPath, recordsDir });

    seedFreshRecord("dedupe.com");
    promoteCandidate("dedupe-com");

    const xml = buildIndexedDomainSitemap({ port: 4173, isProduction: false });
    const matches = xml.match(/dedupe-com/g) || [];
    assert.equal(matches.length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
