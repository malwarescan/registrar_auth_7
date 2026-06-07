function applyRefinement(candidates, constraints = {}) {
  return candidates.filter((candidate) => {
    if (Array.isArray(constraints.onlyTlds) && constraints.onlyTlds.length && !constraints.onlyTlds.includes(candidate.tld)) {
      return false;
    }
    if (constraints.maxBudget != null) {
      const price = candidate.acquisitionPath?.currentBid ?? candidate.acquisitionPath?.registrationPrice;
      if (typeof price === "number" && price > Number(constraints.maxBudget)) return false;
    }
    if (constraints.excludeHyphens && candidate.domain.includes("-")) return false;
    if (constraints.shorterNames && candidate.root.length > 14) return false;
    if (constraints.includeAuctions === false && candidate.source === "namesilo-auction") return false;
    if (constraints.lessAiSounding && /ai|agent|automation/.test(candidate.root)) return false;
    if (constraints.morePremium && candidate.domainType !== "premium-short" && candidate.scores.brandability < 78) return false;
    if (constraints.moreExactMatch && candidate.domainType !== "exact-match") return false;
    return true;
  });
}

module.exports = {
  applyRefinement,
};
