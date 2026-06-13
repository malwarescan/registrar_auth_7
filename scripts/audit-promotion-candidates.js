#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPath = outputArg
  ? outputArg.split("=")[1]
  : path.join(__dirname, "..", "data", "reports", `promotion-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

const { configureDefaultProductStore } = require(path.join(__dirname, "..", "server", "candidate-store", "store-paths"));
const { listDurableCandidates } = require(path.join(__dirname, "..", "server", "candidate-store", "durable-candidates"));
const { auditPromotionCandidates } = require(path.join(__dirname, "..", "server", "candidate-store", "promotion-audit"));

configureDefaultProductStore();

const recordsBefore = listDurableCandidates();
const report = auditPromotionCandidates(recordsBefore);
const recordsAfter = listDurableCandidates();

if (recordsBefore.length !== recordsAfter.length) {
  process.stderr.write("Promotion audit mutated durable records. Aborting.\n");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(`Promotion audit complete (${report.totalRecords} records scanned).\n`);
process.stdout.write(`  activeAuctions: ${report.activeAuctions}\n`);
process.stdout.write(`  freshRecords: ${report.freshRecords}\n`);
process.stdout.write(`  qualityPassRecords: ${report.qualityPassRecords}\n`);
process.stdout.write(`  graphCompleteRecords: ${report.graphCompleteRecords}\n`);
process.stdout.write(`  publishEligibleRecords: ${report.publishEligibleRecords}\n`);
process.stdout.write(`  top100EligibleSlugs: ${report.top100EligibleSlugs.length}\n`);
process.stdout.write(`  report: ${outputPath}\n`);

const reasons = Object.entries(report.rejectionReasons).sort((a, b) => b[1] - a[1]);
if (reasons.length) {
  process.stdout.write("  rejectionReasons:\n");
  for (const [reason, count] of reasons.slice(0, 10)) {
    process.stdout.write(`    - ${reason}: ${count}\n`);
  }
}
