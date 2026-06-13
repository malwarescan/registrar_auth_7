const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  listDurableCandidates,
  promoteCandidate,
} = require("../server/candidate-store/durable-candidates");
const { buildDomainProductGraph } = require("../server/candidate-store/domain-graph");
const {
  buildSeoTitle,
  buildSeoDescription,
  buildSeoJsonLd,
  buildSeoRenderData,
} = require("../server/renderers/seo-renderer");
const { renderProductRecordApi, renderProductGraphApi } = require("../server/renderers/api-renderer");
const {
  renderDomainFeedNdjson,
  renderDomainFeedJson,
  renderDatasetMetadata,
} = require("../server/renderers/feed-renderer");
const { buildIntentOverlay } = require("../server/renderers/overlay-renderer");
const { buildCandidateJsonLd, renderIntentOverlayPage } = require("../server/candidate-detail-page");
const { productRecordToCandidate } = require("../server/candidate-store/product-record");
const { createIntentRecord } = require("../server/domain-fetch/intent-session");

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-renderers-"));
  const durablePath = path.join(tempDir, "durable-candidates.json");
  const publishedPath = path.join(tempDir, "published-candidates.json");
  const recordsDir = path.join(tempDir, "product-records");
  fs.writeFileSync(durablePath, "{}\n", "utf8");
  fs.writeFileSync(publishedPath, "[]\n", "utf8");
  fs.mkdirSync(recordsDir, { recursive: true });
  configureStorePaths({ durablePath, publishedPath, recordsDir });
  return tempDir;
}

function sampleAuction(domain = "anudesk.com") {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    domain,
    root: domain.split(".")[0],
    tld: `.${domain.split(".").pop()}`,
    currentBid: 5,
    bidCount: 1,
    auctionEndsAt: future,
    auctionUrl: `https://www.namesilo.com/auctions/${domain}`,
  };
}

test.afterEach(() => resetStorePaths());

