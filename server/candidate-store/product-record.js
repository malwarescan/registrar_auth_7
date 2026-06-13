const { toSlug } = require("../domain-fetch/classify-domain");
const { analyzeProductIntelligence } = require("./product-intelligence");
const { applyLifecycleState, resolveLifecycleState } = require("./product-lifecycle");

function defaultSeoTierForRecord(existing) {
  const { SEO_TIER } = require("./seo-tier");
  if (existing?.seoTier) return existing.seoTier;
  if (existing?.indexable === true) return SEO_TIER.INDEX_NOW;
  return SEO_TIER.HOLD_NOINDEX;
}

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://snatch.auction";
const STATUS_TTL_MS = 15 * 60 * 1000;

function resolveAuctionStatus(auctionEndsAt, now = Date.now()) {
  if (!auctionEndsAt) return "auction-active";
  const ends = new Date(auctionEndsAt).getTime();
  if (Number.isNaN(ends) || ends <= now) return "auction-ended";
  return "auction-active";
}

function buildGraphId(slug) {
  return `${PUBLIC_BASE_URL}/domains/${slug}#graph`;
}

function normalizeAuctionToProductRecord(auction, existing = null, options = {}) {
  const domain = String(auction.domain || "").toLowerCase();
  const slug = toSlug(domain);
  if (!slug || !domain.includes(".")) return null;

  const auctionUrl = auction.auctionUrl || auction.url || `https://www.namesilo.com/auctions/${domain}`;
  const nowIso = new Date().toISOString();
  const status = resolveAuctionStatus(auction.auctionEndsAt);
  const intelligence = analyzeProductIntelligence({
    domain,
    root: auction.root,
    tld: auction.tld,
    currentBid: auction.currentBid,
  });

  const record = {
    slug,
    domain,
    tld: auction.tld || `.${domain.split(".").pop()}`,
    source: "namesilo-auction",
    provider: "NameSilo",
    status,
    auctionUrl,
    currentBid: auction.currentBid ?? null,
    bidCount: auction.bidCount ?? 0,
    auctionEndsAt: auction.auctionEndsAt || null,
    statusVerifiedAt: nowIso,
    statusExpiresAt: new Date(Date.now() + STATUS_TTL_MS).toISOString(),
    canonicalUrl: `${PUBLIC_BASE_URL}/domains/${slug}`,
    acquisitionPath: {
      type: "auction",
      provider: "NameSilo",
      priceCurrency: "USD",
      currentBid: auction.currentBid ?? null,
      bidCount: auction.bidCount ?? 0,
      auctionEndsAt: auction.auctionEndsAt || null,
      priceType: "current-bid",
      requiresConfirmation: true,
      actionUrl: auctionUrl,
      url: auctionUrl,
    },
    baseScores: intelligence.baseScores,
    baseSignals: intelligence.baseSignals,
    qualityFlags: intelligence.qualityFlags,
    riskFlags: intelligence.riskFlags,
    riskNotes: intelligence.riskNotes,
    categoryGuesses: intelligence.categoryGuesses,
    buyerUseCases: intelligence.buyerUseCases,
    comparableDomains: existing?.comparableDomains || [],
    graphId: buildGraphId(slug),
    published: existing?.published === true,
    indexable: existing?.indexable === true,
    seoTier: defaultSeoTierForRecord(existing),
    publishedAt: existing?.publishedAt || null,
    candidateId: existing?.candidateId || `product_${slug}`,
  };

  if (options.preservePromotion === false) {
    const { SEO_TIER } = require("./seo-tier");
    record.published = false;
    record.indexable = false;
    record.seoTier = SEO_TIER.HOLD_NOINDEX;
    record.publishedAt = null;
  }

  return applyLifecycleState(record, existing);
}

