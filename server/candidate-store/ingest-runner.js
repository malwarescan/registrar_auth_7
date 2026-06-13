const fs = require("fs");
const path = require("path");
const { normalizeAuctionRecord, extractAuctionRecords } = require("../domain-fetch/fetch-namesilo-auctions");
const { normalizeAuctionToProductRecord } = require("./product-record");
const { validateNormalizedAuction, validateProductRecord } = require("./ingest-validation");
const {
  createEmptyCheckpoint,
  loadCheckpoint,
  updateCheckpoint,
  DEFAULT_CHECKPOINT_PATH,
} = require("./ingest-checkpoint");
const {
  getDurableCandidateBySlug,
  upsertProductRecord,
  countDurableCandidates,
} = require("./durable-candidates");
const { buildDomainProductGraph } = require("./domain-graph");
const { toSlug } = require("../domain-fetch/classify-domain");

const ESTIMATED_TOTAL_AUCTIONS = 247324;
const DEFAULT_REPORTS_DIR = path.resolve(__dirname, "..", "..", "data", "reports");

function assertWriteMode(options = {}) {
  if (options.write !== true) {
    throw new Error("Persistent writes require explicit write: true (--write).");
  }
}

function parseIngestCliArgs(argv = process.argv.slice(2)) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
  const readValue = (prefix) => {
    const inline = argv.find((arg) => arg.startsWith(`${prefix}=`));
    if (inline) return inline.split("=")[1];
    return null;
  };

  const dryRun = flags.has("--dry-run");
  const write = flags.has("--write");
  const resume = flags.has("--resume");

  if (!dryRun && !write) {
    return {
      error: "Specify --dry-run or --write. Default is safe: no accidental full-catalog writes.",
    };
  }
  if (dryRun && write) {
    return { error: "Use either --dry-run or --write, not both." };
  }

  const maxPagesRaw = readValue("--max-pages");
  const maxPages = maxPagesRaw !== null ? Number(maxPagesRaw) : null;
  const startPage = Number(readValue("--start-page") || 1);
  const endPageRaw = readValue("--end-page");
  const endPage = endPageRaw ? Number(endPageRaw) : null;
  const pageSize = Number(readValue("--page-size") || 200);

  if (!Number.isFinite(startPage) || startPage < 1) {
    return { error: "--start-page must be a positive integer." };
  }
  if (endPageRaw !== null && (!Number.isFinite(endPage) || endPage < startPage)) {
    return { error: "--end-page must be >= --start-page." };
  }
  if (maxPagesRaw !== null && (!Number.isFinite(maxPages) || maxPages < 1)) {
    return { error: "--max-pages must be a positive integer." };
  }
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    return { error: "--page-size must be a positive integer." };
  }

  if (write && !resume && !Number.isFinite(maxPages) && endPage === null) {
    return {
      error: "Write mode requires a page bound (--max-pages or --end-page) unless using --resume with an existing checkpoint.",
    };
  }

  return {
    dryRun,
    write,
    resume,
    maxPages: maxPagesRaw !== null ? maxPages : null,
    startPage,
    endPage,
    pageSize,
    recordsDir: readValue("--records-dir"),
    checkpointPath: readValue("--checkpoint-path"),
    reportsDir: readValue("--reports-dir"),
  };
}

