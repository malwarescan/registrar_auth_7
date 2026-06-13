const fs = require("fs");
const path = require("path");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function resolveLifecycleState(record) {
  return require("./product-lifecycle").resolveLifecycleState(record);
}

function buildDomainProductGraphRef() {
  return require("./domain-graph").buildDomainProductGraph;
}

const SEO_TIER = {
  INDEX_NOW: "index-now",
  HOLD_NOINDEX: "hold-noindex",
  ARCHIVE: "archive",
};

const MIN_OVERALL_SCORE = 55;
const BLOCKING_QUALITY_FLAGS = new Set(["gibberish", "excessive-length", "spam"]);

const ROOT = path.resolve(__dirname, "..", "..");

function resolveAcquisitionUrl(record = {}) {
  return record.acquisitionPath?.actionUrl || record.acquisitionPath?.url || record.auctionUrl || null;
}

function isGraphComplete(record, metadataBaseUrl) {
  const buildDomainProductGraph = buildDomainProductGraphRef();
  const graph = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graph?.["@graph"]?.length) return false;
  return graph["@graph"].some((node) => node["@type"] === "Product");
}

function isProductOfferSchemaComplete(record, metadataBaseUrl) {
  const buildDomainProductGraph = buildDomainProductGraphRef();
  const graph = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graph?.["@graph"]?.length) return false;
  const types = new Set(graph["@graph"].map((node) => node["@type"]).filter(Boolean));
  return types.has("Product") && types.has("Offer");
}

function hasCategoryOrUseCaseSignals(record) {
  return Boolean(record.categoryGuesses?.length || record.buyerUseCases?.length);
}

function hasProductAsset(record, assetsDir) {
  if (record.productAssetUrl || record.ogImageUrl) return true;
  if (!record.slug) return false;
  const dir = assetsDir || path.join(ROOT, "domain-assets");
  if (fs.existsSync(path.join(dir, `${record.slug}.png`))) return true;
  return true;
}

function resolveSeoTier(record) {
  if (!record?.domain) return SEO_TIER.ARCHIVE;

  const lifecycle = resolveLifecycleState(record);
  if (lifecycle !== "active") return SEO_TIER.ARCHIVE;

  if (record.seoTier === SEO_TIER.INDEX_NOW) return SEO_TIER.INDEX_NOW;
  if (record.seoTier === SEO_TIER.HOLD_NOINDEX) return SEO_TIER.HOLD_NOINDEX;
  if (record.seoTier === SEO_TIER.ARCHIVE) return SEO_TIER.ARCHIVE;

  if (record.indexable === true) return SEO_TIER.INDEX_NOW;
  return SEO_TIER.HOLD_NOINDEX;
}

function isIndexNowTier(record) {
  return resolveSeoTier(record) === SEO_TIER.INDEX_NOW;
}

function defaultSeoTierForRecord(existing) {
  if (existing?.seoTier) return existing.seoTier;
  if (existing?.indexable === true) return SEO_TIER.INDEX_NOW;
  return SEO_TIER.HOLD_NOINDEX;
}

function applySeoTier(record, tier, options = {}) {
  const now = new Date().toISOString();
  if (tier === SEO_TIER.INDEX_NOW) {
    return {
      ...record,
      seoTier: SEO_TIER.INDEX_NOW,
      indexable: true,
      published: true,
      publishedAt: record.publishedAt || now,
      tierPromotedAt: options.tierPromotedAt || now,
    };
  }
  if (tier === SEO_TIER.HOLD_NOINDEX) {
    return {
      ...record,
      seoTier: SEO_TIER.HOLD_NOINDEX,
      indexable: false,
      published: false,
      publishedAt: null,
    };
  }
  return {
    ...record,
    seoTier: SEO_TIER.ARCHIVE,
    indexable: false,
    published: false,
  };
}

function validateIndexNowEligibility(record, now = Date.now(), options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  if (!record) return "Candidate not found";
  if (!record.domain) return "Missing domain";
  if (!record.canonicalUrl || record.canonicalUrl.includes("?")) return "Invalid canonical URL";
  if (record.status !== "auction-active") return `Status must be auction-active (got ${record.status || "unknown"})`;
  if (!resolveAcquisitionUrl(record)) return "Missing acquisition URL";
  if (resolveLifecycleState(record) !== "active") return "Lifecycle must be active";

  const expiresAt = record.statusExpiresAt ? new Date(record.statusExpiresAt).getTime() : 0;
  if (!expiresAt || Number.isNaN(expiresAt) || expiresAt <= now) return "statusExpiresAt must be in the future";

  if (record.auctionEndsAt) {
    const auctionEnds = new Date(record.auctionEndsAt).getTime();
    if (!Number.isNaN(auctionEnds) && auctionEnds <= now) return "Auction has ended";
  }

  const overall = record.baseScores?.overall ?? 0;
  if (overall < MIN_OVERALL_SCORE) return `Quality score below threshold (${overall} < ${MIN_OVERALL_SCORE})`;

  const blockingFlag = (record.qualityFlags || []).find((flag) => BLOCKING_QUALITY_FLAGS.has(flag));
  if (blockingFlag) return `Blocked by quality flag: ${blockingFlag}`;

  if (!isGraphComplete(record, metadataBaseUrl)) return "Product graph incomplete";
  if (!isProductOfferSchemaComplete(record, metadataBaseUrl)) return "Product + Offer schema incomplete";
  if (!hasCategoryOrUseCaseSignals(record)) return "Missing category or use-case signals";
  if (!hasProductAsset(record, options.assetsDir)) return "Missing product asset";

  return null;
}

module.exports = {
  SEO_TIER,
  MIN_OVERALL_SCORE,
  BLOCKING_QUALITY_FLAGS,
  resolveAcquisitionUrl,
  isGraphComplete,
  isProductOfferSchemaComplete,
  hasCategoryOrUseCaseSignals,
  hasProductAsset,
  resolveSeoTier,
  isIndexNowTier,
  defaultSeoTierForRecord,
  applySeoTier,
  validateIndexNowEligibility,
};
