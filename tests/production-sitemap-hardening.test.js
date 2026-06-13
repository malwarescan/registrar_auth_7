const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildSitemapIndex,
  buildIndexedDomainSitemap,
  resolveDomainLastmod,
  SITEMAP_INDEX_CHILDREN,
} = require("../server/sitemap");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  upsertProductRecord,
  promoteCandidate,
  listSitemapCandidates,
  getDurableCandidateBySlug,
} = require("../server/candidate-store/durable-candidates");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const { resolveProductPageMode } = require("../server/candidate-store/product-lifecycle");
const { buildRobots } = require("../server/renderers/seo-renderer");
const { buildSeoRenderData } = require("../server/renderers/seo-renderer");
const { renderCandidatePageHtml } = require("../server/candidate-detail-page");

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

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-prod-sitemap-"));
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

test("production sitemap index references core intents and indexed domain sitemaps only", () => {
  const xml = buildSitemapIndex({ isProduction: true });
  assert.match(xml, /<sitemapindex/);
  assert.deepEqual(SITEMAP_INDEX_CHILDREN, [
    "/sitemap-core.xml",
    "/sitemap-intents.xml",
    "/sitemap-domains-indexed.xml",
  ]);
  for (const child of SITEMAP_INDEX_CHILDREN) {
    assert.match(xml, new RegExp(child.replace(/\./g, "\\.")));
  }
  assert.doesNotMatch(xml, /sitemap-domains-archive/);
});

test("domain sitemap lastmod prefers statusVerifiedAt", () => {
  const tempDir = makeTempStore();
  try {
    const record = seedFreshRecord("lastmod.com");
    record.publishedAt = "2020-01-01T00:00:00.000Z";
    record.updatedAt = "2021-01-01T00:00:00.000Z";
    record.statusVerifiedAt = "2026-06-12T12:00:00.000Z";
    upsertProductRecord(record);
    promoteCandidate("lastmod-com");
    assert.equal(resolveDomainLastmod(record), "2026-06-12T12:00:00.000Z");
    const xml = buildIndexedDomainSitemap({ isProduction: true });
    assert.match(xml, /<lastmod>2026-06-12T12:00:00.000Z<\/lastmod>/);
    assert.doesNotMatch(xml, /<lastmod>2020-01-01/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("listSitemapCandidates excludes hold-noindex and archive records", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("indexed.com");
    seedFreshRecord("hidden.com");
    promoteCandidate("indexed-com");
    upsertProductRecord({
      ...seedFreshRecord("ended.com"),
      status: "auction-ended",
      lifecycleState: "ended",
      seoTier: "archive",
      indexable: true,
    });
    const paths = listSitemapCandidates().map((r) => r.slug);
    assert.deepEqual(paths, ["indexed-com"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("promoted page canonicalizes to bare slug without query params", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("canonical.com");
    promoteCandidate("canonical-com");
    const bare = resolveDomainPage("canonical-com", {}, () => null);
    const html = renderCandidatePageHtml(bare.candidate, {}, {
      pageMode: bare.mode,
      indexable: true,
      record: bare.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /link rel="canonical" href="https:\/\/urlsnatcher\.com\/domains\/canonical-com"/);
    assert.doesNotMatch(html, /canonical" href="[^"]*\?/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("overlay page is noindex with bare canonical and unchanged product title", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("overlay.com");
    promoteCandidate("overlay-com");
    const bare = resolveDomainPage("overlay-com", {}, () => null);
    const overlay = resolveDomainPage("overlay-com", { intentId: "intent-qa" }, () => null);
    assert.equal(overlay.mode, "overlay");
    const bareSeo = buildSeoRenderData(bare.record, "active-indexed", { indexable: true });
    const overlaySeo = buildSeoRenderData(overlay.record, "overlay", { indexable: false });
    assert.equal(overlaySeo.title, bareSeo.title);
    assert.match(buildRobots(overlay.record, "overlay"), /^noindex,follow/);
    const html = renderCandidatePageHtml(overlay.candidate, {}, {
      pageMode: "overlay",
      indexable: false,
      record: overlay.record,
      intentRecord: { intentLabel: "AI Receptionist", intentSlug: "ai-receptionist" },
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.match(html, /link rel="canonical" href="https:\/\/urlsnatcher\.com\/domains\/overlay-com"/);
    assert.doesNotMatch(html, /intent_id/);
    assert.equal(listSitemapCandidates().some((r) => r.slug === "overlay-com"), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("expired short TTL keeps sitemap eligibility while statusVerifiedAt is recent", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("staleindexed.com");
    promoteCandidate("staleindexed-com");
    upsertProductRecord({
      ...getDurableCandidateBySlug("staleindexed-com"),
      statusExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    assert.equal(listSitemapCandidates().length, 1);

    const now = Date.now();
    upsertProductRecord({
      ...getDurableCandidateBySlug("staleindexed-com"),
      statusVerifiedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      statusExpiresAt: new Date(now - 60_000).toISOString(),
    });
    assert.equal(listSitemapCandidates({ now }).length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("robots policy by lifecycle and tier", () => {
  const activeIndexed = { slug: "a-com", domain: "a.com", status: "auction-active", seoTier: "index-now", indexable: true };
  const activeHold = { slug: "b-com", domain: "b.com", status: "auction-active", seoTier: "hold-noindex" };
  const ended = { slug: "c-com", domain: "c.com", status: "auction-ended", lifecycleState: "ended" };
  assert.match(buildRobots(activeIndexed, "active-indexed"), /^index,follow/);
  assert.match(buildRobots(activeHold, "active-noindex"), /^noindex,follow/);
  assert.match(buildRobots(activeHold, "overlay"), /^noindex,follow/);
  assert.match(buildRobots(ended, "ended"), /^noindex,follow/);
  assert.match(buildRobots(ended, "invalid"), /^noindex/);
  assert.equal(resolveProductPageMode(activeIndexed), "active-indexed");
  assert.equal(resolveProductPageMode(activeHold), "active-noindex");
  assert.equal(resolveProductPageMode(ended), "ended");
});
