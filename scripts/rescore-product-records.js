#!/usr/bin/env node
// Re-applies the current quality scoring (server/candidate-store/product-intelligence.js)
// to stored product records, so scores and flags written by older ingests match
// the live rules. Records that fail the quality gate are moved to hold-noindex.
//
// Usage: node scripts/rescore-product-records.js [--batch=data/index-now-batch.json] [--dry-run]
const fs = require("fs");
const path = require("path");
const { analyzeProductIntelligence } = require("../server/candidate-store/product-intelligence");
const { BLOCKING_QUALITY_FLAGS, SEO_TIER } = require("../server/candidate-store/seo-tier");

const ROOT = path.resolve(__dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  })
);
const batchPath = path.resolve(ROOT, args.batch || "data/index-now-batch.json");
const dryRun = args["dry-run"] === true;

function rescore(record) {
  const root = String(record.domain || "").split(".")[0];
  const intelligence = analyzeProductIntelligence({
    domain: record.domain,
    root,
    tld: record.tld,
    currentBid: record.currentBid,
  });
  const next = {
    ...record,
    baseScores: intelligence.baseScores,
    baseSignals: { ...(record.baseSignals || {}), ...intelligence.baseSignals, matchedTerms: record.baseSignals?.matchedTerms || [] },
    qualityFlags: intelligence.qualityFlags,
    riskFlags: intelligence.riskFlags,
    riskNotes: intelligence.riskNotes,
    categoryGuesses: intelligence.categoryGuesses,
    buyerUseCases: intelligence.buyerUseCases,
  };
  const blocked = next.qualityFlags.some((flag) => BLOCKING_QUALITY_FLAGS.has(flag));
  const noContext = !next.categoryGuesses.length && !next.buyerUseCases.length;
  if (blocked || noContext) {
    next.seoTier = SEO_TIER.HOLD_NOINDEX;
    next.indexable = false;
  }
  return next;
}

const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
let demoted = 0;
let randomStrings = 0;
for (const [slug, record] of Object.entries(batch)) {
  const next = rescore(record);
  if (record.seoTier === SEO_TIER.INDEX_NOW && next.seoTier !== SEO_TIER.INDEX_NOW) demoted += 1;
  if (next.qualityFlags.includes("random-string")) randomStrings += 1;
  batch[slug] = next;
}
if (!dryRun) fs.writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
process.stdout.write(
  `${dryRun ? "[dry-run] " : ""}Rescored ${Object.keys(batch).length} records: ${randomStrings} random-string, ${demoted} moved to hold-noindex.\n`
);