test("product record does not contain SEO title or meta fields", () => {
  const tempDir = makeTempStore();
  try {
    const record = upsertProductRecordFromAuction(sampleAuction());
    assert.equal(record.pageTitle, undefined);
    assert.equal(record.metaDescription, undefined);
    assert.equal(record.seoTitle, undefined);
    assert.equal(record.sessionRank, undefined);
    assert.equal(record.intentLabel, undefined);
    assert.equal(record.alternatives, undefined);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("SEO renderer builds canonical title without intent label", () => {
  const record = {
    domain: "anudesk.com",
    slug: "anudesk-com",
    tld: ".com",
  };
  assert.equal(buildSeoTitle(record, "canonical"), "anudesk.com — .com Auction Domain | Snatch.auction");
  assert.doesNotMatch(buildSeoTitle(record, "canonical"), /Receptionist|Candidate/i);
  assert.match(
    buildSeoDescription(record, "canonical"),
    /anudesk\.com is a \.com auction domain available through NameSilo/
  );
});

test("overlay renderer includes intent label but does not change SEO title", () => {
  const record = upsertProductRecordFromAuction(sampleAuction());
  const intentRecord = createIntentRecord({
    brief: "AI Receptionist",
    interpretedIntent: { productCategory: "AI Software", targetBuyer: ["ops teams"] },
    strategy: { primaryIntent: "ai-software" },
    fetchedAt: new Date().toISOString(),
    requestId: "req-overlay-test",
  });
  const sessionCandidate = productRecordToCandidate(record);
  sessionCandidate.sessionRank = 1;
  const overlay = buildIntentOverlay(record, intentRecord, sessionCandidate, { rank: 1, fitScore: 76 });
  const seo = buildSeoRenderData(record, "overlay");
  assert.match(overlay.bannerHtml, /Recommended for AI Receptionist/);
  assert.match(seo.title, /Auction Domain \| Snatch\.auction/);
  assert.doesNotMatch(seo.title, /AI Receptionist Domain Candidate/i);
});

test("buildSeoJsonLd uses graph builder output", () => {
  const record = upsertProductRecordFromAuction(sampleAuction());
  const graph = buildDomainProductGraph(record);
  const seoJsonLd = buildSeoJsonLd(record, "canonical");
  assert.equal(seoJsonLd["@context"], "https://schema.org");
  assert.ok(Array.isArray(seoJsonLd["@graph"]));
  const graphTypes = new Set(graph["@graph"].map((node) => node["@type"]));
  const seoTypes = new Set(seoJsonLd["@graph"].map((node) => node["@type"]));
  for (const type of ["Organization", "WebSite", "WebPage", "BreadcrumbList", "Product", "Offer"]) {
    assert.ok(graphTypes.has(type), `full graph includes ${type}`);
    assert.ok(seoTypes.has(type), `seo subset includes ${type}`);
  }
  assert.ok(graph["@graph"].length > seoJsonLd["@graph"].length);
});

test("buildCandidateJsonLd canonicalMode delegates to SEO renderer graph", () => {
  const record = upsertProductRecordFromAuction(sampleAuction());
  const candidate = productRecordToCandidate(record);
  const jsonLd = buildCandidateJsonLd(
    candidate,
    record.canonicalUrl,
    "https://urlsnatcher.com/domain-assets/anudesk-com.png",
    false,
    [],
    { canonicalMode: true, record, indexable: true, metadataBaseUrl: "https://urlsnatcher.com" }
  );
  const direct = buildSeoJsonLd(record, "canonical", {
    metadataBaseUrl: "https://urlsnatcher.com",
    ogImage: "https://urlsnatcher.com/domain-assets/anudesk-com.png",
  });
  assert.deepEqual(jsonLd["@graph"].map((node) => node["@type"]).sort(), direct["@graph"].map((node) => node["@type"]).sort());
});

test("API renderer includes full graph", () => {
  const record = upsertProductRecordFromAuction(sampleAuction());
  const apiRecord = renderProductRecordApi(record);
  const apiGraph = renderProductGraphApi(record);
  assert.equal(apiRecord.record.domain, "anudesk.com");
  assert.ok(apiGraph["@graph"].some((node) => node["@type"] === "DefinedTerm" || node["@type"] === "PropertyValue" || node["@type"] === "Product"));
  assert.equal(apiGraph.slug, "anudesk-com");
});

test("feed renderer emits all durable records including unpromoted", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("anudesk.com"));
    upsertProductRecordFromAuction(sampleAuction("legalai.com"));
    const records = listDurableCandidates();
    const ndjson = renderDomainFeedNdjson(records);
    const json = renderDomainFeedJson(records);
    const metadata = renderDatasetMetadata(records);
    assert.equal(ndjson.length, 2);
    assert.equal(json.count, 2);
    assert.equal(metadata.numberOfItems, 2);
    assert.equal(records.every((record) => record.indexable === false), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("canonical promoted page still index/follow and overlay page noindex with bare canonical", () => {
  const tempDir = makeTempStore();
  try {
    const record = upsertProductRecordFromAuction(sampleAuction());
    promoteCandidate("anudesk-com");
    const candidate = productRecordToCandidate(record);
    const promotedSeo = buildSeoRenderData({ ...record, published: true, indexable: true }, "canonical", { indexable: true });
    assert.match(promotedSeo.robots, /^index,follow/);

    const intentRecord = createIntentRecord({
      brief: "AI Receptionist",
      interpretedIntent: { productCategory: "AI Software", targetBuyer: ["ops teams"] },
      strategy: { primaryIntent: "ai-software" },
      fetchedAt: new Date().toISOString(),
      requestId: "req-overlay-canonical",
    });
    const sessionCandidate = { ...candidate, sessionRank: 1, scores: candidate.scores };
    const html = renderIntentOverlayPage(candidate, sessionCandidate, { intentId: intentRecord.intentId, rank: 1, fitScore: 76 }, {
      record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.match(html, /link rel="canonical" href="https:\/\/urlsnatcher\.com\/domains\/anudesk-com"/);
    assert.match(html, /<title>anudesk\.com — \.com Auction Domain \| Snatch\.auction<\/title>/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
