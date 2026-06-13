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
  getDurableCandidateBySlug,
} = require("../server/candidate-store/durable-candidates");
const { listListingCandidates } = require("../server/candidate-store/listing-feed");
const { resolveListingScope } = require("../server/candidate-store/feed-guard");
const { renderDomainListing } = require("../server/renderers/listings-renderer");
const { buildGraphFeedRecord } = require("../server/renderers/graph-feed-renderer");
const { NDJSON_INLINE_HEADERS, JSON_INLINE_HEADERS } = require("../server/renderers/feed-headers");
const {
  handleDomainListingsNdjson,
  handleDomainListingsJson,
  handleDomainFeedNdjson,
  handleDomainFeedJson,
  handleDomainGraphNdjson,
  handleDomainListingsDatasetJson,
} = require("../api/domain-product");

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
  record.baseScores = { ...record.baseScores, overall: 72, tldTrust: 96, brandability: 75, pronounceability: 78 };
  if (!record.categoryGuesses?.length) record.categoryGuesses = ["Commercial software"];
  if (!record.buyerUseCases?.length) record.buyerUseCases = ["Commercial software brand"];
  upsertProductRecord(record);
  return record;
}

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-listings-feed-"));
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

function seedScopeFixtures() {
  seedFreshRecord("indexedwinner.com");
  seedFreshRecord("hiddenactive.com");
  promoteCandidate("indexedwinner-com");
  upsertProductRecord({
    ...seedFreshRecord("archivedlot.com"),
    status: "auction-ended",
    lifecycleState: "ended",
    seoTier: "archive",
    indexable: false,
  });
}

