#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    });
}

const { configureStorePaths } = require(path.join(__dirname, "..", "server", "candidate-store", "durable-candidates"));
const {
  parseIngestCliArgs,
  runNameSiloAuctionIngest,
} = require(path.join(__dirname, "..", "server", "candidate-store", "ingest-runner"));
const { DEFAULT_CHECKPOINT_PATH } = require(path.join(__dirname, "..", "server", "candidate-store", "ingest-checkpoint"));

const parsed = parseIngestCliArgs(args);
if (parsed.error) {
  process.stderr.write(`${parsed.error}\n`);
  process.stderr.write(
    "Usage: node scripts/ingest-namesilo-auctions.js --dry-run --max-pages=5\n       node scripts/ingest-namesilo-auctions.js --write --max-pages=50\n       node scripts/ingest-namesilo-auctions.js --write --resume\n"
  );
  process.exit(1);
}

const recordsDir = parsed.recordsDir || path.join(__dirname, "..", "data", "product-records");
configureStorePaths({ recordsDir });

(async () => {
  const result = await runNameSiloAuctionIngest({
    apiKey: process.env.NAMESILO_API_KEY,
    dryRun: parsed.dryRun,
    write: parsed.write,
    resume: parsed.resume,
    maxPages: parsed.maxPages,
    startPage: parsed.startPage,
    endPage: parsed.endPage,
    pageSize: parsed.pageSize,
    checkpointPath: parsed.checkpointPath || DEFAULT_CHECKPOINT_PATH,
    reportsDir: parsed.reportsDir || path.join(__dirname, "..", "data", "reports"),
    onPage({ page, count, totalSeen, dryRun, write }) {
      const mode = dryRun ? "dry-run" : "write";
      process.stdout.write(`[${mode}] page ${page}: ${count} auctions (${totalSeen} seen)\n`);
    },
  });

  process.stdout.write(`Ingest ${parsed.dryRun ? "dry-run" : "write"} complete.\n`);
  process.stdout.write(`  pagesFetched: ${result.pagesFetched}\n`);
  process.stdout.write(`  recordsSeen: ${result.recordsSeen}\n`);
  process.stdout.write(`  recordsWritten: ${result.recordsWritten}\n`);
  process.stdout.write(`  duplicates: ${result.duplicates}\n`);
  process.stdout.write(`  invalidRecords: ${result.invalidRecords}\n`);
  process.stdout.write(`  expiredAuctions: ${result.expiredAuctions}\n`);
  process.stdout.write(`  averageRecordBytes: ${result.averageRecordBytes}\n`);
  process.stdout.write(`  estimatedFullCatalogBytes: ${result.estimatedFullCatalogBytes}\n`);
  process.stdout.write(`  estimatedFeedBytes: ${result.estimatedFeedBytes}\n`);
  process.stdout.write(`  report: ${result.reportPath}\n`);
  if (parsed.write) {
    process.stdout.write(`  checkpoint: ${parsed.checkpointPath || DEFAULT_CHECKPOINT_PATH}\n`);
  }
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
