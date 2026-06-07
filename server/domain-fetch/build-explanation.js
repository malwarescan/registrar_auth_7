function buildExplanation({ intentModel, matchedTerms, source, generationLane }) {
  const terms = (matchedTerms || []).slice(0, 3).join(", ");
  const category = String(intentModel.productCategory || "business").toLowerCase();
  if (source === "namesilo-auction") {
    return `Auction candidate aligned with ${category}${terms ? ` via ${terms}` : ""}.`;
  }
  if (source === "namesilo-available") {
    return `Available now candidate aligned with ${category}${terms ? ` via ${terms}` : ""}${generationLane ? ` (${generationLane})` : ""}.`;
  }
  return `Candidate aligned with ${category}.`;
}

function buildTradeoffs(candidate) {
  const tradeoffs = [];
  if (candidate.domainType === "exact-match" || candidate.domain.length > 18) tradeoffs.push("Clear intent but reduced brand flexibility.");
  if (candidate.tld !== ".com") tradeoffs.push("Alternative extension may reduce mainstream trust.");
  if (candidate.acquisitionPath?.type === "auction") tradeoffs.push("Final cost is uncertain until auction close.");
  if (candidate.qualityFlags?.length) tradeoffs.push("Naming quality constraints require extra review.");
  return tradeoffs.slice(0, 3);
}

module.exports = {
  buildExplanation,
  buildTradeoffs,
};
