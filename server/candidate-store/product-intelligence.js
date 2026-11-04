const { evaluateQuality, clampScore } = require("../domain-fetch/evaluate-quality");
const { classifyDomainType, detectNamingLane } = require("../domain-fetch/classify-domain");
const { segmentWords } = require("./name-words");

// Category terms are matched as whole hyphen-separated tokens, or as the start
// or end of a concatenated name ("anudesk" ends with "desk", "legalai" ends
// with "ai"), so a name only gets a category it actually signals.
const CATEGORY_TERMS = [
  { terms: ["ai", "gpt", "bot", "ml"], label: "AI software" },
  { terms: ["desk", "help", "support", "service"], label: "Support software" },
  { terms: ["legal", "law", "attorney"], label: "Legal tech" },
  { terms: ["health", "med", "care", "clinic"], label: "Healthcare" },
  { terms: ["finance", "pay", "bank", "fund"], label: "Fintech" },
  { terms: ["shop", "store", "cart", "buy"], label: "E-commerce" },
  { terms: ["home", "house", "realty", "property"], label: "Real estate" },
  { terms: ["travel", "trip", "hotel", "fly"], label: "Travel" },
  { terms: ["game", "play", "bet", "casino"], label: "Gaming" },
  { terms: ["pizza", "food", "chef", "kitchen", "delivery"], label: "Food & delivery" },
];

function rootSignalsTerm(text, term) {
  const tokens = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.includes(term)) return true;
  return tokens.some((token) => token.length > term.length + 1 && (token.startsWith(term) || token.endsWith(term)));
}

function tldTrustScore(tld) {
  if (tld === ".com") return 96;
  if (tld === ".net") return 84;
  if (tld === ".co") return 78;
  if (tld === ".io") return 75;
  if (tld === ".ai") return 74;
  return 62;
}

function buildCategoryGuesses(root) {
  const text = String(root || "").toLowerCase();
  const guesses = CATEGORY_TERMS.filter((entry) => entry.terms.some((term) => rootSignalsTerm(text, term))).map(
    (entry) => entry.label
  );
  // No matched category means no buyer-intent context. Do not invent one:
  // a record without category or use-case signals is not eligible for indexing.
  return [...new Set(guesses)].slice(0, 4);
}

function buildBuyerUseCases(categoryGuesses, root) {
  const cases = [];
  categoryGuesses.forEach((category) => {
    if (/AI/i.test(category)) cases.push("AI product branding", "Automation platform");
    else if (/Support/i.test(category)) cases.push("Help desk software", "Customer operations");
    else if (/Legal/i.test(category)) cases.push("Legal workflow tool", "Compliance platform");
    else if (/Food/i.test(category)) cases.push("Local delivery brand", "Restaurant platform");
    else cases.push(`${category} brand`, `${category} SaaS`);
  });
  if (String(root || "").includes("desk")) cases.push("Workflow operations", "Front-office software");
  return [...new Set(cases)].slice(0, 6);
}

function buildRiskFlags(qualityFlags, root, tld) {
  const flags = [...(qualityFlags || [])];
  if (String(root || "").length > 22) flags.push("long-domain");
  if (tld && tld !== ".com") flags.push("non-com-tld");
  return [...new Set(flags)];
}

function buildRiskNotes(riskFlags) {
  if (!riskFlags.length) return [];
  const notes = [];
  if (riskFlags.includes("random-string")) notes.push("Reads as a random string of letters and digits; hard to say, spell or remember.");
  if (riskFlags.includes("gibberish")) notes.push("Naming quality may require extra brand explanation.");
  if (riskFlags.includes("hard-to-pronounce")) notes.push("Pronunciation may reduce word-of-mouth recall.");
  if (riskFlags.includes("long-domain")) notes.push("Length may reduce memorability and type-in traffic.");
  if (riskFlags.includes("non-com-tld")) notes.push("Non-.com TLD may reduce mainstream buyer trust.");
  if (riskFlags.includes("confusing-spelling")) notes.push("Spelling complexity may increase acquisition friction.");
  return notes.slice(0, 4);
}

function buildBaseScores({ root, tld, quality, currentBid }) {
  const trust = tldTrustScore(tld);
  const lengthPenalty = Math.max(0, String(root || "").length - 14) * 1.5;
  const randomString = quality.qualityFlags.includes("random-string");
  const categoryClarity = clampScore(
    72 - lengthPenalty - (quality.qualityFlags.includes("gibberish") ? 18 : 0) - (randomString ? 40 : 0)
  );
  const acquisitionSignal = clampScore(currentBid && currentBid < 250 ? 82 : currentBid && currentBid > 500 ? 58 : 68);
  const acquisitionEase = acquisitionSignal;
  const semanticFit = clampScore(52 + Math.min(12, String(root || "").length <= 12 ? 10 : 4) - (randomString ? 30 : 0));
  const buyerFit = clampScore(50 + Math.min(10, quality.brandability / 10));
  const riskAdjusted = clampScore(
    (quality.brandability + quality.pronounceability + trust) / 3 - quality.qualityFlags.length * 6
  );
  const overall = clampScore(
    quality.brandability * 0.22 +
      quality.pronounceability * 0.18 +
      trust * 0.2 +
      categoryClarity * 0.15 +
      acquisitionSignal * 0.1 +
      semanticFit * 0.1 +
      riskAdjusted * 0.05
  );
  return {
    overall,
    semanticFit,
    buyerFit,
    brandability: quality.brandability,
    pronounceability: quality.pronounceability,
    categoryClarity,
    tldTrust: trust,
    acquisitionSignal,
    acquisitionEase,
    acquisitionFriction: clampScore(100 - acquisitionEase),
    riskAdjusted,
  };
}

function analyzeProductIntelligence({ domain, root, tld, currentBid }) {
  const quality = evaluateQuality(root);
  const categoryGuesses = buildCategoryGuesses(root);
  const riskFlags = buildRiskFlags(quality.qualityFlags, root, tld);
  const words = segmentWords(root);
  return {
    baseScores: buildBaseScores({ root, tld, quality, currentBid }),
    qualityFlags: quality.qualityFlags,
    riskFlags,
    riskNotes: buildRiskNotes(riskFlags),
    categoryGuesses,
    buyerUseCases: buildBuyerUseCases(categoryGuesses, root),
    baseSignals: {
      matchedTerms: [],
      tld,
      domainType: classifyDomainType(root),
      namingLane: detectNamingLane(root),
      length: String(root || "").length,
      ...(words ? { words } : {}),
    },
  };
}

module.exports = {
  analyzeProductIntelligence,
  buildCategoryGuesses,
  buildBuyerUseCases,
  tldTrustScore,
};
