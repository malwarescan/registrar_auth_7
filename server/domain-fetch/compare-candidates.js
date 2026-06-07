function pickHighest(candidates, key) {
  const ranked = [...candidates].sort((a, b) => (b.scores?.[key] || 0) - (a.scores?.[key] || 0));
  return ranked[0];
}

function compareDomainCandidates(candidates, priority = "best-overall") {
  const input = candidates.filter(Boolean);
  if (input.length < 2) {
    return {
      recommendedCandidateId: input[0]?.candidateId,
      recommendationReason: "Need at least two candidates for meaningful comparison.",
      comparisons: {},
      tradeoffs: [],
    };
  }

  const byPriority = {
    "best-overall": "overall",
    "strongest-brand": "brandability",
    "lowest-risk": "riskAdjusted",
    "lowest-acquisition-friction": "acquisitionFriction",
    "strongest-category-clarity": "categoryClarity",
    "best-resale-option": "tldTrust",
  };
  const metric = byPriority[priority] || "overall";
  const recommended = pickHighest(input, metric);
  const comparisons = {
    semanticFitWinner: pickHighest(input, "semanticFit")?.candidateId,
    brandabilityWinner: pickHighest(input, "brandability")?.candidateId,
    lowestRisk: pickHighest(input, "riskAdjusted")?.candidateId,
    lowestFriction: pickHighest(input, "acquisitionFriction")?.candidateId,
    strongestCategoryClarity: pickHighest(input, "categoryClarity")?.candidateId,
    strongestTldTrust: pickHighest(input, "tldTrust")?.candidateId,
  };

  const tradeoffs = input.map((candidate) => {
    const score = candidate.scores?.overall || 0;
    const friction = candidate.scores?.acquisitionFriction || 0;
    return `${candidate.domain}: overall ${score}, acquisition friction ${friction}.`;
  });

  return {
    recommendedCandidateId: recommended?.candidateId,
    recommendationReason: `Recommended by ${metric} priority.`,
    comparisons,
    tradeoffs,
  };
}

module.exports = {
  compareDomainCandidates,
};
