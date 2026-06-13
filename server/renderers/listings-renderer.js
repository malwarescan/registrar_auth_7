const { resolveLifecycleState, resolveProductPageMode } = require("../candidate-store/product-lifecycle");
const { resolveSeoTier } = require("../candidate-store/seo-tier");
const { buildRobots } = require("./seo-renderer");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function resolveAcquisitionUrl(record = {}) {
  return record.acquisitionPath?.actionUrl || record.acquisitionPath?.url || record.auctionUrl || null;
}

function renderDomainListing(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  if (!record?.slug || !record.domain) return null;

  const canonicalUrl = record.canonicalUrl || `${metadataBaseUrl}/domains/${record.slug}`;
  const lifecycleState = resolveLifecycleState(record);
  const seoTier = resolveSeoTier(record);
  const pageMode = resolveProductPageMode(record);
  const scores = record.baseScores || {};

  return {
    type: "DomainListing",
    domain: record.domain,
    slug: record.slug,
    url: canonicalUrl,
    canonicalUrl,
    status: record.status,
    lifecycleState,
    seoTier,
    robots: buildRobots(record, pageMode),
    provider: record.provider || record.acquisitionPath?.provider || "NameSilo",
    source: record.source || "namesilo-auction",
    auction: {
      url: resolveAcquisitionUrl(record),
      currentBid: record.currentBid ?? record.acquisitionPath?.currentBid ?? null,
      bidCount: record.bidCount ?? record.acquisitionPath?.bidCount ?? 0,
      endsAt: record.auctionEndsAt ?? record.acquisitionPath?.auctionEndsAt ?? null,
    },
    scores: {
      overall: scores.overall ?? null,
      tldTrust: scores.tldTrust ?? null,
      brandability: scores.brandability ?? null,
      pronounceability: scores.pronounceability ?? null,
    },
    categoryGuesses: record.categoryGuesses || [],
    buyerUseCases: record.buyerUseCases || [],
    graphUrl: `${metadataBaseUrl}/api/domains/${record.slug}/graph.json`,
    updatedAt: record.updatedAt || record.statusVerifiedAt || record.publishedAt || null,
    statusVerifiedAt: record.statusVerifiedAt || null,
  };
}

function renderDomainListingsNdjson(records, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return records
    .map((record) => renderDomainListing(record, metadataBaseUrl))
    .filter(Boolean);
}

function renderDomainListingsJson(records, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL, meta = {}) {
  const listings = renderDomainListingsNdjson(records, metadataBaseUrl);
  return {
    scope: meta.scope || "indexed",
    count: listings.length,
    limit: meta.limit ?? null,
    truncated: meta.truncated === true,
    totalAvailable: meta.totalAvailable ?? listings.length,
    allRequested: meta.allRequested === true,
    allAllowed: meta.allAllowed === true,
    listings,
  };
}

module.exports = {
  renderDomainListing,
  renderDomainListingsNdjson,
  renderDomainListingsJson,
};
