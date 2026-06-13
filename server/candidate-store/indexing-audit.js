const {
  SEO_TIER,
  MIN_OVERALL_SCORE,
  isGraphComplete,
  isProductOfferSchemaComplete,
  resolveSeoTier,
  isIndexNowTier,
  validateIndexNowEligibility,
} = require("./seo-tier");
const { resolveLifecycleState } = require("./product-lifecycle");
const { isFreshRecord, passesQualityThreshold } = require("./promotion-audit");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function auditIndexingCandidates(records, options = {}) {
  const now = options.now ?? Date.now();
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const rejectionReasons = {};
  const eligibleCandidates = [];
  const topCandidates = [];

  let activeAuctions = 0;
  let graphCompleteRecords = 0;
  let schemaCompleteRecords = 0;
  let indexNowRecords = 0;
  let holdNoindexRecords = 0;
  let archiveRecords = 0;

  for (const record of records) {
    const lifecycle = resolveLifecycleState(record);
    if (lifecycle === "active" && record.status === "auction-active") activeAuctions += 1;
    if (isGraphComplete(record, metadataBaseUrl)) graphCompleteRecords += 1;
    if (isProductOfferSchemaComplete(record, metadataBaseUrl)) schemaCompleteRecords += 1;

    const tier = resolveSeoTier(record);
    if (tier === SEO_TIER.INDEX_NOW) indexNowRecords += 1;
    else if (tier === SEO_TIER.HOLD_NOINDEX) holdNoindexRecords += 1;
    else archiveRecords += 1;

    if (isIndexNowTier(record)) continue;

    const rejection = validateIndexNowEligibility(record, now, { metadataBaseUrl, assetsDir: options.assetsDir });
    if (rejection) {
      rejectionReasons[rejection] = (rejectionReasons[rejection] || 0) + 1;
    } else {
      eligibleCandidates.push({
        slug: record.slug,
        domain: record.domain,
        overall: record.baseScores?.overall ?? 0,
        tier: resolveSeoTier(record),
      });
    }

    if (lifecycle === "active" && !isIndexNowTier(record)) {
      topCandidates.push({
        slug: record.slug,
        domain: record.domain,
        overall: record.baseScores?.overall ?? 0,
        tier,
        graphComplete: isGraphComplete(record, metadataBaseUrl),
        schemaComplete: isProductOfferSchemaComplete(record, metadataBaseUrl),
        fresh: isFreshRecord(record, now),
        qualityPass: passesQualityThreshold(record),
      });
    }
  }

  eligibleCandidates.sort((a, b) => b.overall - a.overall || a.slug.localeCompare(b.slug));
  topCandidates.sort((a, b) => b.overall - a.overall || a.slug.localeCompare(b.slug));

  return {
    totalRecords: records.length,
    activeAuctions,
    graphCompleteRecords,
    schemaCompleteRecords,
    indexNowRecords,
    holdNoindexRecords,
    archiveRecords,
    indexNowCandidates: indexNowRecords,
    holdNoindexCandidates: holdNoindexRecords,
    archiveCandidates: archiveRecords,
    indexNowEligibleRecords: eligibleCandidates.length,
    top100EligibleSlugs: eligibleCandidates.slice(0, 100).map((entry) => entry.slug),
    topEligible: eligibleCandidates.slice(0, 100),
    topCandidatesByScore: topCandidates.slice(0, 100),
    rejectionReasons,
    minOverallScore: MIN_OVERALL_SCORE,
  };
}

module.exports = {
  auditIndexingCandidates,
};
