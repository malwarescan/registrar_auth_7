const { clampScore } = require("./evaluate-quality");

function scoreCandidate({ root, tld, requiredHits, adjacentHits, quality, acquisitionSignal = 65, acquisitionFriction = 70 }) {
  const semanticFit = clampScore(44 + requiredHits.length * 14 + adjacentHits.length * 8 - Math.max(0, root.length - 16), 20, 97);
  const buyerFit = clampScore(48 + requiredHits.length * 11 + adjacentHits.length * 7, 20, 96);
  const categoryClarity = clampScore(45 + requiredHits.length * 12 + adjacentHits.length * 7, 20, 97);
  const tldTrust =
    tld === ".com" ? 96 : tld === ".net" ? 84 : tld === ".co" ? 78 : tld === ".io" ? 75 : tld === ".ai" ? 74 : 62;
  const riskAdjusted = clampScore((semanticFit + quality.brandability + quality.pronounceability + tldTrust) / 4);

  const overall = clampScore(
    semanticFit * 0.3 +
      buyerFit * 0.2 +
      quality.brandability * 0.2 +
      quality.pronounceability * 0.1 +
      categoryClarity * 0.1 +
      tldTrust * 0.08 +
      acquisitionSignal * 0.07 +
      riskAdjusted * 0.05
  );

  return {
    semanticFit,
    buyerFit,
    brandability: quality.brandability,
    pronounceability: quality.pronounceability,
    categoryClarity,
    tldTrust,
    acquisitionFriction,
    acquisitionSignal,
    riskAdjusted,
    overall,
  };
}

function isEligibleCandidate(candidate) {
  return (
    candidate.status === "available" || candidate.status === "auction-active" || candidate.status === "buy-now" || candidate.status === "make-offer"
  )
    && candidate.scores.semanticFit >= 60
    && candidate.scores.brandability >= 55
    && candidate.scores.pronounceability >= 55
    && candidate.scores.categoryClarity >= 50
    && !candidate.qualityFlags.includes("gibberish")
    && !candidate.qualityFlags.includes("accidental-substring-match")
    && Array.isArray(candidate.buyerFit)
    && candidate.buyerFit.length > 0;
}

module.exports = {
  scoreCandidate,
  isEligibleCandidate,
};
