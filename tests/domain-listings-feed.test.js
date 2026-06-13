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
const {
  handleDomainListingsNdjson,
  handleDomainListingsJson,
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
  res.writeHead = () => {};
  res.write = (chunk) => {
    body += chunk;
  };
  res.end = (chunk) => {
    if (chunk) body += chunk;
  };
  return {
    res,
    parse() {
      return body
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
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
    handleDomainListingsNdjson({}, sink.res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: {},
    });
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
    handleDomainListingsNdjson({}, sink.res, {
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
    let body = "";
    const res = {
      writeHead() {},
      end(payload) {
        body = payload;
      },
    };
    handleDomainListingsJson({}, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed" },
      isProduction: true,
    });
    const payload = JSON.parse(body);
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
    let body = "";
    const res = {
      writeHead() {},
      end(payload) {
        body = payload;
      },
    };
    handleDomainListingsJson({}, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed", limit: "2" },
      isProduction: true,
    });
    const payload = JSON.parse(body);
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
    let body = "";
    const res = {
      writeHead() {},
      end(payload) {
        body = payload;
      },
    };
    handleDomainListingsJson({}, res, {
      metadataBaseUrl: "https://urlsnatcher.com",
      query: { scope: "indexed", all: "true" },
      isProduction: true,
      allowFullFeed: false,
    });
    const payload = JSON.parse(body);
    assert.equal(payload.allRequested, true);
    assert.equal(payload.allAllowed, false);
    assert.equal(payload.truncated, true);
    assert.equal(payload.limit, 1000);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