async function fetchNameSiloAuctionPage({ apiKey, fetchFn = fetch, page = 1, pageSize = 200 }) {
  const params = new URLSearchParams({
    version: "1",
    type: "json",
    key: apiKey,
    statusId: "2",
    typeId: "3",
    page: String(page),
    pageSize: String(pageSize),
    orderBy: "auctionEndsOnUtc",
    orderType: "ASC",
  });
  const response = await fetchFn(`https://www.namesilo.com/public/api/listAuctions?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();
  if (!response.ok || String(payload?.reply?.code || "") !== "300") {
    throw new Error(payload?.reply?.detail || "NameSilo auction ingest failed.");
  }
  const auctions = extractAuctionRecords(payload).map(normalizeAuctionRecord);
  return { page, auctions, rawCount: auctions.length };
}

function processAuctionBatch(auctions, stats, options = {}) {
  const { write = false, seenSlugs = new Set(), now = Date.now() } = options;

  for (const auction of auctions) {
    stats.recordsSeen += 1;

    const auctionValidation = validateNormalizedAuction(auction);
    if (!auctionValidation.valid) {
      stats.invalidRecords += 1;
      stats.errors.push({ type: "invalid-auction", domain: auction.domain, reason: auctionValidation.reason });
      continue;
    }

    const slug = toSlug(auction.domain);
    if (seenSlugs.has(slug)) {
      stats.duplicates += 1;
    } else {
      seenSlugs.add(slug);
    }

    const existing = slug ? getDurableCandidateBySlug(slug) : null;
    if (existing) {
      stats.duplicatesAgainstStore += 1;
    }

    const record = normalizeAuctionToProductRecord(auction, existing);
    const recordValidation = validateProductRecord(record);
    if (!recordValidation.valid) {
      stats.invalidRecords += 1;
      stats.errors.push({ type: "invalid-record", domain: auction.domain, reason: recordValidation.reason });
      continue;
    }

    if (record.status === "auction-ended") {
      stats.expiredAuctions += 1;
    }

    const recordBytes = Buffer.byteLength(JSON.stringify(record), "utf8");
    stats.recordByteSamples.push(recordBytes);

    const graphBytes = Buffer.byteLength(JSON.stringify(buildDomainProductGraph(record)), "utf8");
    stats.graphByteSamples.push(graphBytes);

    if (write) {
      upsertProductRecord(record);
      stats.recordsWritten += 1;
    }
  }
}

function summarizeIngestStats(stats, options = {}) {
  const averageRecordBytes = stats.recordByteSamples.length
    ? Math.round(stats.recordByteSamples.reduce((sum, value) => sum + value, 0) / stats.recordByteSamples.length)
    : 0;
  const averageGraphBytes = stats.graphByteSamples.length
    ? Math.round(stats.graphByteSamples.reduce((sum, value) => sum + value, 0) / stats.graphByteSamples.length)
    : 0;
  const estimatedTotalRecords = options.estimatedTotalRecords || ESTIMATED_TOTAL_AUCTIONS;

  return {
    pagesFetched: stats.pagesFetched,
    recordsSeen: stats.recordsSeen,
    recordsWritten: stats.recordsWritten,
    duplicates: stats.duplicates,
    duplicatesAgainstStore: stats.duplicatesAgainstStore,
    invalidRecords: stats.invalidRecords,
    expiredAuctions: stats.expiredAuctions,
    averageRecordBytes,
    averageGraphBytes,
    estimatedFullCatalogBytes: averageRecordBytes * estimatedTotalRecords,
    estimatedFeedBytes: averageGraphBytes * estimatedTotalRecords,
    estimatedTotalRecords,
    durationMs: stats.durationMs,
    errors: stats.errors.slice(0, 100),
    errorCount: stats.errors.length,
    dryRun: options.dryRun === true,
    write: options.write === true,
    storeCountAfter: options.storeCountAfter ?? null,
  };
}

function writeIngestReport(report, reportsDir = DEFAULT_REPORTS_DIR) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportsDir, `ingest-report-${timestamp}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function runNameSiloAuctionIngest(options = {}) {
  const startedAt = Date.now();
  const {
    apiKey,
    fetchFn = fetch,
    pageSize = 200,
    startPage = 1,
    endPage = null,
    maxPages = null,
    dryRun = false,
    write = false,
    resume = false,
    checkpointPath = DEFAULT_CHECKPOINT_PATH,
    reportsDir = DEFAULT_REPORTS_DIR,
    onPage = null,
    estimatedTotalRecords = ESTIMATED_TOTAL_AUCTIONS,
  } = options;

  if (!apiKey) throw new Error("Missing NameSilo API key.");
  if (write) assertWriteMode({ write: true });
  if (write && dryRun) throw new Error("Cannot combine write mode with dry-run.");

  let checkpoint = resume ? loadCheckpoint(checkpointPath) : null;
  if (resume && !checkpoint) {
    throw new Error("No ingest checkpoint found. Start a bounded write run before using --resume.");
  }
  if (!checkpoint) {
    checkpoint = createEmptyCheckpoint({ source: "namesilo-auction", pageSize });
  }

  let page = resume ? checkpoint.lastCompletedPage + 1 : startPage;
  const seenSlugs = new Set();
  const stats = {
    pagesFetched: 0,
    recordsSeen: 0,
    recordsWritten: 0,
    duplicates: 0,
    duplicatesAgainstStore: 0,
    invalidRecords: 0,
    expiredAuctions: 0,
    recordByteSamples: [],
    graphByteSamples: [],
    errors: [],
  };

  let lastPageCount = pageSize;

  while (lastPageCount === pageSize) {
    if (maxPages !== null && stats.pagesFetched >= maxPages) break;
    if (endPage !== null && page > endPage) break;

    try {
      const result = await fetchNameSiloAuctionPage({ apiKey, fetchFn, page, pageSize });
      processAuctionBatch(result.auctions, stats, { write, seenSlugs });
      stats.pagesFetched += 1;
      lastPageCount = result.rawCount;

      if (write) {
        checkpoint = updateCheckpoint(
          checkpoint,
          {
            lastCompletedPage: page,
            pageSize,
            recordsSeen: stats.recordsSeen,
            recordsWritten: stats.recordsWritten,
            duplicateCount: stats.duplicates + stats.duplicatesAgainstStore,
            errorCount: stats.errors.length,
          },
          checkpointPath
        );
      }

      if (typeof onPage === "function") {
        onPage({
          page,
          count: result.rawCount,
          totalSeen: stats.recordsSeen,
          dryRun,
          write,
        });
      }

      if (lastPageCount < pageSize) break;
      page += 1;
    } catch (error) {
      stats.errors.push({
        type: "page-fetch",
        page,
        reason: error instanceof Error ? error.message : String(error),
      });
      updateCheckpoint(checkpoint, { errorCount: checkpoint.errorCount + 1 }, checkpointPath);
      throw error;
    }
  }

  stats.durationMs = Date.now() - startedAt;
  const report = summarizeIngestStats(stats, {
    dryRun,
    write,
    estimatedTotalRecords,
    storeCountAfter: countDurableCandidates(),
  });
  const reportPath = writeIngestReport(report, reportsDir);

  return {
    ...report,
    reportPath,
    checkpoint,
    lastPage: page,
  };
}

module.exports = {
  ESTIMATED_TOTAL_AUCTIONS,
  DEFAULT_REPORTS_DIR,
  parseIngestCliArgs,
  assertWriteMode,
  fetchNameSiloAuctionPage,
  runNameSiloAuctionIngest,
  summarizeIngestStats,
  writeIngestReport,
};