function normalizeSessionCandidateToProductRecord(candidate, existing = null) {
  if (!candidate?.domain) return null;
  const slug = toSlug(candidate.domain);
  const auctionUrl = candidate.acquisitionPath?.actionUrl || candidate.acquisitionPath?.url;
  if (!auctionUrl) return null;

  const auction = {
    domain: candidate.domain,
    root: candidate.root || candidate.domain.split(".")[0],
    tld: candidate.tld || `.${candidate.domain.split(".").pop()}`,
    currentBid: candidate.acquisitionPath?.currentBid,
    bidCount: candidate.acquisitionPath?.bidCount,
    auctionEndsAt: candidate.acquisitionPath?.auctionEndsAt,
    auctionUrl,
  };

  const record = normalizeAuctionToProductRecord(auction, existing);
  if (!record) return null;

  if (candidate.scores) record.baseScores = { ...record.baseScores, ...candidate.scores };
  if (candidate.matchedTerms?.length) {
    record.baseSignals = { ...record.baseSignals, matchedTerms: candidate.matchedTerms.slice(0, 6) };
  }
  if (candidate.qualityFlags?.length) {
    record.qualityFlags = [...new Set([...record.qualityFlags, ...candidate.qualityFlags])];
  }
  if (candidate.statusVerifiedAt) record.statusVerifiedAt = candidate.statusVerifiedAt;
  if (candidate.statusExpiresAt) record.statusExpiresAt = candidate.statusExpiresAt;
  if (candidate.candidateId) record.candidateId = candidate.candidateId;
  return record;
}

function productRecordToCandidate(record) {
  if (!record) return null;
  const lifecycle = resolveLifecycleState(record);
  const inactive = lifecycle !== "active";
  return {
    slug: record.slug,
    domain: record.domain,
    source: record.source,
    status: record.status,
    lifecycleState: record.lifecycleState || lifecycle,
    canonicalUrl: record.canonicalUrl,
    acquisitionPath: record.acquisitionPath,
    scores: record.baseScores || {},
    matchedTerms: record.baseSignals?.matchedTerms || [],
    tld: record.tld,
    domainType: record.baseSignals?.domainType,
    namingLane: record.baseSignals?.namingLane,
    candidateId: record.candidateId || `product_${record.slug}`,
    statusVerifiedAt: record.statusVerifiedAt,
    statusExpiresAt: record.statusExpiresAt,
    qualityFlags: record.qualityFlags || [],
    riskFlags: record.riskFlags || [],
    categoryGuesses: record.categoryGuesses || [],
    buyerUseCases: record.buyerUseCases || [],
    catch: inactive ? "Auction listing is no longer active." : "Current bid is not final price.",
    nextAction: inactive
      ? "Review comparable domains or wait for a fresh auction listing."
      : "Watch auction timing, compare alternatives, then open the auction path.",
    lessIdealIf: "You need fixed pricing and immediate checkout.",
    buyerFit: record.buyerUseCases || [],
    relatedCandidates: record.relatedCandidates || [],
    alternatives: record.alternatives || [],
  };
}

function candidateViewToProductRecord(candidate, overrides = {}) {
  if (!candidate?.domain) return null;
  const slug = candidate.slug || toSlug(candidate.domain);
  return {
    slug,
    domain: candidate.domain,
    tld: candidate.tld || `.${candidate.domain.split(".").pop()}`,
    provider: candidate.acquisitionPath?.provider || candidate.provider || "NameSilo",
    source: candidate.source || "namesilo-auction",
    status: candidate.status,
    canonicalUrl: candidate.canonicalUrl || `${PUBLIC_BASE_URL}/domains/${slug}`,
    acquisitionPath: candidate.acquisitionPath,
    currentBid: candidate.acquisitionPath?.currentBid ?? null,
    bidCount: candidate.acquisitionPath?.bidCount ?? 0,
    auctionEndsAt: candidate.acquisitionPath?.auctionEndsAt ?? null,
    auctionUrl: candidate.acquisitionPath?.actionUrl || candidate.acquisitionPath?.url || null,
    baseScores: candidate.scores || candidate.baseScores || {},
    categoryGuesses: candidate.categoryGuesses || [],
    buyerUseCases: candidate.buyerUseCases || [],
    riskFlags: candidate.riskFlags || [],
    comparableDomains: candidate.comparableDomains || [],
    statusVerifiedAt: candidate.statusVerifiedAt,
    candidateId: candidate.candidateId || `product_${slug}`,
    graphId: buildGraphId(slug),
    published: overrides.published ?? candidate.published,
    indexable: overrides.indexable ?? candidate.indexable,
    seoTier: overrides.seoTier ?? candidate.seoTier,
    ...overrides,
  };
}

module.exports = {
  normalizeAuctionToProductRecord,
  normalizeSessionCandidateToProductRecord,
  productRecordToCandidate,
  candidateViewToProductRecord,
  buildGraphId,
  resolveAuctionStatus,
};
