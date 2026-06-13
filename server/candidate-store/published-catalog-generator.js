const fs = require("fs");
const path = require("path");
const { isIndexNowTier } = require("./seo-tier");

const ROOT = path.resolve(__dirname, "..", "..");
let publishedPath = path.join(ROOT, "data", "published-candidates.json");

function configurePublishedCatalogPath(filePath) {
  publishedPath = filePath;
}

function resetPublishedCatalogPath() {
  publishedPath = path.join(ROOT, "data", "published-candidates.json");
}

function getPublishedCatalogPath() {
  return publishedPath;
}

function resolveAcquisitionUrl(record = {}) {
  return record.acquisitionPath?.actionUrl || record.acquisitionPath?.url || record.auctionUrl || null;
}

function isEligibleForPublishedCatalog(record, now = Date.now()) {
  if (!record) return false;
  if (!isIndexNowTier(record)) return false;
  if (!record.domain || !record.canonicalUrl) return false;
  if (record.status !== "auction-active") return false;
  if (!resolveAcquisitionUrl(record.acquisitionPath) && !record.auctionUrl) return false;
  const expiresAt = record.statusExpiresAt ? new Date(record.statusExpiresAt).getTime() : 0;
  if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= now) return false;
  return true;
}

function buildPublishedCatalogEntry(record) {
  return {
    slug: record.slug,
    domain: record.domain,
    candidateId: record.candidateId || `durable_${record.slug}`,
    canonicalUrl: record.canonicalUrl,
    publishedAt: record.publishedAt || null,
    source: record.source,
    status: record.status,
  };
}

function regeneratePublishedCatalog(options = {}) {
  const { listDurableCandidates } = require("./durable-candidates");
  const now = options.now ?? Date.now();
  const entries = listDurableCandidates()
    .filter((record) => isEligibleForPublishedCatalog(record, now))
    .map(buildPublishedCatalogEntry)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  fs.mkdirSync(path.dirname(publishedPath), { recursive: true });
  fs.writeFileSync(publishedPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return entries;
}

module.exports = {
  configurePublishedCatalogPath,
  resetPublishedCatalogPath,
  getPublishedCatalogPath,
  isEligibleForPublishedCatalog,
  regeneratePublishedCatalog,
  buildPublishedCatalogEntry,
};
