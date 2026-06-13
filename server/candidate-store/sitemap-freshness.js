const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { resolveLifecycleState } = require("./product-lifecycle");
const {
  isIndexNowTier,
  resolveAcquisitionUrl,
  isGraphComplete,
  isProductOfferSchemaComplete,
  MIN_OVERALL_SCORE,
  BLOCKING_QUALITY_FLAGS,
  hasCategoryOrUseCaseSignals,
} = require("./seo-tier");
const DEFAULT_SITEMAP_FRESHNESS_HOURS = 24;

function getSitemapFreshnessHours() {
  const configured = Number(process.env.SITEMAP_FRESHNESS_HOURS);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return DEFAULT_SITEMAP_FRESHNESS_HOURS;
}

function getSitemapFreshnessMs() {
  return getSitemapFreshnessHours() * 60 * 60 * 1000;
}

function isSitemapFresh(record, now = Date.now()) {
  if (!record?.domain || !record.slug) return false;
  if (resolveLifecycleState(record) !== "active") return false;
  if (!isIndexNowTier(record)) return false;
  if (!record.canonicalUrl || record.canonicalUrl.includes("?")) return false;
  if (!resolveAcquisitionUrl(record)) return false;
  if (record.status !== "auction-active") return false;

  if (record.auctionEndsAt) {
    const auctionEnds = new Date(record.auctionEndsAt).getTime();
    if (!Number.isNaN(auctionEnds) && auctionEnds <= now) return false;
  }

  const verifiedAt = record.statusVerifiedAt ? new Date(record.statusVerifiedAt).getTime() : 0;
  if (!verifiedAt || Number.isNaN(verifiedAt)) return false;
  return now - verifiedAt <= getSitemapFreshnessMs();
}

function validateSitemapEligibility(record, now = Date.now(), options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;

  if (!record) return "Candidate not found";
  if (!record.domain) return "Missing domain";
  if (!isSitemapFresh(record, now)) {
    if (resolveLifecycleState(record) !== "active") return "Lifecycle must be active";
    if (!isIndexNowTier(record)) return "Must be index-now tier";
    if (!record.canonicalUrl || record.canonicalUrl.includes("?")) return "Invalid canonical URL";
    if (record.status !== "auction-active") return `Status must be auction-active (got ${record.status || "unknown"})`;
    if (!resolveAcquisitionUrl(record)) return "Missing acquisition URL";

    const verifiedAt = record.statusVerifiedAt ? new Date(record.statusVerifiedAt).getTime() : 0;
    if (!verifiedAt || Number.isNaN(verifiedAt)) return "Missing statusVerifiedAt";
    if (now - verifiedAt > getSitemapFreshnessMs()) {
      return "statusVerifiedAt outside sitemap freshness window";
    }
    return "Not sitemap eligible";
  }

  const overall = record.baseScores?.overall ?? 0;
  if (overall < MIN_OVERALL_SCORE) return `Quality score below threshold (${overall} < ${MIN_OVERALL_SCORE})`;

  const blockingFlag = (record.qualityFlags || []).find((flag) => BLOCKING_QUALITY_FLAGS.has(flag));
  if (blockingFlag) return `Blocked by quality flag: ${blockingFlag}`;

  if (!isGraphComplete(record, metadataBaseUrl)) return "Product graph incomplete";
  if (!isProductOfferSchemaComplete(record, metadataBaseUrl)) return "Product + Offer schema incomplete";
  if (!hasCategoryOrUseCaseSignals(record)) return "Missing category or use-case signals";

  return null;
}

module.exports = {
  DEFAULT_SITEMAP_FRESHNESS_HOURS,
  getSitemapFreshnessHours,
  getSitemapFreshnessMs,
  isSitemapFresh,
  validateSitemapEligibility,
};
