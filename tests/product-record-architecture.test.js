const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ingestNameSiloAuctionPage } = require("../server/candidate-store/auction-ingest");
const {
  configureStorePaths,
  resetStorePaths,
  upsertProductRecordFromAuction,
  getDurableCandidateBySlug,
  listDurableCandidates,
  promoteCandidate,
} = require("../server/candidate-store/durable-candidates");
const { buildDomainProductGraph } = require("../server/candidate-store/domain-graph");
const { validatePromotionGate } = require("../server/candidate-store/promotion-gate");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const { buildStableSitemapPaths } = require("../server/sitemap");
const { renderCandidatePageHtml } = require("../server/candidate-detail-page");

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-product-"));
  const durablePath = path.join(tempDir, "durable-candidates.json");
  const publishedPath = path.join(tempDir, "published-candidates.json");
  const recordsDir = path.join(tempDir, "product-records");
  fs.writeFileSync(durablePath, "{}\n", "utf8");
  fs.writeFileSync(publishedPath, "[]\n", "utf8");
  fs.mkdirSync(recordsDir, { recursive: true });
  configureStorePaths({ durablePath, publishedPath, recordsDir });
  return { tempDir, durablePath, publishedPath, recordsDir };
}

function sampleAuction(domain, overrides = {}) {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    domain,
    root: domain.split(".")[0],
    tld: `.${domain.split(".").pop()}`,
    currentBid: 5,
    bidCount: 1,
    auctionEndsAt: future,
    auctionUrl: `https://www.namesilo.com/auctions/${domain}`,
    ...overrides,
  };
}

function mockFetch(auctionsByPage) {
  return async (url) => {
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get("page") || 1);
    const body = auctionsByPage[page] || [];
    return {
      ok: true,
      async json() {
        return { reply: { code: 300, body } };
      },
    };
  };
}

test.afterEach(() => resetStorePaths());

test("ingest creates durable product records that are not indexable by default", async () => {
  const { tempDir } = makeTempStore();
  try {
    await ingestNameSiloAuctionPage({
      apiKey: "test-key",
      page: 1,
      pageSize: 200,
      fetchFn: mockFetch({
        1: [
          { domain: "anudesk.com", currentBid: 1, bidsQuantity: 1, auctionEndsOnUtc: new Date(Date.now() + 86400000).toISOString(), url: "https://www.namesilo.com/auctions/anudesk.com" },
          { domain: "legalai.com", currentBid: 2, bidsQuantity: 1, auctionEndsOnUtc: new Date(Date.now() + 86400000).toISOString(), url: "https://www.namesilo.com/auctions/legalai.com" },
        ],
      }),
    });
    const records = listDurableCandidates();
    assert.equal(records.length, 2);
    assert.equal(records.every((record) => record.published === false && record.indexable === false), true);
    assert.equal(records.every((record) => record.graphId?.includes("#graph")), true);
    assert.equal(records.every((record) => Array.isArray(record.categoryGuesses) && record.categoryGuesses.length > 0), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("graph JSON exists for durable records", () => {
  const { tempDir } = makeTempStore();
  try {
    const record = upsertProductRecordFromAuction(sampleAuction("anudesk.com"));
    const graph = buildDomainProductGraph(record);
    assert.ok(graph["@graph"].some((node) => node["@type"] === "Product"));
    assert.ok(graph["@graph"].some((node) => node["@type"] === "Offer"));
    assert.equal(graph.slug, "anudesk-com");
    assert.equal(graph.indexable, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("unpublished durable records resolve to noindex product pages", () => {
  const { tempDir } = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("anudesk.com"));
    const resolved = resolveDomainPage("anudesk-com", {}, () => null);
    assert.equal(resolved.mode, "active-noindex");
    assert.equal(resolved.indexable, false);
    const html = renderCandidatePageHtml(resolved.candidate, {}, {
      pageMode: resolved.mode,
      indexable: false,
      record: resolved.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.match(html, /anudesk\.com — \.com Auction Domain \| Snatch\.auction/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("promoted records render indexable and appear in sitemap only when published", () => {
  const { tempDir } = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("anudesk.com", { currentBid: 10 }));
    assert.equal(validatePromotionGate(getDurableCandidateBySlug("anudesk-com")), null);
    promoteCandidate("anudesk-com");
    const resolved = resolveDomainPage("anudesk-com", {}, () => null);
    assert.equal(resolved.mode, "active-indexed");
    assert.equal(resolved.indexable, true);
    assert.ok(buildStableSitemapPaths().includes("/domains/anudesk-com"));
    const html = renderCandidatePageHtml(resolved.candidate, {}, {
      pageMode: resolved.mode,
      indexable: true,
      record: resolved.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /meta name="robots" content="index,follow/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ingested records exclude session intent identity", () => {
  const { tempDir } = makeTempStore();
  try {
    const record = upsertProductRecordFromAuction(sampleAuction("anudesk.com"));
    assert.equal(record.intentId, undefined);
    assert.equal(record.intentLabel, undefined);
    assert.equal(record.sessionRank, undefined);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
