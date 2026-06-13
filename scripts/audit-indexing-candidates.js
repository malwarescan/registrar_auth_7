#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPath = outputArg
  ? outputArg.split("=")[1]
  : path.join(__dirname, "..", "data", "reports", `indexing-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

const { configureDefaultProductStore } = require(path.join(__dirname, "..", "server", "candidate-store", "store-paths"));
const { listDurableCandidates } = require(path.join(__dirname, "..", "server", "candidate-store", "durable-candidates"));
const { auditIndexingCandidates } = require(path.join(__dirname, "..", "server", "candidate-store", "indexing-audit"));

configureDefaultProductStore();

const recordsBefore = listDurableCandidates();
const report = auditIndexingCandidates(recordsBefore);
const recordsAfter = listDurableCandidates();

if (recordsBefore.length !== recordsAfter.length) {
  process.stderr.write("Indexing audit mutated durable records. Aborting.\n");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(`Indexing audit complete (${report.totalRecords} records scanned).\n`);
process.stdout.write(`  total durable records: ${report.totalRecords}\n`);
process.stdout.write(`  active auctions: ${report.activeAuctions}\n`);
process.stdout.write(`  graph-complete pages: ${report.graphCompleteRecords}\n`);
process.stdout.write(`  Product/Offer schema-complete: ${report.schemaCompleteRecords}\n`);
process.stdout.write(`  index-now (current tier): ${report.indexNowRecords}\n`);
process.stdout.write(`  hold-noindex candidates: ${report.holdNoindexRecords}\n`);
process.stdout.write(`  archive candidates: ${report.archiveRecords}\n`);
process.stdout.write(`  index-now eligible (not yet promoted): ${report.indexNowEligibleRecords}\n`);
process.stdout.write(`  top100 eligible slugs: ${report.top100EligibleSlugs.length}\n`);
process.stdout.write(`  report: ${outputPath}\n`);

const reasons = Object.entries(report.rejectionReasons).sort((a, b) => b[1] - a[1]);
if (reasons.length) {
  process.stdout.write("  rejection reasons:\n");
  for (const [reason, count] of reasons.slice(0, 12)) {
    process.stdout.write(`    - ${reason}: ${count}\n`);
  }
}

if (report.topCandidatesByScore.length) {
  process.stdout.write("  top candidates by score:\n");
  for (const entry of report.topCandidatesByScore.slice(0, 10)) {
    process.stdout.write(`    - ${entry.slug} (${entry.overall}) tier=${entry.tier}\n`);
  }
}
