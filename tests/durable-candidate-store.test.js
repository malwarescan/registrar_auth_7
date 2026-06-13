const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildStableSitemapPaths } = require("../server/sitemap");
const { isPublishedCandidate } = require("../server/published-catalog");
const {
  configureStorePaths,
  resetStorePaths,
  upsertDurableCandidate,
  getDurableCandidateBySlug,
  promoteCandidate,
  toDurableBaseRecord,
} = require("../server/candidate-store/durable-candidates");
const { regeneratePublishedCatalog } = require("../server/candidate-store/published-catalog-generator");
const { resolveDomainPage } = require("../server/candidate-store/resolve-domain-page");
const {
  renderCandidatePageHtml,
  renderCanonicalDomainPage,
  buildCanonicalPageTitle,
} = require("../server/candidate-detail-page");
const { createIntentRecord } = require("../server/domain-fetch/intent-session");

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-durable-"));
  const durablePath = path.join(tempDir, "durable-candidates.json");
  const publishedPath = path.join(tempDir, "published-candidates.json");
  fs.writeFileSync(durablePath, "{}\n", "utf8");
  fs.writeFileSync(publishedPath, "[]\n", "utf8");
  configureStorePaths({ durablePath, publishedPath });
  return { tempDir, durablePath, publishedPath };
}

function sampleAuctionCandidate(overrides = {}) {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    candidateId: "candidate_anudesk-com_auction",
    domain: "anudesk.com",
    slug: "anudesk-com",
    source: "namesilo-auction",
    status: "auction-active",
    eligibleDecisionCandidate: true,
    statusVerifiedAt: new Date().toISOString(),
    statusExpiresAt: future,
    canonicalUrl: "https://urlsnatcher.com/domains/anudesk-com",
    tld: ".com",
    matchedTerms: ["desk", "support"],
    scores: {
      overall: 76,
      tldTrust: 96,
      brandability: 75,
      semanticFit: 74,
      categoryClarity: 57,
    },
    acquisitionPath: {
      type: "auction",
      provider: "NameSilo",
      actionUrl: "https://www.namesilo.com/auctions/anudesk.com",
      currentBid: 1,
      priceCurrency: "USD",
      auctionEndsAt: future,
    },
    intentId: "if_session123",
    intentLabel: "AI Receptionist",
    sessionRank: 1,
    relatedCandidates: [{ domain: "sbobettai.com", rank: 2 }],
    ...overrides,
  };
}

