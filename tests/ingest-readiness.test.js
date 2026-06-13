const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  configureStorePaths,
  resetStorePaths,
  countDurableCandidates,
  upsertProductRecordFromAuction,
  listDurableCandidates,
} = require("../server/candidate-store/durable-candidates");
const {
  parseIngestCliArgs,
  assertWriteMode,
  runNameSiloAuctionIngest,
} = require("../server/candidate-store/ingest-runner");
const { saveCheckpoint } = require("../server/candidate-store/ingest-checkpoint");
const { resolveJsonFeedOptions, resolveNdjsonFeedOptions } = require("../server/candidate-store/feed-guard");
const {
  handleDomainFeedJson,
  handleDomainFeedNdjson,
} = require("../api/domain-product");
const { auditPromotionCandidates } = require("../server/candidate-store/promotion-audit");

function makeTempStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-ingest-ready-"));
  const durablePath = path.join(tempDir, "durable-candidates.json");
  const publishedPath = path.join(tempDir, "published-candidates.json");
  const recordsDir = path.join(tempDir, "product-records");
  fs.writeFileSync(durablePath, "{}\n", "utf8");
  fs.writeFileSync(publishedPath, "[]\n", "utf8");
  fs.mkdirSync(recordsDir, { recursive: true });
  configureStorePaths({ durablePath, publishedPath, recordsDir });
  return tempDir;
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

function auctionRow(domain, overrides = {}) {
  const future = new Date(Date.now() + 86400000).toISOString();
  return {
    domain,
    currentBid: 1,
    bidsQuantity: 1,
    auctionEndsOnUtc: future,
    url: `https://www.namesilo.com/auctions/${domain}`,
    ...overrides,
  };
}

test.afterEach(() => resetStorePaths());

test("parseIngestCliArgs requires --dry-run or --write", () => {
  const parsed = parseIngestCliArgs([]);
  assert.match(parsed.error, /--dry-run or --write/);
});

test("write mode requires explicit write flag in runner", () => {
  assert.throws(() => assertWriteMode({ write: false }), /explicit write/);
});

