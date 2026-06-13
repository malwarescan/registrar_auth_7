const { resolveLifecycleState, resolveProductPageMode } = require("../candidate-store/product-lifecycle");
const { resolveSeoTier } = require("../candidate-store/seo-tier");
const { buildRobots } = require("./seo-renderer");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function resolveAcquisitionUrl(record = {}) {
  return record.acquisitionPath?.actionUrl || record.acquisitionPath?.url || record.auctionUrl || null;
}

function renderDomainListingRecord(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
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

function streamDomainListingsNdjson(records, res, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  for (const record of records) {
    const listing = renderDomainListingRecord(record, metadataBaseUrl);
    if (listing) res.write(`${JSON.stringify(listing)}\n`);
  }
  res.end();
}

function renderDomainListingsJson(records, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL, options = {}) {
  const listings = records
    .map((record) => renderDomainListingRecord(record, metadataBaseUrl))
    .filter(Boolean);

  return {
    scope: options.scope || "indexed",
    count: listings.length,
    limit: options.limit ?? null,
    truncated: options.truncated === true,
    totalAvailable: options.totalAvailable ?? listings.length,
    allRequested: options.allRequested === true,
    allAllowed: options.allAllowed === true,
    listings,
  };
}

module.exports = {
  renderDomainListingRecord,
  streamDomainListingsNdjson,
  renderDomainListingsJson,
};
