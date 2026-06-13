const fs = require("fs");
const path = require("path");
const { resolveSeoTier, SEO_TIER } = require("./seo-tier");
const { getSitemapFreshnessMs } = require("./sitemap-freshness");

const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_BATCH_PATH = path.join(ROOT, "data", "index-now-batch.json");
const STATUS_TTL_MS = 15 * 60 * 1000;

let batchPath = null;
let batchCache = null;

function configureIndexNowBatchPath(filePath) {
  batchPath = filePath || null;
  batchCache = null;
}

function resetIndexNowBatchPath() {
  batchPath = null;
  batchCache = null;
}

function refreshIndexNowBatchTtl(batch, now = Date.now()) {
  if (!batch || typeof batch !== "object") return batch;
  for (const record of Object.values(batch)) {
    if (!record || resolveSeoTier(record) !== SEO_TIER.INDEX_NOW) continue;
    const expiresAt = record.statusExpiresAt ? new Date(record.statusExpiresAt).getTime() : 0;
    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= now) {
      if (!record.statusVerifiedAt) {
        record.statusVerifiedAt = new Date(now).toISOString();
      }
      record.statusExpiresAt = new Date(now + STATUS_TTL_MS).toISOString();
    }
  }
  return batch;
}

function loadIndexNowBatch(options = {}) {
  if (batchCache) return batchCache;

  const filePath = batchPath || DEFAULT_BATCH_PATH;
  if (!fs.existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    batchCache = options.refreshTtl === false ? parsed : refreshIndexNowBatchTtl(parsed, options.now);
    return batchCache;
  } catch {
    return null;
  }
}

function getIndexNowBatchRecord(slug) {
  const batch = loadIndexNowBatch();
  if (!batch) return null;
  return batch[slug] || null;
}

function listIndexNowBatchRecords() {
  const batch = loadIndexNowBatch();
  if (!batch) return [];
  return Object.values(batch).filter(Boolean);
}

function countIndexNowBatchRecords() {
  return listIndexNowBatchRecords().length;
}

function isWithinSitemapVerificationWindow(record, now = Date.now()) {
  const verifiedAt = record?.statusVerifiedAt ? new Date(record.statusVerifiedAt).getTime() : 0;
  if (!verifiedAt || Number.isNaN(verifiedAt)) return false;
  return now - verifiedAt <= getSitemapFreshnessMs();
}

function touchIndexNowBatchTtlForSitemap(now = Date.now()) {
  const batch = loadIndexNowBatch({ refreshTtl: false });
  if (!batch) return;

  for (const record of Object.values(batch)) {
    if (!record || resolveSeoTier(record) !== SEO_TIER.INDEX_NOW) continue;
    if (!isWithinSitemapVerificationWindow(record, now)) continue;

    const expiresAt = record.statusExpiresAt ? new Date(record.statusExpiresAt).getTime() : 0;
    if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= now) {
      record.statusExpiresAt = new Date(now + STATUS_TTL_MS).toISOString();
    }
  }
}

module.exports = {
  DEFAULT_BATCH_PATH,
  STATUS_TTL_MS,
  configureIndexNowBatchPath,
  resetIndexNowBatchPath,
  refreshIndexNowBatchTtl,
  loadIndexNowBatch,
  getIndexNowBatchRecord,
  listIndexNowBatchRecords,
  countIndexNowBatchRecords,
  isWithinSitemapVerificationWindow,
  touchIndexNowBatchTtlForSitemap,
};