function collectNdjson(res) {
  let body = "";
  let status = 200;
  let headers = null;
  res.writeHead = (code, nextHeaders) => {
    status = code;
    headers = nextHeaders;
  };
  res.write = (chunk) => {
    body += chunk;
  };
  res.end = (chunk) => {
    if (chunk) body += chunk;
  };
  return {
    res,
    getStatus() {
      return status;
    },
    getHeaders() {
      return headers;
    },
    parse() {
      return body
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

function collectJson(res) {
  let body = "";
  let status = 200;
  let headers = null;
  const response = {
    writeHead(code, nextHeaders) {
      status = code;
      headers = nextHeaders;
    },
    end(payload) {
      body = payload;
    },
    getStatus() {
      return status;
    },
    getHeaders() {
      return headers;
    },
    parse() {
      return JSON.parse(body);
    },
  };
  return response;
}

test.afterEach(() => resetStorePaths());

test("resolveListingScope defaults to indexed", () => {
  assert.equal(resolveListingScope({}), "indexed");
  assert.equal(resolveListingScope({ scope: "active" }), "active");
  assert.equal(resolveListingScope({ scope: "archive" }), "archive");
  assert.equal(resolveListingScope({ scope: "invalid" }), "indexed");
});

test("listings NDJSON default returns indexed records only", () => {
  const tempDir = makeTempStore();
  try {
    seedScopeFixtures();
    const sink = collectNdjson({});
    handleDomainListingsNdjson({ headers: { accept: "*/*" } }, sink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
    });
    assert.deepEqual(sink.getHeaders(), NDJSON_INLINE_HEADERS);
    const lines = sink.parse();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].slug, "indexedwinner-com");
    assert.equal(lines[0].seoTier, "index-now");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("scope=active includes active hold-noindex listings", () => {
  const tempDir = makeTempStore();
  try {
    seedScopeFixtures();
    const active = listListingCandidates("active").map((record) => record.slug).sort();
    assert.deepEqual(active, ["hiddenactive-com", "indexedwinner-com"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("scope=archive includes archive listings", () => {
  const tempDir = makeTempStore();
  try {
    seedScopeFixtures();
    const archive = listListingCandidates("archive").map((record) => record.slug);
    assert.deepEqual(archive, ["archivedlot-com"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("listing feed excludes overlays and query URLs", () => {
  const tempDir = makeTempStore();
  try {
    seedScopeFixtures();
    const sink = collectNdjson({});
    handleDomainListingsNdjson({ headers: { accept: "*/*" } }, sink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "active" },
    });
    for (const listing of sink.parse()) {
      assert.doesNotMatch(listing.url, /\?/);
      assert.doesNotMatch(listing.canonicalUrl, /\?/);
      assert.doesNotMatch(listing.url, /intent_id/);
      assert.equal(listing.intentId, undefined);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("listing feed record has canonical URL and graph URL", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("listingshape.com");
    promoteCandidate("listingshape-com");
    const listing = renderDomainListing(getDurableCandidateBySlug("listingshape-com"), "https://urlsnatcher.com");
    assert.equal(listing.type, "DomainListing");
    assert.equal(listing.canonicalUrl, "https://urlsnatcher.com/domains/listingshape-com");
    assert.equal(listing.graphUrl, "https://urlsnatcher.com/api/domains/listingshape-com/graph.json");
    assert.match(listing.robots, /^index,follow/);
    assert.equal(typeof listing.auction.url, "string");
    assert.ok(Array.isArray(listing.categoryGuesses));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("JSON listings defaults to limit 1000", () => {
  const tempDir = makeTempStore();
  try {
    for (let index = 0; index < 5; index += 1) {
      seedFreshRecord(`jsonlimit${index}.com`);
      promoteCandidate(`jsonlimit${index}-com`);
    }
    const res = collectJson({});
    handleDomainListingsJson({ headers: { accept: "*/*" } }, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed" },
      isProduction: true,
    });
    assert.deepEqual(res.getHeaders(), JSON_INLINE_HEADERS);
    const payload = res.parse();
    assert.equal(payload.count, 5);
    assert.equal(payload.limit, 1000);
    assert.equal(payload.scope, "indexed");
    assert.equal(payload.truncated, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("JSON listings honors explicit limit and marks truncated", () => {
  const tempDir = makeTempStore();
  try {
    for (let index = 0; index < 5; index += 1) {
      seedFreshRecord(`jsontrunc${index}.com`);
      promoteCandidate(`jsontrunc${index}-com`);
    }
    const res = collectJson({});
    handleDomainListingsJson({ headers: { accept: "*/*" } }, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed", limit: "2" },
      isProduction: true,
    });
    assert.deepEqual(res.getHeaders(), JSON_INLINE_HEADERS);
    const payload = res.parse();
    assert.equal(payload.count, 2);
    assert.equal(payload.limit, 2);
    assert.equal(payload.truncated, true);
    assert.equal(payload.totalAvailable, 5);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("full JSON export remains guarded in production", () => {
  const tempDir = makeTempStore();
  try {
    for (let index = 0; index < 3; index += 1) {
      seedFreshRecord(`fullguard${index}.com`);
      promoteCandidate(`fullguard${index}-com`);
    }
    const res = collectJson({});
    handleDomainListingsJson({ headers: { accept: "*/*" } }, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed", all: "true" },
      isProduction: true,
      allowFullFeed: false,
    });
    assert.deepEqual(res.getHeaders(), JSON_INLINE_HEADERS);
    const payload = res.parse();
    assert.equal(payload.allRequested, true);
    assert.equal(payload.allAllowed, false);
    assert.equal(payload.truncated, true);
    assert.equal(payload.limit, 1000);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("catalog NDJSON and JSON feeds use inline headers", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("inlinefeed.com");
    const ndjsonSink = collectNdjson({});
    handleDomainFeedNdjson({ headers: { accept: "*/*" } }, ndjsonSink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
    });
    assert.deepEqual(ndjsonSink.getHeaders(), NDJSON_INLINE_HEADERS);

    const jsonRes = collectJson({});
    handleDomainFeedJson({ headers: { accept: "*/*" } }, jsonRes, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
      isProduction: false,
    });
    assert.deepEqual(jsonRes.getHeaders(), JSON_INLINE_HEADERS);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("graph NDJSON feed emits marketplace graph records with inline headers", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("graphfeed.com");
    const sink = collectNdjson({});
    handleDomainGraphNdjson({ headers: { accept: "*/*" } }, sink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
    });
    assert.deepEqual(sink.getHeaders(), NDJSON_INLINE_HEADERS);
    const lines = sink.parse();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].type, "MarketplaceGraphRecord");
    assert.equal(lines[0].slug, "graphfeed-com");
    assert.ok(lines[0].nodes.some((node) => node.type === "Domain"));
    assert.ok(lines[0].nodes.some((node) => node.type === "Offer"));
    assert.ok(lines[0].edges.length > 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("graph feed record includes typed marketplace nodes", () => {
  const tempDir = makeTempStore();
  try {
    const record = seedFreshRecord("graphnodes.com");
    record.categoryGuesses = ["Workflow software"];
    record.buyerUseCases = ["Customer intake"];
    record.comparableDomains = ["deskflow.com"];
    upsertProductRecord(record);
    const graphLine = buildGraphFeedRecord(record, "https://urlsnatcher.com");
    assert.equal(graphLine.type, "MarketplaceGraphRecord");
    assert.ok(graphLine.nodes.some((node) => node.type === "Category"));
    assert.ok(graphLine.nodes.some((node) => node.type === "UseCase"));
    assert.ok(graphLine.nodes.some((node) => node.type === "TLD"));
    assert.ok(graphLine.nodes.some((node) => node.type === "Provider"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("browser navigation renders HTML feed preview instead of download", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("browserfeed.com");
    promoteCandidate("browserfeed-com");
    let body = "";
    let headers = null;
    const res = {
      writeHead(_code, nextHeaders) {
        headers = nextHeaders;
      },
      end(payload) {
        body = payload;
      },
    };
    handleDomainListingsNdjson(
      { headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } },
      res,
      { metadataBaseUrl: "https://urlsnatcher.com", query: {} }
    );
    assert.equal(headers["Content-Type"], "text/html; charset=utf-8");
    assert.match(body, /<title>Domain Listings Feed<\/title>/);
    assert.match(body, /browserfeed\.com/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("raw NDJSON mode keeps strict application/x-ndjson content type", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("rawfeed.com");
    promoteCandidate("rawfeed-com");
    const sink = collectNdjson({});
    handleDomainListingsNdjson(
      { headers: { accept: "text/html" } },
      sink.res,
      { metadataBaseUrl: "https://urlsnatcher.com", query: { view: "raw" } }
    );
    assert.equal(sink.getHeaders()["Content-Type"], "application/x-ndjson; charset=utf-8");
    assert.equal(sink.parse().length, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("default NDJSON API clients receive text/plain inline content type", () => {
  const tempDir = makeTempStore();
  try {
    seedFreshRecord("plainfeed.com");
    promoteCandidate("plainfeed-com");
    const sink = collectNdjson({});
    handleDomainListingsNdjson({ headers: { accept: "*/*" } }, sink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
    });
    assert.equal(sink.getHeaders()["Content-Type"], "text/plain; charset=utf-8");
    assert.equal(sink.getHeaders()["X-Feed-Format"], "application/x-ndjson");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("dataset metadata describes all public feeds", () => {
  const tempDir = makeTempStore();
  try {
    seedScopeFixtures();
    const res = collectJson({});
    handleDomainListingsDatasetJson({ headers: { accept: "*/*" } }, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
    });
    assert.deepEqual(res.getHeaders(), JSON_INLINE_HEADERS);
    const payload = res.parse();
    assert.equal(payload["@type"], "Dataset");
    assert.ok(Array.isArray(payload.distribution));
    assert.ok(payload.distribution.some((entry) => entry.contentUrl.includes("/api/domain-listings.ndjson")));
    assert.ok(payload.distribution.some((entry) => entry.contentUrl.includes("/api/domain-feed.ndjson")));
    assert.ok(payload.distribution.some((entry) => entry.contentUrl.includes("/api/domain-graph.ndjson")));
    assert.ok(Array.isArray(payload.hasPart));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
