const fs = require("fs");
const path = require("path");
const {
  normalizeAuctionToProductRecord,
  normalizeSessionCandidateToProductRecord,
  productRecordToCandidate,
} = require("./product-record");
const { validatePromotionGate, isGraphComplete } = require("./promotion-gate");
const { resolveLifecycleState } = require("./product-lifecycle");
const { applySeoTier, isIndexNowTier, SEO_TIER, validateIndexNowEligibility, isProductOfferSchemaComplete } = require("./seo-tier");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

const ROOT = path.resolve(__dirname, "..", "..");

let storePaths = {
  durablePath: path.join(ROOT, "data", "durable-candidates.json"),
  publishedPath: path.join(ROOT, "data", "published-candidates.json"),
  recordsDir: null,
};

function configureStorePaths(options = {}) {
  if (options.durablePath) storePaths.durablePath = options.durablePath;
  if (options.publishedPath) storePaths.publishedPath = options.publishedPath;
  if (options.recordsDir !== undefined) storePaths.recordsDir = options.recordsDir;
  if (options.publishedPath) {
    const { configurePublishedCatalogPath } = require("./published-catalog-generator");
    configurePublishedCatalogPath(options.publishedPath);
  }
}

function resetStorePaths() {
  storePaths = {
    durablePath: path.join(ROOT, "data", "durable-candidates.json"),
    publishedPath: path.join(ROOT, "data", "published-candidates.json"),
    recordsDir: null,
  };
  const { resetPublishedCatalogPath } = require("./published-catalog-generator");
  resetPublishedCatalogPath();
}

