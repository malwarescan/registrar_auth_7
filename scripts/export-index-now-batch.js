#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const publishedPath = path.join(ROOT, "data", "published-candidates.json");
const recordsDir = path.join(ROOT, "data", "product-records");
const outputPath = path.join(ROOT, "data", "index-now-batch.json");
const STATUS_TTL_MS = 15 * 60 * 1000;
const { BLOCKING_QUALITY_FLAGS } = require("../server/candidate-store/seo-tier");
const { hasAuctionEnded } = require("../server/candidate-store/product-lifecycle");

// Only records that pass the quality gate and are still running keep the
// index-now tier; the rest ship as hold-noindex so their pages are noindex.
function qualifiesForIndex(record) {
  if (hasAuctionEnded(record)) return false;
  if ((record.qualityFlags || []).some((flag) => BLOCKING_QUALITY_FLAGS.has(flag))) return false;
  return Boolean(record.categoryGuesses?.length || record.buyerUseCases?.length);
}

function main() {
  if (!fs.existsSync(publishedPath)) {
    throw new Error(`Missing ${publishedPath}`);
  }

  const published = JSON.parse(fs.readFileSync(publishedPath, "utf8"));
  if (!Array.isArray(published) || !published.length) {
    throw new Error("published-candidates.json is empty");
  }

  const now = Date.now();
  const batch = {};
  const missing = [];

  for (const entry of published) {
    const slug = String(entry.slug || "").trim();
    if (!slug) continue;
    const sourcePath = path.join(recordsDir, `${slug}.json`);
    if (!fs.existsSync(sourcePath)) {
      missing.push(slug);
      continue;
    }
    const record = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const indexed = qualifiesForIndex(record);
    record.seoTier = indexed ? "index-now" : "hold-noindex";
    record.indexable = indexed;
    record.published = indexed;
    record.canonicalUrl = `https://urlsnatcher.com/domains/${slug}`;
    record.graphId = `https://urlsnatcher.com/domains/${slug}#graph`;
    record.statusVerifiedAt = new Date(now).toISOString();
    record.statusExpiresAt = new Date(now + STATUS_TTL_MS).toISOString();
    batch[slug] = record;
  }

  if (missing.length) {
    process.stderr.write(`Warning: ${missing.length} published slugs missing product records\n`);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Exported ${Object.keys(batch).length} index-now records to ${path.relative(ROOT, outputPath)}\n`
  );

  if (!Object.keys(batch).length) {
    process.exitCode = 1;
  }
}

main();
