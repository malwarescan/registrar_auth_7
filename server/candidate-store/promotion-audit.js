const { validatePromotionGate, MIN_OVERALL_SCORE, isGraphComplete } = require("./promotion-gate");

const BLOCKING_QUALITY_FLAGS = new Set(["gibberish", "excessive-length"]);
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function isFreshRecord(record, now = Date.now()) {
  const expiresAt = record?.statusExpiresAt ? new Date(record.statusExpiresAt).getTime() : 0;
  return Boolean(expiresAt && !Number.isNaN(expiresAt) && expiresAt > now);
}

function passesQualityThreshold(record) {
  const overall = record?.baseScores?.overall ?? 0;
  if (overall < MIN_OVERALL_SCORE) return false;
  return !(record.qualityFlags || []).some((flag) => BLOCKING_QUALITY_FLAGS.has(flag));
}

function auditPromotionCandidates(records, options = {}) {
  const now = options.now ?? Date.now();
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const rejectionReasons = {};
  const eligibleSlugs = [];

  let activeAuctions = 0;
  let freshRecords = 0;
  let qualityPassRecords = 0;
  let graphCompleteRecords = 0;

  for (const record of records) {
    if (record.status === "auction-active") activeAuctions += 1;
    if (isFreshRecord(record, now)) freshRecords += 1;
    if (passesQualityThreshold(record)) qualityPassRecords += 1;
    if (isGraphComplete(record, metadataBaseUrl)) graphCompleteRecords += 1;

    const rejection = validatePromotionGate(record, now, { metadataBaseUrl });
    if (rejection) {
      rejectionReasons[rejection] = (rejectionReasons[rejection] || 0) + 1;
    } else {
      eligibleSlugs.push({
        slug: record.slug,
        domain: record.domain,
        overall: record.baseScores?.overall ?? 0,
      });
    }
  }

  eligibleSlugs.sort((a, b) => b.overall - a.overall || a.slug.localeCompare(b.slug));

  return {
    totalRecords: records.length,
    activeAuctions,
    freshRecords,
    qualityPassRecords,
    graphCompleteRecords,
    publishEligibleRecords: eligibleSlugs.length,
    top100EligibleSlugs: eligibleSlugs.slice(0, 100).map((entry) => entry.slug),
    topEligible: eligibleSlugs.slice(0, 100),
    rejectionReasons,
  };
}

module.exports = {
  auditPromotionCandidates,
  isFreshRecord,
  passesQualityThreshold,
};
