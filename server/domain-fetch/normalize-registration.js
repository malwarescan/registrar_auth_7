const { classifyDomainType, detectNamingLane, toSlug } = require("./classify-domain");

function normalizeRegistrationCandidate({ generated, intentModel, scores, qualityFlags, whySurfaced, eligible, matchedTerms, pricing = {} }) {
  const candidateId = `candidate_${toSlug(generated.domain)}_reg`;
  const statusVerifiedAt = new Date().toISOString();
  const statusExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  return {
    schemaVersion: "1.0",
    candidateId,
    candidateType: "domain-acquisition-candidate",
    domain: generated.domain,
    root: generated.root,
    tld: generated.tld,
    source: "namesilo-available",
    salesMode: "register",
    availability: "available",
    sourceRecordId: generated.domain,
    sourceUrl: `https://www.namesilo.com/domain/search-domains?query=${encodeURIComponent(generated.domain)}`,
    status: "available",
    statusVerifiedAt,
    statusExpiresAt,
    primaryIntent: intentModel.businessType,
    category: intentModel.productCategory,
    namingLane: generated.generationLane || detectNamingLane(generated.root),
    domainType: classifyDomainType(generated.root),
    whySurfaced,
    buyerFit: intentModel.targetBuyer.slice(0, 3),
    bestIf: "You want immediate registration with controllable cost.",
    lessIdealIf: "You want a shorter premium name from live auctions.",
    catch: "Availability can change quickly before checkout.",
    tradeoffs: [],
    acquisitionPath: {
      type: "register",
      provider: "NameSilo",
      registrationPrice: pricing.registrationPrice,
      renewalPrice: pricing.renewalPrice,
      priceCurrency: pricing.priceCurrency || "USD",
      priceType: "registration-price",
      requiresConfirmation: true,
      actionUrl: `https://www.namesilo.com/domain/search-domains?query=${encodeURIComponent(generated.domain)}`,
    },
    scores,
    confidence: Number((Math.max(0.3, Math.min(0.97, (eligible ? scores.overall : 35) / 100))).toFixed(2)),
    riskFlags: [],
    qualityFlags,
    alternatives: [],
    availableActions: ["explain", "compare", "shortlist", "open-registration"],
    nextAction: "Open registration path and confirm pricing before purchase.",
    surfacedAt: statusVerifiedAt,
    eligibleDecisionCandidate: eligible,
    generationLane: generated.generationLane,
    generationPass: generated.generationPass,
    matchedTerms,
    matchedConceptGroups: [],
    accidentalMatches: [],
  };
}

module.exports = {
  normalizeRegistrationCandidate,
};
