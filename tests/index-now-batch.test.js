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

const ROOT = path.resolve(__dirname, "..");
const batchPath = path.join(ROOT, "data", "index-now-batch.json");
const publishedPath = path.join(ROOT, "data", "published-candidates.json");

test.afterEach(() => resetStorePaths());

test("index-now batch file exists for production deploy", () => {
  assert.ok(fs.existsSync(batchPath), "Run node scripts/export-index-now-batch.js before deploy");
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
  const published = JSON.parse(fs.readFileSync(publishedPath, "utf8"));
  assert.equal(Object.keys(batch).length, published.length);
});

test("batch-only store mode serves sitemap candidates", () => {
  configureStorePaths({ indexNowBatchPath: batchPath });
  const candidates = listSitemapCandidates({ isProduction: true });
  assert.equal(candidates.length, 500);
  const first = getDurableCandidateBySlug(candidates[0].slug);
  assert.equal(first.seoTier, "index-now");
  assert.ok(new Date(first.statusExpiresAt).getTime() > Date.now());
});

test("batch-only store builds non-empty domain sitemap xml", () => {
  configureStorePaths({ indexNowBatchPath: batchPath });
  const xml = buildIndexedDomainSitemap({ isProduction: true });
  assert.match(xml, /<urlset/);
  assert.match(xml, /<loc>https:\/\/urlsnatcher\.com\/domains\//);
  assert.doesNotMatch(xml, /<urlset[^>]*>\s*<\/urlset>/);
  assert.equal((xml.match(/<url>/g) || []).length, 500);
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

test("configureDefaultProductStore falls back to index-now batch without product-records", () => {
  resetStorePaths();
  const mode = configureDefaultProductStore();
  if (fs.existsSync(path.join(ROOT, "data", "product-records"))) {
    assert.equal(mode, "product-records");
  } else if (fs.existsSync(batchPath)) {
    assert.equal(mode, "index-now-batch");
    assert.ok(listSitemapCandidates({ isProduction: true }).length > 0);
  } else {
    assert.equal(mode, "durable-map");
  }
  resetStorePaths();
});
