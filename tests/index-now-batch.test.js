const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  configureStorePaths,
  resetStorePaths,
  listSitemapCandidates,
  getDurableCandidateBySlug,
} = require("../server/candidate-store/durable-candidates");
const { configureDefaultProductStore, INDEX_NOW_BATCH_PATH } = require("../server/candidate-store/store-paths");
const { buildIndexedDomainSitemap } = require("../server/sitemap");

const {
  SNAPSHOT_PATH,
  SNAPSHOT_FIELDS,
  readSnapshotFile,
  buildAuctionStore,
  installAuctionStore,
} = require("../server/candidate-store/auction-snapshot");

const ROOT = path.resolve(__dirname, "..");

test.afterEach(() => resetStorePaths());

// Production ships the NameSilo auction snapshot (the old June 2026
// data/index-now-batch.json sample has been retired).
test("auction snapshot file exists for production deploy", () => {
  assert.ok(fs.existsSync(SNAPSHOT_PATH), "Run node scripts/build-auction-snapshot.js before deploy");
  const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  assert.deepEqual(raw.fields, SNAPSHOT_FIELDS);
  assert.equal(raw.rows.length, raw.count);
  assert.ok(raw.count > 0);
  assert.ok(readSnapshotFile().fetchedAt);
});

function futureBatch() {
  const fetchedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ends = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  const raw = ["kettleskin.com", "healridge.com", "cottagebar.com", "23aqyfe2.com"].map((domain) => ({
    domain,
    openingBid: 1,
    currentBid: 1,
    bidsQuantity: 1,
    auctionEndsOnUtc: ends,
  }));
  return installAuctionStore(buildAuctionStore(raw, { fetchedAt }));
}

test("batch-only store mode serves sitemap candidates", () => {
  const meta = futureBatch();
  const candidates = listSitemapCandidates({ isProduction: true });
  assert.equal(candidates.length, meta.indexedCount);
  assert.equal(candidates.length, 3);
  const first = getDurableCandidateBySlug(candidates[0].slug);
  assert.equal(first.seoTier, "index-now");
  assert.ok(new Date(first.statusExpiresAt).getTime() > Date.now());
});

test("batch-only store builds non-empty domain sitemap xml", () => {
  futureBatch();
  const xml = buildIndexedDomainSitemap({ isProduction: true });
  assert.match(xml, /<urlset/);
  assert.match(xml, /<loc>https:\/\/urlsnatcher\.com\/domains\//);
  assert.doesNotMatch(xml, /<urlset[^>]*>\s*<\/urlset>/);
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.doesNotMatch(xml, /23aqyfe2/);
});

test("configureDefaultProductStore prefers product-records when present", () => {
  const tempDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "snatch-store-pref-"));
  try {
    const recordsDir = path.join(tempDir, "product-records");
    fs.mkdirSync(recordsDir);
    fs.writeFileSync(path.join(recordsDir, "alpha-com.json"), JSON.stringify({ slug: "alpha-com", domain: "alpha.com" }));
    const { configureStorePaths: configure } = require("../server/candidate-store/durable-candidates");
    configure({ recordsDir });
    assert.equal(getDurableCandidateBySlug("alpha-com")?.domain, "alpha.com");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    resetStorePaths();
  }
});

test("configureDefaultProductStore falls back to the auction snapshot without product-records", () => {
  resetStorePaths();
  const mode = configureDefaultProductStore();
  if (fs.existsSync(path.join(ROOT, "data", "product-records"))) {
    assert.equal(mode, "product-records");
  } else if (fs.existsSync(SNAPSHOT_PATH)) {
    assert.equal(mode, "auction-snapshot");
    assert.ok(getDurableCandidateBySlug(readSnapshotFile().auctions[0].domain.replace(/\./g, "-")));
  } else if (fs.existsSync(INDEX_NOW_BATCH_PATH)) {
    assert.equal(mode, "index-now-batch");
  } else {
    assert.equal(mode, "durable-map");
  }
  resetStorePaths();
});