function makeFetchMock({ auctions = [] }) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes("listAuctions")) {
      return {
        ok: true,
        async json() {
          return { reply: { code: 300, body: auctions } };
        },
      };
    }
    if (parsed.pathname.includes("checkRegisterAvailability")) {
      return {
        ok: true,
        async json() {
          return { reply: { code: 300, available: "", unavailable: parsed.searchParams.get("domains") || "" } };
        },
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

test.afterEach(() => {
  resetStorePaths();
});

test("durable candidate excludes session intent identity", () => {
  const { tempDir } = makeTempStore();
  try {
    const record = upsertDurableCandidate(sampleAuctionCandidate());
    assert.ok(record);
    assert.equal(record.domain, "anudesk.com");
    assert.equal(record.intentId, undefined);
    assert.equal(record.intentLabel, undefined);
    assert.equal(record.sessionRank, undefined);
    assert.equal(record.relatedCandidates, undefined);
    assert.equal(record.published, false);
    assert.deepEqual(record.baseSignals.matchedTerms, ["desk", "support"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("Intent Fetch upserts qualified auction into durable store", async () => {
  const { tempDir, durablePath } = makeTempStore();
  try {
    const { fetchDomainCandidates } = require("../server/domain-fetch/candidate-service");
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await fetchDomainCandidates({
      brief: "AI Receptionist",
      apiKey: "test-key",
      limit: 5,
      fetchFn: makeFetchMock({
        auctions: [
          {
            domain: "anudesk.com",
            currentBid: 1,
            bidsQuantity: 1,
            auctionEndsOnUtc: future,
            url: "https://www.namesilo.com/auctions/anudesk.com",
          },
        ],
      }),
    });

    const store = JSON.parse(fs.readFileSync(durablePath, "utf8"));
    assert.ok(store["anudesk-com"]);
    assert.equal(store["anudesk-com"].domain, "anudesk.com");
    assert.equal(store["anudesk-com"].published, false);
    assert.equal(store["anudesk-com"].intentId, undefined);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("promotion writes published-candidates.json and sitemap includes slug", () => {
  const { tempDir, publishedPath } = makeTempStore();
  try {
    upsertDurableCandidate(sampleAuctionCandidate());
    promoteCandidate("anudesk-com");

    const published = JSON.parse(fs.readFileSync(publishedPath, "utf8"));
    assert.equal(published.length, 1);
    assert.equal(published[0].slug, "anudesk-com");
    assert.equal(published[0].domain, "anudesk.com");
    assert.ok(isPublishedCandidate("anudesk-com"));
    assert.ok(buildStableSitemapPaths().includes("/domains/anudesk-com"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("durable candidate survives restart-style reload", () => {
  const { tempDir, durablePath } = makeTempStore();
  try {
    upsertDurableCandidate(sampleAuctionCandidate());
    delete require.cache[require.resolve("../server/candidate-store/durable-candidates")];
    const reloaded = require("../server/candidate-store/durable-candidates");
    reloaded.configureStorePaths({
      durablePath,
      publishedPath: path.join(tempDir, "published-candidates.json"),
    });
    const record = reloaded.getDurableCandidateBySlug("anudesk-com");
    assert.equal(record.domain, "anudesk.com");
    assert.equal(record.source, "namesilo-auction");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("resolveDomainPage prefers published durable over session", () => {
  const { tempDir } = makeTempStore();
  try {
    upsertDurableCandidate(sampleAuctionCandidate());
    promoteCandidate("anudesk-com");
    const sessionCandidate = sampleAuctionCandidate({ intentLabel: "Legal AI" });
    const resolved = resolveDomainPage("anudesk-com", {}, () => sessionCandidate);
    assert.equal(resolved.mode, "active-indexed");
    assert.equal(resolved.indexable, true);
    assert.equal(resolved.candidate.domain, "anudesk.com");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("bare promoted page is indexable canonical product page", () => {
  const candidate = sampleAuctionCandidate();
  const html = renderCanonicalDomainPage(candidate, {}, { indexable: true, port: 4173, isProduction: false });
  assert.match(html, /anudesk\.com — \.com Auction Domain \| Snatch\.auction/);
  assert.match(html, /meta name="robots" content="index,follow/);
  assert.match(html, /is a \.com auction domain available through NameSilo/);
  assert.doesNotMatch(html, /AI Receptionist Domain Candidate/i);
});

test("overlay page is noindex and canonicalizes to bare slug", () => {
  const baseCandidate = sampleAuctionCandidate();
  const sessionCandidate = sampleAuctionCandidate({
    intentLabel: "AI Receptionist",
    sessionRank: 1,
  });
  const intentRecord = createIntentRecord({
    brief: "AI Receptionist",
    interpretedIntent: { productCategory: "AI Software", targetBuyer: ["ops teams"] },
    strategy: { primaryIntent: "ai-software" },
    fetchedAt: new Date().toISOString(),
    requestId: "req-overlay",
  });
  const html = renderCandidatePageHtml(sessionCandidate, { intentId: intentRecord.intentId, rank: 1, fitScore: 76 }, {
    pageMode: "overlay",
    baseCandidate,
    indexable: false,
    port: 4173,
    isProduction: false,
  });
  assert.match(html, /meta name="robots" content="noindex,follow/);
  assert.match(html, /link rel="canonical" href="https:\/\/urlsnatcher\.com\/domains\/anudesk-com"/);
  assert.match(html, /Recommended for AI Receptionist · #1 · 76 fit/);
  assert.match(html, /<title>anudesk\.com — \.com Auction Domain \| Snatch\.auction<\/title>/);
  assert.match(html, /AI Receptionist domain candidate in AI Software/);
  assert.doesNotMatch(html, /<title>[\s\S]*AI Receptionist Domain Candidate[\s\S]*<\/title>/);
});

test("session-only page remains noindex recommendation report", () => {
  const intentRecord = createIntentRecord({
    brief: "AI Receptionist",
    interpretedIntent: { productCategory: "AI Software", targetBuyer: ["ops teams"] },
    strategy: { primaryIntent: "ai-software" },
    fetchedAt: new Date().toISOString(),
    requestId: "req-session",
  });
  const html = renderCandidatePageHtml(sampleAuctionCandidate(), { intentId: intentRecord.intentId, rank: 1 }, {
    pageMode: "session",
    indexable: false,
    port: 4173,
    isProduction: false,
  });
  assert.match(html, /meta name="robots" content="noindex,follow/);
  assert.match(html, /AI Receptionist Domain Candidate/i);
});

test("toDurableBaseRecord rejects candidates without acquisition URL", () => {
  const record = toDurableBaseRecord(
    sampleAuctionCandidate({
      acquisitionPath: { type: "auction", provider: "NameSilo" },
    })
  );
  assert.equal(record, null);
});