test("dry-run writes no records", async () => {
  const tempDir = makeTempStore();
  const reportsDir = path.join(tempDir, "reports");
  try {
    const before = countDurableCandidates();
    const result = await runNameSiloAuctionIngest({
      apiKey: "test-key",
      dryRun: true,
      maxPages: 2,
      pageSize: 2,
      reportsDir,
      fetchFn: mockFetch({
        1: [auctionRow("alpha.com"), auctionRow("beta.com")],
        2: [auctionRow("gamma.com")],
        3: [],
      }),
    });
    assert.equal(countDurableCandidates(), before);
    assert.equal(result.recordsWritten, 0);
    assert.equal(result.dryRun, true);
    assert.ok(result.recordsSeen >= 3);
    assert.ok(fs.existsSync(result.reportPath));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("write mode persists records and checkpoint", async () => {
  const tempDir = makeTempStore();
  const reportsDir = path.join(tempDir, "reports");
  const checkpointPath = path.join(tempDir, "ingest-checkpoint.json");
  try {
    const result = await runNameSiloAuctionIngest({
      apiKey: "test-key",
      write: true,
      maxPages: 1,
      pageSize: 2,
      reportsDir,
      checkpointPath,
      fetchFn: mockFetch({
        1: [auctionRow("alpha.com"), auctionRow("beta.com")],
        2: [],
      }),
    });
    assert.equal(result.recordsWritten, 2);
    assert.equal(countDurableCandidates(), 2);
    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    assert.equal(checkpoint.lastCompletedPage, 1);
    assert.equal(checkpoint.recordsWritten, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("resume starts from checkpoint page", async () => {
  const tempDir = makeTempStore();
  const reportsDir = path.join(tempDir, "reports");
  const checkpointPath = path.join(tempDir, "ingest-checkpoint.json");
  try {
    saveCheckpoint(
      {
        source: "namesilo-auction",
        lastCompletedPage: 1,
        pageSize: 1,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordsSeen: 1,
        recordsWritten: 1,
        duplicateCount: 0,
        errorCount: 0,
      },
      checkpointPath
    );

    const pagesFetched = [];
    await runNameSiloAuctionIngest({
      apiKey: "test-key",
      write: true,
      resume: true,
      maxPages: 1,
      reportsDir,
      checkpointPath,
      fetchFn: mockFetch({
        1: [auctionRow("skip.com")],
        2: [auctionRow("resume.com")],
        3: [],
      }),
      onPage({ page }) {
        pagesFetched.push(page);
      },
    });

    assert.deepEqual(pagesFetched, [2]);
    assert.ok(getRecordDomain("resume.com"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function getRecordDomain(domain) {
  const slug = domain.replace(/\./g, "-");
  return listDurableCandidates().find((record) => record.slug === slug);
}

test("feed JSON defaults to limited output in production", () => {
  const options = resolveJsonFeedOptions({}, { isProduction: true, allowFullFeed: false });
  assert.equal(options.limit, 1000);
  assert.equal(options.allAllowed, false);
});

test("feed JSON all=true is blocked in production without internal mode", () => {
  const options = resolveJsonFeedOptions({ all: "true" }, { isProduction: true, allowFullFeed: false });
  assert.equal(options.allRequested, true);
  assert.equal(options.allAllowed, false);
  assert.equal(options.limit, 1000);
  assert.equal(options.truncated, true);
});

test("feed JSON all=true allowed in dev/internal mode", () => {
  const devOptions = resolveJsonFeedOptions({ all: "true" }, { isProduction: false });
  assert.equal(devOptions.allAllowed, true);
  assert.equal(devOptions.limit, null);

  const internalOptions = resolveJsonFeedOptions({ all: "true" }, { isProduction: true, allowFullFeed: true });
  assert.equal(internalOptions.allAllowed, true);
  assert.equal(internalOptions.limit, null);
});

test("NDJSON can stream full export", () => {
  const options = resolveNdjsonFeedOptions({ all: "true" });
  assert.equal(options.limit, null);
  assert.equal(options.allExport, true);
});

test("handleDomainFeedJson applies default limit", () => {
  const tempDir = makeTempStore();
  try {
    for (let index = 0; index < 5; index += 1) {
      upsertProductRecordFromAuction({
        domain: `domain${index}.com`,
        root: `domain${index}`,
        tld: ".com",
        currentBid: 1,
        bidCount: 1,
        auctionEndsAt: new Date(Date.now() + 86400000).toISOString(),
        auctionUrl: `https://www.namesilo.com/auctions/domain${index}.com`,
      });
    }

    let body = "";
    const res = {
      writeHead() {},
      end(payload) {
        body = payload;
      },
    };
    handleDomainFeedJson({}, res, {
      query: { limit: "2" },
      isProduction: true,
    });
    const payload = JSON.parse(body);
    assert.equal(payload.count, 2);
    assert.equal(payload.limit, 2);
    assert.equal(payload.totalAvailable, 5);
    assert.equal(payload.truncated, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("handleDomainFeedNdjson streams all records by default", async () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction({
      domain: "stream-a.com",
      root: "stream-a",
      tld: ".com",
      currentBid: 1,
      bidCount: 1,
      auctionEndsAt: new Date(Date.now() + 86400000).toISOString(),
      auctionUrl: "https://www.namesilo.com/auctions/stream-a.com",
    });
    upsertProductRecordFromAuction({
      domain: "stream-b.com",
      root: "stream-b",
      tld: ".com",
      currentBid: 1,
      bidCount: 1,
      auctionEndsAt: new Date(Date.now() + 86400000).toISOString(),
      auctionUrl: "https://www.namesilo.com/auctions/stream-b.com",
    });

    const lines = [];
    const res = {
      writeHead() {},
      write(chunk) {
        lines.push(chunk);
      },
      end() {},
    };
    handleDomainFeedNdjson({}, res, { query: { all: "true" } });
    assert.equal(lines.length, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("promotion audit does not mutate records", () => {
  const tempDir = makeTempStore();
  try {
    upsertProductRecordFromAuction({
      domain: "auditme.com",
      root: "auditme",
      tld: ".com",
      currentBid: 10,
      bidCount: 2,
      auctionEndsAt: new Date(Date.now() + 86400000).toISOString(),
      auctionUrl: "https://www.namesilo.com/auctions/auditme.com",
    });
    const before = JSON.stringify(listDurableCandidates());
    const report = auditPromotionCandidates(listDurableCandidates());
    const after = JSON.stringify(listDurableCandidates());
    assert.equal(before, after);
    assert.equal(report.totalRecords, 1);
    assert.ok(typeof report.rejectionReasons === "object");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ingest report is written after each run", async () => {
  const tempDir = makeTempStore();
  const reportsDir = path.join(tempDir, "reports");
  try {
    const result = await runNameSiloAuctionIngest({
      apiKey: "test-key",
      dryRun: true,
      maxPages: 1,
      reportsDir,
      fetchFn: mockFetch({
        1: [auctionRow("report.com")],
        2: [],
      }),
    });
    assert.ok(fs.existsSync(result.reportPath));
    const report = JSON.parse(fs.readFileSync(result.reportPath, "utf8"));
    assert.equal(report.pagesFetched, 1);
    assert.equal(report.recordsSeen, 1);
    assert.equal(report.recordsWritten, 0);
    assert.ok(report.averageRecordBytes > 0);
    assert.ok(report.estimatedFullCatalogBytes > 0);
    assert.ok(report.estimatedFeedBytes > 0);
    assert.ok(report.durationMs >= 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("dry-run reports expired auctions and invalid records", async () => {
  const tempDir = makeTempStore();
  const reportsDir = path.join(tempDir, "reports");
  try {
    const result = await runNameSiloAuctionIngest({
      apiKey: "test-key",
      dryRun: true,
      maxPages: 1,
      reportsDir,
      fetchFn: mockFetch({
        1: [
          auctionRow("expired.com", { auctionEndsOnUtc: new Date(Date.now() - 86400000).toISOString() }),
          { currentBid: 1 },
        ],
        2: [],
      }),
    });
    assert.equal(result.expiredAuctions, 1);
    assert.equal(result.invalidRecords, 1);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("parseIngestCliArgs rejects unbounded write without resume", () => {
  const parsed = parseIngestCliArgs(["--write"]);
  assert.match(parsed.error, /page bound/);
});
