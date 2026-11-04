const { listDurableCandidates, listSitemapCandidates } = require("./durable-candidates");
const { resolveSeoTier, SEO_TIER } = require("./seo-tier");
const { resolveLifecycleState } = require("./product-lifecycle");

const LISTING_SCOPES = new Set(["all", "indexed", "active", "archive"]);

function isBareDurableListing(record) {
  if (!record?.slug || !record.domain) return false;
  if (!record.canonicalUrl || record.canonicalUrl.includes("?")) return false;
  return true;
}

function listListingCandidates(scope = "all", options = {}) {
  const normalizedScope = LISTING_SCOPES.has(scope) ? scope : "all";

  if (normalizedScope === "all") {
    return listDurableCandidates().filter(isBareDurableListing);
  }

  if (normalizedScope === "indexed") {
    return listSitemapCandidates(options);
  }

  const records = listDurableCandidates();

  if (normalizedScope === "active") {
    return records.filter((record) => {
      if (!isBareDurableListing(record)) return false;
      return resolveLifecycleState(record) === "active";
    });
  }

  return records.filter((record) => {
    if (!isBareDurableListing(record)) return false;
    return resolveSeoTier(record) === SEO_TIER.ARCHIVE;
  });
}

function countListingCandidates(scope = "all", options = {}) {
  return listListingCandidates(scope, options).length;
}

module.exports = {
  LISTING_SCOPES,
  isBareDurableListing,
  listListingCandidates,
  countListingCandidates,
};
