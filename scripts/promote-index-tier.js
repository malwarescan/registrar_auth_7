#!/usr/bin/env node
const path = require("path");

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;
const dryRun = args.includes("--dry-run");

if (!Number.isFinite(limit) || limit <= 0) {
  process.stderr.write("Usage: node scripts/promote-index-tier.js --limit=500 [--dry-run]\n");
  process.exit(1);
}

const { configureDefaultProductStore } = require(path.join(
  __dirname,
  "..",
  "server",
  "candidate-store",
  "store-paths"
));
const { batchPromoteIndexTier, listSitemapCandidates } = require(path.join(
  __dirname,
  "..",
  "server",
  "candidate-store",
  "durable-candidates"
));

configureDefaultProductStore();

const result = batchPromoteIndexTier({ limit, dryRun });

process.stdout.write(`${dryRun ? "Dry-run" : "Promoted"} ${result.promotedCount} records into index-now tier (limit ${result.requestedLimit}).\n`);
if (result.promotedSlugs.length) {
  process.stdout.write(`  slugs: ${result.promotedSlugs.slice(0, 20).join(", ")}${result.promotedSlugs.length > 20 ? "…" : ""}\n`);
}

if (!dryRun) {
  const sitemapCount = listSitemapCandidates().length;
  process.stdout.write(`  sitemap-domains-indexed.xml candidates: ${sitemapCount}\n`);
}

process.exit(0);