function normalizeSlug(slug) {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function recordFilePath(slug) {
  return path.join(storePaths.recordsDir, `${slug}.json`);
}

function readMapStore() {
  if (!fs.existsSync(storePaths.durablePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(storePaths.durablePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMapStore(store) {
  fs.mkdirSync(path.dirname(storePaths.durablePath), { recursive: true });
  fs.writeFileSync(storePaths.durablePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function readRecord(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  if (storePaths.recordsDir) {
    const filePath = recordFilePath(normalized);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch {
        return null;
      }
    }
  }
  return readMapStore()[normalized] || null;
}

function readDevMapRecord(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const mapRecord = readMapStore()[normalized];
  if (!mapRecord) return null;
  if (storePaths.recordsDir) {
    const filePath = recordFilePath(normalized);
    if (fs.existsSync(filePath)) return null;
  }
  return mapRecord;
}

function getDurableCandidateBySlug(slug) {
  return readRecord(slug);
}

function getDevDurableCandidateBySlug(slug) {
  return readDevMapRecord(slug);
}

function writeRecord(record) {
  if (!record?.slug) return;
  if (storePaths.recordsDir) {
    fs.mkdirSync(storePaths.recordsDir, { recursive: true });
    fs.writeFileSync(recordFilePath(record.slug), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return;
  }
  const store = readMapStore();
  store[record.slug] = record;
  writeMapStore(store);
}

function listDurableCandidates(options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : null;
  if (storePaths.recordsDir && fs.existsSync(storePaths.recordsDir)) {
    const files = fs.readdirSync(storePaths.recordsDir).filter((name) => name.endsWith(".json"));
    const records = files
      .slice(0, limit || files.length)
      .map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(storePaths.recordsDir, name), "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return records;
  }
  const all = Object.values(readMapStore());
  return limit ? all.slice(0, limit) : all;
}

function countDurableCandidates() {
  if (storePaths.recordsDir && fs.existsSync(storePaths.recordsDir)) {
    return fs.readdirSync(storePaths.recordsDir).filter((name) => name.endsWith(".json")).length;
  }
  return Object.keys(readMapStore()).length;
}

function listSitemapCandidates(options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const now = options.now ?? Date.now();
  return listDurableCandidates().filter((record) => {
    if (!record?.slug || !record.domain) return false;
    if (resolveLifecycleState(record) !== "active") return false;
    if (!isIndexNowTier(record)) return false;
    if (!record.canonicalUrl || record.canonicalUrl.includes("?")) return false;
    if (!isGraphComplete(record, metadataBaseUrl)) return false;
    if (!isProductOfferSchemaComplete(record, metadataBaseUrl)) return false;
    if (validateIndexNowEligibility(record, now, { metadataBaseUrl, assetsDir: options.assetsDir }) !== null) {
      return false;
    }
    return true;
  });
}

function upsertProductRecord(record) {
  if (!record?.slug || !record.domain) return null;
  writeRecord(record);
  return record;
}

function upsertProductRecordFromAuction(auction) {
  const slug = normalizeSlug(String(auction.domain || "").replace(/\./g, "-"));
  const existing = slug ? readRecord(slug) : null;
  const record = normalizeAuctionToProductRecord(auction, existing);
  if (!record) return null;
  return upsertProductRecord(record);
}

function upsertDurableCandidate(candidate) {
  if (!candidate || candidate.source !== "namesilo-auction") return null;
  const slug = normalizeSlug(candidate.slug || String(candidate.domain || "").replace(/\./g, "-"));
  if (!slug) return null;
  const existing = readRecord(slug);
  const record = normalizeSessionCandidateToProductRecord(candidate, existing);
  if (!record) return null;
  return upsertProductRecord(record);
}

function validatePublishRequirements(record, now = Date.now(), options = {}) {
  return validatePromotionGate(record, now, options);
}

function promoteCandidate(slug, options = {}) {
  return promoteToIndexNow(slug, options);
}

function promoteToIndexNow(slug, options = {}) {
  const normalized = normalizeSlug(slug);
  const record = readRecord(normalized);
  const validationError = validateIndexNowEligibility(record, Date.now(), options);
  if (validationError) throw new Error(validationError);

  const promoted = applySeoTier(record, SEO_TIER.INDEX_NOW, options);
  writeRecord(promoted);
  if (options.skipCatalogRegen !== true) {
    const { regeneratePublishedCatalog } = require("./published-catalog-generator");
    regeneratePublishedCatalog();
  }
  return promoted;
}

function batchPromoteIndexTier(options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 500;
  const now = options.now ?? Date.now();
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const dryRun = options.dryRun === true;

  const candidates = listDurableCandidates()
    .filter((record) => !isIndexNowTier(record))
    .map((record) => ({
      record,
      rejection: validateIndexNowEligibility(record, now, { metadataBaseUrl, assetsDir: options.assetsDir }),
      overall: record.baseScores?.overall ?? 0,
    }))
    .filter((entry) => !entry.rejection)
    .sort((a, b) => b.overall - a.overall || a.record.slug.localeCompare(b.record.slug))
    .slice(0, limit);

  const promoted = [];
  for (const { record } of candidates) {
    if (dryRun) {
      promoted.push({ slug: record.slug, domain: record.domain, dryRun: true });
      continue;
    }
    promoted.push(promoteToIndexNow(record.slug, { ...options, skipCatalogRegen: true }));
  }

  if (!dryRun && promoted.length) {
    const { regeneratePublishedCatalog } = require("./published-catalog-generator");
    regeneratePublishedCatalog();
  }

  return {
    requestedLimit: limit,
    promotedCount: promoted.length,
    promotedSlugs: promoted.map((entry) => entry.slug),
    promoted,
    dryRun,
  };
}

function listPublishedCandidates() {
  return listDurableCandidates().filter((record) => isIndexNowTier(record));
}

function isPublishedDurableCandidate(slug) {
  const record = getDurableCandidateBySlug(slug);
  return isIndexNowTier(record);
}

function resolveAcquisitionUrl(acquisitionPathOrRecord = {}) {
  if (acquisitionPathOrRecord?.acquisitionPath || acquisitionPathOrRecord?.auctionUrl) {
    return (
      acquisitionPathOrRecord.acquisitionPath?.actionUrl ||
      acquisitionPathOrRecord.acquisitionPath?.url ||
      acquisitionPathOrRecord.auctionUrl ||
      null
    );
  }
  return acquisitionPathOrRecord.actionUrl || acquisitionPathOrRecord.url || null;
}

function durableToCandidate(durable) {
  return productRecordToCandidate(durable);
}

function toDurableBaseRecord(candidate, existing = null) {
  return normalizeSessionCandidateToProductRecord(candidate, existing);
}

module.exports = {
  configureStorePaths,
  resetStorePaths,
  normalizeSlug,
  toDurableBaseRecord,
  durableToCandidate,
  productRecordToCandidate,
  getDurableCandidateBySlug,
  getDevDurableCandidateBySlug,
  upsertDurableCandidate,
  upsertProductRecord,
  upsertProductRecordFromAuction,
  listDurableCandidates,
  countDurableCandidates,
  listPublishedCandidates,
  listSitemapCandidates,
  promoteCandidate,
  promoteToIndexNow,
  batchPromoteIndexTier,
  validatePublishRequirements,
  isPublishedDurableCandidate,
  resolveAcquisitionUrl,
};
