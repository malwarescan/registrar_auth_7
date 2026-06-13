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
  promoteCandidate,
  listSitemapCandidates,
} = require("../server/candidate-store/durable-candidates");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const { getIndexedDomainSitemapPaths } = require("../server/sitemap");
const { buildDomainProductGraph } = require("../server/candidate-store/domain-graph");
const { renderCandidatePageHtml } = require("../server/candidate-detail-page");

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-lifecycle-"));
  const durablePath = path.join(tempDir, "durable-candidates.json");
  const publishedPath = path.join(tempDir, "published-candidates.json");
  const recordsDir = path.join(tempDir, "product-records");
  fs.writeFileSync(durablePath, "{}\n", "utf8");
  fs.writeFileSync(publishedPath, "[]\n", "utf8");
  fs.mkdirSync(recordsDir, { recursive: true });
  configureStorePaths({ durablePath, publishedPath, recordsDir });
  return tempDir;
}

function sampleAuction(domain, overrides = {}) {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    domain,
    root: domain.split(".")[0],
    tld: `.${domain.split(".").pop()}`,
    currentBid: 5,
    bidCount: 2,
    auctionEndsAt: future,
    auctionUrl: `https://www.namesilo.com/auctions/${domain}`,
    ...overrides,
  };
}

test.afterEach(() => resetStorePaths());

test("durable non-indexable record renders full product page with noindex", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("deskflow.com"));
    const resolved = resolveDomainPage("deskflow-com", {}, () => null);
    assert.equal(resolved.mode, "active-noindex");
    assert.equal(resolved.httpStatus, 200);
    const html = renderCandidatePageHtml(resolved.candidate, {}, {
      pageMode: resolved.mode,
      record: resolved.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /deskflow\.com — \.com Auction Domain \| Snatch\.auction/);
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.match(html, /View auction at NameSilo/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("indexable active page has index,follow", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("deskflow.com", { currentBid: 10 }));
    promoteCandidate("deskflow-com");
    const resolved = resolveDomainPage("deskflow-com", {}, () => null);
    assert.equal(resolved.mode, "active-indexed");
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

test("ended auction page renders 200 with disabled CTA", () => {
  const tempDir = makeTempStore();
  try {
    const record = upsertProductRecordFromAuction(
      sampleAuction("endeddesk.com", {
        auctionEndsAt: new Date(Date.now() - 3600000).toISOString(),
      })
    );
    assert.equal(record.status, "auction-ended");
    const resolved = resolveDomainPage("endeddesk-com", {}, () => null);
    assert.equal(resolved.mode, "ended");
    const html = renderCandidatePageHtml(resolved.candidate, {}, {
      pageMode: resolved.mode,
      record: resolved.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /Auction ended/);
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.doesNotMatch(html, /id="open-acquisition-path"/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sold and unavailable pages are removed from active sitemap", () => {
  const tempDir = makeTempStore();
  try {
    const active = upsertProductRecordFromAuction(sampleAuction("indexed.com", { currentBid: 10 }));
    promoteCandidate("indexed-com");
    upsertProductRecord({
      ...upsertProductRecordFromAuction(sampleAuction("soldlot.com")),
      lifecycleState: "sold",
      status: "auction-sold",
      indexable: false,
    });
    upsertProductRecord({
      ...upsertProductRecordFromAuction(
        sampleAuction("missing.com", {
          auctionEndsAt: new Date(Date.now() - 3600000).toISOString(),
        })
      ),
      lifecycleState: "unavailable",
    });

    const sitemapPaths = getIndexedDomainSitemapPaths();
    assert.ok(sitemapPaths.includes("/domains/indexed-com"));
    assert.equal(sitemapPaths.includes("/domains/soldlot-com"), false);
    assert.equal(sitemapPaths.includes("/domains/missing-com"), false);
    assert.equal(listSitemapCandidates().length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("overlay on indexable durable page stays noindex with bare canonical", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("overlayme.com", { currentBid: 10 }));
    promoteCandidate("overlayme-com");
    const base = resolveDomainPage("overlayme-com", {}, () => null);
    const resolved = resolveDomainPage("overlayme-com", { intentId: "intent-qa" }, () => null);
    assert.equal(resolved.mode, "overlay");
    const html = renderCandidatePageHtml(resolved.sessionCandidate, { intentId: "intent-qa" }, {
      pageMode: "overlay",
      baseCandidate: base.candidate,
      record: base.record,
      port: 4173,
      isProduction: false,
    });
    assert.match(html, /meta name="robots" content="noindex,follow/);
    assert.match(html, /link rel="canonical" href="https:\/\/snatch\.auction\/domains\/overlayme-com"/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("refresh updates bid and status without changing canonical URL", () => {
  const tempDir = makeTempStore();
  try {
    const first = upsertProductRecordFromAuction(sampleAuction("refreshme.com", { currentBid: 3, bidCount: 1 }));
    const canonical = first.canonicalUrl;
    const second = upsertProductRecordFromAuction(sampleAuction("refreshme.com", { currentBid: 9, bidCount: 4 }));
    assert.equal(second.canonicalUrl, canonical);
    assert.equal(second.currentBid, 9);
    assert.equal(second.bidCount, 4);
    assert.ok(second.statusVerifiedAt >= first.statusVerifiedAt);
    const graph = buildDomainProductGraph(second);
    assert.equal(graph.lifecycleState, "active");
    assert.equal(graph.currentBid, 9);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("sitemap only includes active indexable graph-complete records", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction(sampleAuction("visible.com", { currentBid: 10 }));
    upsertProductRecordFromAuction(sampleAuction("hidden.com", { currentBid: 2 }));
    promoteCandidate("visible-com");

    const paths = getIndexedDomainSitemapPaths();
    assert.ok(paths.includes("/domains/visible-com"));
    assert.equal(paths.includes("/domains/hidden-com"), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("dev map record resolves when bulk file missing", () => {
  const tempDir = makeTempStore();
  try {
    const mapOnly = {
      slug: "devonly-com",
      domain: "devonly.com",
      tld: ".com",
      source: "namesilo-auction",
      provider: "NameSilo",
      status: "auction-active",
      lifecycleState: "active",
      auctionUrl: "https://www.namesilo.com/auctions/devonly.com",
      currentBid: 2,
      bidCount: 1,
      auctionEndsAt: new Date(Date.now() + 86400000).toISOString(),
      statusVerifiedAt: new Date().toISOString(),
      statusExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      canonicalUrl: "https://snatch.auction/domains/devonly-com",
      acquisitionPath: {
        type: "auction",
        provider: "NameSilo",
        priceCurrency: "USD",
        currentBid: 2,
        actionUrl: "https://www.namesilo.com/auctions/devonly.com",
      },
      baseScores: { overall: 70, brandability: 70, tldTrust: 90 },
      categoryGuesses: ["software"],
      buyerUseCases: ["startup"],
      graphId: "https://snatch.auction/domains/devonly-com#graph",
      candidateId: "product_devonly-com",
      published: false,
      indexable: false,
    };
    fs.writeFileSync(path.join(tempDir, "durable-candidates.json"), `${JSON.stringify({ "devonly-com": mapOnly }, null, 2)}\n`);
    configureStorePaths({
      durablePath: path.join(tempDir, "durable-candidates.json"),
      publishedPath: path.join(tempDir, "published-candidates.json"),
      recordsDir: path.join(tempDir, "product-records"),
    });
    const resolved = resolveDomainPage("devonly-com", {}, () => null);
    assert.equal(resolved.mode, "active-noindex");
    assert.equal(resolved.record.domain, "devonly.com");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
