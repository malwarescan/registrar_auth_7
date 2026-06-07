const { classifyDomainType, detectNamingLane, toSlug } = require("./classify-domain");

function normalizeAuctionCandidate({ auction, intentModel, scores, qualityFlags, whySurfaced, eligible, matchedTerms }) {
  const candidateId = `candidate_${toSlug(auction.domain)}_auction`;
  const statusVerifiedAt = new Date().toISOString();
  const statusExpiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  return {
    schemaVersion: "1.0",
    candidateId,
    candidateType: "domain-acquisition-candidate",
    domain: auction.domain,
    root: auction.root,
    tld: auction.tld,
    source: "namesilo-auction",
    salesMode: "auction",
    availability: "pending",
    sourceRecordId: auction.id,
    sourceUrl: auction.auctionUrl,
    status: "auction-active",
    statusVerifiedAt,
    statusExpiresAt,
    primaryIntent: intentModel.businessType,
    category: intentModel.productCategory,
    namingLane: detectNamingLane(auction.root),
    domainType: classifyDomainType(auction.root),
    whySurfaced,
    buyerFit: intentModel.targetBuyer.slice(0, 3),
    bestIf: "You can tolerate auction price movement for stronger category alignment.",
    lessIdealIf: "You need fixed pricing and immediate checkout.",
    catch: auction.currentBid > 500 ? "Bid is already elevated and may increase near close." : "Current bid is not final price.",
    tradeoffs: [],
    acquisitionPath: {
      type: "auction",
      provider: "NameSilo",
      priceCurrency: "USD",
      currentBid: auction.currentBid,
      bidCount: auction.bidCount,
      auctionEndsAt: auction.auctionEndsAt,
      auctionEndsIn: auction.auctionEndsIn,
      priceType: "current-bid",
      requiresConfirmation: true,
      actionUrl: auction.auctionUrl,
    },
    scores,
    confidence: Number((Math.max(0.3, Math.min(0.97, (eligible ? scores.overall : 35) / 100))).toFixed(2)),
    riskFlags: [],
    qualityFlags,
    alternatives: [],
    availableActions: ["explain", "compare", "shortlist", "watch-auction", "open-auction"],
    nextAction: "Watch auction timing, compare alternatives, then open the auction path.",
    surfacedAt: statusVerifiedAt,
    eligibleDecisionCandidate: eligible,
    matchedTerms,
    matchedConceptGroups: [],
    accidentalMatches: [],
  };
}

module.exports = {
  normalizeAuctionCandidate,
};
