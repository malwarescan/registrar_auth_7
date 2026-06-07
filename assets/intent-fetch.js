const starterBriefs = [
  {
    id: "ai-receptionist",
    title: "AI receptionist",
    subtitle: "Local service businesses, .com/.ai, under $500",
    prompt:
      "I’m building an AI receptionist for local service businesses. I need a name that feels trustworthy, short, practical, and affordable. Prefer .com, but I’m open to .ai and auction options under $500.",
  },
  {
    id: "cybersecurity-monitoring",
    title: "Cybersecurity monitor",
    subtitle: "Threat intelligence, defensive, .com/.net",
    prompt:
      "I’m building a cybersecurity tool for dark web monitoring and threat intelligence. It should feel credible, defensive, enterprise-ready, and legally safe. Prefer .com or .net.",
  },
  {
    id: "luxury-emerald",
    title: "Luxury emerald brand",
    subtitle: "Colombian provenance, premium .com",
    prompt:
      "I’m building a luxury emerald jewelry brand tied to Colombian provenance, rare stones, and old-world craftsmanship. It should feel premium, elegant, and collectible. Avoid cheap ecommerce wording.",
  },
  {
    id: "local-seo",
    title: "Local SEO platform",
    subtitle: "Agencies, Google Business Profile, reports",
    prompt:
      "I’m building a local SEO dashboard for agencies that manage Google Business Profiles, citations, reviews, and ranking reports for small businesses. I want a practical SaaS name with strong local-search clarity.",
  },
  {
    id: "founder-saas",
    title: "Founder workflow tool",
    subtitle: "Launches, tasks, docs, feedback",
    prompt:
      "I’m building a SaaS workflow tool for startup founders who need to manage launches, tasks, documents, and customer feedback in one place. I want a crisp, modern .com-style brand name.",
  },
];

const constraintOptions = [
  { id: "prefer-com", label: "Prefer .com", phrase: "Constraint: prefer .com domains first." },
  { id: "include-auctions", label: "Include auctions", phrase: "Constraint: include active auctions." },
  { id: "under-500", label: "Under $500", phrase: "Constraint: prioritize options under $500 where possible." },
  { id: "short-names", label: "Short names", phrase: "Constraint: prioritize short names." },
  { id: "avoid-hyphens", label: "Avoid hyphens", phrase: "Constraint: avoid hyphens if possible." },
  { id: "more-premium", label: "More premium", phrase: "Constraint: prioritize premium quality naming." },
  { id: "more-brandable", label: "More brandable", phrase: "Constraint: prioritize brandable names." },
  { id: "more-exact", label: "More exact-match", phrase: "Constraint: prioritize exact-match style names." },
];

const statusSteps = [
  "Interpreting brief",
  "Scanning live auctions",
  "Ranking auction candidates",
  "Generating domain paths",
  "Checking NameSilo availability",
  "Building decision candidates",
];

const filterLabel = {
  auction: "Auction",
  available: "Available",
  premium: "Premium",
  "low-risk": "Low risk",
  brandable: "Brandable",
  "ai-fit": "AI fit",
  "under-500": "Under $500",
};

const riskLabel = {
  "renewal-cost": "Renewal cost",
  "trademark-watch": "Trademark watch",
  "category-crowded": "Crowded category",
  "low-liquidity": "Liquidity risk",
  gibberish: "Low lexical coherence",
  "accidental-substring-match": "Accidental substring overlap",
  "hard-to-pronounce": "Hard to pronounce",
  "excessive-length": "Excessive length",
  "repeated-characters": "Repeated characters",
  "weak-category-fit": "Weak category fit",
  "confusing-spelling": "Confusing spelling",
  "spam-like": "Spam-like pattern",
};

const sourceLabel = {
  available: "Available",
  auction: "Live NameSilo Auction",
  premium: "Premium",
  suggestion: "Generated Suggestion",
  "generated-available": "Available at NameSilo",
  "namesilo-auction": "Live NameSilo Auction",
  "namesilo-available": "Available at NameSilo",
};

const salesModeLabel = {
  "buy-now": "Buy now",
  auction: "Auction",
  "make-offer": "Make offer",
  register: "Register",
};

const signalBadgeClass = {
  high: "green",
  medium: "amber",
  low: "",
};

const isDevelopment = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const debugCandidates = isDevelopment && new URLSearchParams(location.search).get("debugCandidates") === "1";

const REJECTION_CODES = {
  SEMANTIC_FIT_BELOW_THRESHOLD: "SEMANTIC_FIT_BELOW_THRESHOLD",
  BRANDABILITY_BELOW_THRESHOLD: "BRANDABILITY_BELOW_THRESHOLD",
  PRONOUNCEABILITY_BELOW_THRESHOLD: "PRONOUNCEABILITY_BELOW_THRESHOLD",
  NO_MEANINGFUL_TERM_MATCH: "NO_MEANINGFUL_TERM_MATCH",
  NO_CONCEPT_GROUP_MATCH: "NO_CONCEPT_GROUP_MATCH",
  NO_DEFENSIBLE_BUYER_FIT: "NO_DEFENSIBLE_BUYER_FIT",
  GIBBERISH_PATTERN: "GIBBERISH_PATTERN",
  ACCIDENTAL_SUBSTRING_MATCH: "ACCIDENTAL_SUBSTRING_MATCH",
  REPEATED_CHARACTER_PATTERN: "REPEATED_CHARACTER_PATTERN",
  CONFUSING_SPELLING: "CONFUSING_SPELLING",
  EXCESSIVE_LENGTH: "EXCESSIVE_LENGTH",
  SPAM_LIKE_CONSTRUCTION: "SPAM_LIKE_CONSTRUCTION",
  WEAK_CATEGORY_FIT: "WEAK_CATEGORY_FIT",
};

const LUXURY_EMERALD_TAXONOMY = {
  primary: ["emerald", "gemstone", "jewelry", "jewellery", "jewel", "atelier", "maison", "vault", "rare", "green", "gem", "stone"],
  provenance: ["colombia", "colombian", "muzo", "otanche", "coscuez", "chivor", "andes", "bogota"],
  luxury: ["heritage", "reserve", "collection", "house", "atelier", "gallery", "fine", "prestige", "heirloom", "bespoke"],
  buyerUseCases: [
    "Luxury jewelry house",
    "Emerald dealer",
    "Collector-focused boutique",
    "High-jewelry atelier",
    "Gemstone marketplace",
  ],
};

const SYNONYM_GROUPS = {
  jewelry: ["jewelry", "jewellery", "jewel", "atelier", "maison", "collection", "boutique"],
  gemstone: ["emerald", "gem", "gemstone", "stone", "green", "rare"],
  provenance: ["colombia", "colombian", "muzo", "chivor", "andes", "bogota", "origin"],
  luxury: ["luxury", "premium", "fine", "reserve", "heirloom", "heritage", "prestige", "bespoke", "vault", "gallery"],
  ai: ["ai", "agent", "assistant", "automation", "copilot"],
  cyber: ["cyber", "security", "threat", "fraud", "defense"],
  local: ["local", "seo", "agency", "rank", "listing", "review"],
};

const COMMON_SEGMENTS = new Set([
  ...Object.values(SYNONYM_GROUPS).flat(),
  ...LUXURY_EMERALD_TAXONOMY.primary,
  ...LUXURY_EMERALD_TAXONOMY.provenance,
  ...LUXURY_EMERALD_TAXONOMY.luxury,
  "brand",
  "trust",
  "works",
  "labs",
  "studio",
  "collective",
  "vault",
  "house",
  "hq",
  "flow",
  "pilot",
  "forge",
  "stack",
  "cloud",
  "desk",
  "watch",
  "secure",
  "founder",
  "saas",
  "growth",
  "search",
  "agency",
  "assistant",
]);

const state = {
  fetchState: "idle",
  fetchPhase: "idle",
  intent: "",
  lastError: "",
  selectedExampleId: null,
  activeConstraints: [],
  constraintsOpen: false,
  activeStepIndex: 0,
  opportunities: [],
  sortMode: "fetch-match",
  activeFilters: [],
  expandedId: null,
  watchedIds: [],
  compareIds: [],
  usedSuggestionFallback: false,
  noQualifiedLive: false,
  rejectedCandidates: [],
  candidateDiagnostics: [],
  lastFetchTimestamp: null,
  rawCandidateCount: 0,
  diagnosticsFilter: "all",
  diagnosticsQuery: "",
  sourceSummary: null,
  fetchDiagnostics: null,
  availabilityFailed: false,
  phaseMetrics: {
    auctionRawCount: 0,
    auctionQualifiedCount: 0,
    generatedCount: 0,
    availabilityCheckedCount: 0,
    availableCount: 0,
    registrationQualifiedCount: 0,
    generationPass: 0,
    errors: [],
  },
};

function tokenizeIntent(input) {
  const stopwords = new Set([
    "building",
    "build",
    "product",
    "platform",
    "service",
    "startup",
    "tool",
    "app",
    "website",
    "dashboard",
    "software",
    "business",
    "businesses",
    "company",
    "need",
    "name",
    "brand",
  ]);
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token) && !token.startsWith("constraint"));
}

function pickCategory(tokens) {
  if (tokens.some((t) => ["cyber", "threat", "security", "fraud"].includes(t))) return "Cybersecurity";
  if (tokens.some((t) => ["local", "seo", "rank", "agency"].includes(t))) return "Local growth";
  if (tokens.some((t) => ["founder", "saas", "workflow", "startup"].includes(t))) return "SaaS workflows";
  if (tokens.some((t) => ["ai", "agent", "assistant", "automation"].includes(t))) return "AI product";
  return "Domain acquisition";
}

function pickBuyerFit(tokens) {
  if (tokens.some((t) => ["cyber", "threat", "security"].includes(t))) return ["Security teams", "Threat monitoring", "Enterprise buyers"];
  if (tokens.some((t) => ["local", "seo", "agency", "rank"].includes(t))) return ["Local agencies", "Growth operators", "Service businesses"];
  if (tokens.some((t) => ["founder", "saas", "startup"].includes(t))) return ["Startup founders", "Product teams", "SMB software buyers"];
  if (tokens.some((t) => ["ai", "agent", "assistant"].includes(t))) return ["AI products", "Automation teams", "SMB software"];
  return [];
}

function parseEndsHours(utc) {
  if (!utc) return 99;
  const end = new Date(utc).getTime();
  if (Number.isNaN(end)) return 99;
  return Math.max(0, Math.round((end - Date.now()) / (1000 * 60 * 60)));
}

function rankSignal(currentBid, bidCount, endsHours) {
  if ((bidCount <= 1 && currentBid <= 150) || endsHours <= 8) return "high";
  if (currentBid <= 500 || bidCount <= 3 || endsHours <= 24) return "medium";
  return "low";
}

function clampScore(value, min = 35, max = 97) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function titleCase(input) {
  return String(input || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeRoot(domainOrRoot) {
  return String(domainOrRoot || "")
    .toLowerCase()
    .replace(/\.[a-z0-9-]+$/, "")
    .replace(/[^a-z0-9-_]/g, " ")
    .replace(/[-_]/g, " ")
    .trim();
}

function segmentTokenByLexicon(token) {
  const safe = String(token || "").toLowerCase();
  if (!safe) return [];
  if (COMMON_SEGMENTS.has(safe)) return [safe];

  const matches = [...COMMON_SEGMENTS]
    .filter((entry) => entry.length >= 3 && safe.includes(entry))
    .map((entry) => ({ entry, idx: safe.indexOf(entry) }))
    .sort((a, b) => a.idx - b.idx || b.entry.length - a.entry.length);

  if (!matches.length) return [safe];

  const used = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.idx < cursor) continue;
    if (match.idx > cursor) {
      const gap = safe.slice(cursor, match.idx);
      if (gap.length >= 3) used.push(gap);
    }
    used.push(match.entry);
    cursor = match.idx + match.entry.length;
  }
  if (cursor < safe.length) {
    const tail = safe.slice(cursor);
    if (tail.length >= 3) used.push(tail);
  }

  const recognizedChars = used.filter((part) => COMMON_SEGMENTS.has(part)).reduce((sum, part) => sum + part.length, 0);
  if (recognizedChars / Math.max(safe.length, 1) < 0.55) return [safe];
  return used;
}

function segmentDomainRoot(root) {
  const normalized = normalizeRoot(root);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .flatMap((token) => segmentTokenByLexicon(token))
    .filter(Boolean);
}

function expandIntentTokens(tokens) {
  const expanded = new Set(tokens);
  tokens.forEach((token) => {
    Object.values(SYNONYM_GROUPS).forEach((group) => {
      if (group.includes(token)) {
        group.forEach((term) => expanded.add(term));
      }
    });
  });
  if (tokens.some((token) => LUXURY_EMERALD_TAXONOMY.primary.includes(token) || LUXURY_EMERALD_TAXONOMY.provenance.includes(token))) {
    [...LUXURY_EMERALD_TAXONOMY.primary, ...LUXURY_EMERALD_TAXONOMY.provenance, ...LUXURY_EMERALD_TAXONOMY.luxury].forEach((term) =>
      expanded.add(term)
    );
  }
  return [...expanded].filter((token) => token.length >= 3);
}

function buildIntentProfile(intent) {
  const tokens = tokenizeIntent(intent);
  const expandedTokens = expandIntentTokens(tokens);
  const hasLuxuryEmeraldIntent = expandedTokens.some(
    (token) =>
      LUXURY_EMERALD_TAXONOMY.primary.includes(token) ||
      LUXURY_EMERALD_TAXONOMY.provenance.includes(token) ||
      LUXURY_EMERALD_TAXONOMY.luxury.includes(token)
  );
  const semanticGroups = Object.entries(SYNONYM_GROUPS)
    .filter(([, group]) => group.some((term) => expandedTokens.includes(term)))
    .map(([name, group]) => ({ name, terms: group }));

  const category = hasLuxuryEmeraldIntent ? "Luxury gemstone brand" : pickCategory(expandedTokens);
  const buyerUseCases = hasLuxuryEmeraldIntent ? LUXURY_EMERALD_TAXONOMY.buyerUseCases : pickBuyerFit(expandedTokens);

  return {
    rawTokens: tokens,
    expandedTokens,
    semanticGroups,
    category,
    buyerUseCases,
    hasLuxuryEmeraldIntent,
  };
}

function hasMeaningfulTokenMatch(rootSegments, token) {
  const normalizedToken = String(token || "").trim().toLowerCase();
  if (!normalizedToken || normalizedToken.length < 3) return false;
  return rootSegments.includes(normalizedToken);
}

function evaluateIntentMatch(root, rootSegments, profile) {
  const segmentSet = new Set(rootSegments);
  const meaningfulTokenHits = profile.expandedTokens.filter((token) => hasMeaningfulTokenMatch(rootSegments, token));
  const semanticGroupHits = profile.semanticGroups.filter((group) => group.terms.some((term) => segmentSet.has(term)));
  const accidentalSubstringHits = profile.expandedTokens.filter(
    (token) => token.length >= 4 && root.includes(token) && !segmentSet.has(token)
  );

  return {
    meaningfulTokenHits,
    semanticGroupHits,
    accidentalSubstringHits,
    meaningfulHits: meaningfulTokenHits.length,
    groupHits: semanticGroupHits.length,
  };
}

function analyzeDomainQuality(root, rootSegments, intentMatch) {
  const raw = String(root || "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  const len = compact.length;
  const vowels = (compact.match(/[aeiou]/g) || []).length;
  const consonantClusters = (compact.match(/[bcdfghjklmnpqrstvwxyz]{5,}/g) || []).length;
  const repeatedPattern = /(.)\1{2,}/.test(compact);
  const vowelRatio = vowels / Math.max(len, 1);
  const uniqueCharRatio = new Set(compact).size / Math.max(len, 1);
  const recognizedChars = rootSegments.filter((part) => COMMON_SEGMENTS.has(part)).reduce((sum, part) => sum + part.length, 0);
  const dictionaryCoverage = recognizedChars / Math.max(len, 1);
  const digits = (compact.match(/[0-9]/g) || []).length;
  const hyphens = (raw.match(/-/g) || []).length;

  const qualityFlags = [];
  let qualityScore = 72;

  if (len > 18) {
    qualityFlags.push("excessive-length");
    qualityScore -= 12;
  }
  if (repeatedPattern) {
    qualityFlags.push("repeated-characters");
    qualityScore -= 16;
  }
  if (consonantClusters > 0 || vowelRatio < 0.2 || vowelRatio > 0.78) {
    qualityFlags.push("hard-to-pronounce");
    qualityScore -= 14;
  }
  if (digits >= 2 || hyphens >= 2) {
    qualityFlags.push("spam-like");
    qualityScore -= 12;
  }
  if (digits > 0 || hyphens > 0) {
    qualityFlags.push("confusing-spelling");
    qualityScore -= 6;
  }
  if (dictionaryCoverage < 0.34 || uniqueCharRatio < 0.32) {
    qualityFlags.push("gibberish");
    qualityScore -= 24;
  }
  if (intentMatch.accidentalSubstringHits.length > 0 && intentMatch.meaningfulHits === 0) {
    qualityFlags.push("accidental-substring-match");
    qualityScore -= 20;
  }
  if (intentMatch.groupHits === 0 && intentMatch.meaningfulHits === 0) {
    qualityFlags.push("weak-category-fit");
    qualityScore -= 10;
  }

  const pronounceability = clampScore(qualityScore + Math.round(dictionaryCoverage * 14), 20, 95);
  const nameQuality = clampScore((qualityScore + pronounceability) / 2, 20, 95);

  return {
    pronounceability,
    qualityFlags: [...new Set(qualityFlags)],
    qualityScore: clampScore(qualityScore, 15, 95),
    nameQuality,
    dictionaryCoverage,
  };
}

function qualityFlagsToReasonCodes(qualityFlags) {
  const map = {
    gibberish: REJECTION_CODES.GIBBERISH_PATTERN,
    "accidental-substring-match": REJECTION_CODES.ACCIDENTAL_SUBSTRING_MATCH,
    "hard-to-pronounce": REJECTION_CODES.PRONOUNCEABILITY_BELOW_THRESHOLD,
    "repeated-characters": REJECTION_CODES.REPEATED_CHARACTER_PATTERN,
    "confusing-spelling": REJECTION_CODES.CONFUSING_SPELLING,
    "excessive-length": REJECTION_CODES.EXCESSIVE_LENGTH,
    "spam-like": REJECTION_CODES.SPAM_LIKE_CONSTRUCTION,
    "weak-category-fit": REJECTION_CODES.WEAK_CATEGORY_FIT,
  };
  return [...new Set((qualityFlags || []).map((flag) => map[flag]).filter(Boolean))];
}

function buildRejectionReasons(candidate) {
  const reasons = [];
  if (candidate.scores.semanticFit < 60) reasons.push(REJECTION_CODES.SEMANTIC_FIT_BELOW_THRESHOLD);
  if (candidate.scores.brandability < 55) reasons.push(REJECTION_CODES.BRANDABILITY_BELOW_THRESHOLD);
  if (candidate.scores.pronounceability < 50) reasons.push(REJECTION_CODES.PRONOUNCEABILITY_BELOW_THRESHOLD);
  if ((candidate.meaningfulMatchCount || 0) === 0) reasons.push(REJECTION_CODES.NO_MEANINGFUL_TERM_MATCH);
  if ((candidate.semanticGroupHits || 0) === 0) reasons.push(REJECTION_CODES.NO_CONCEPT_GROUP_MATCH);
  if (!Array.isArray(candidate.buyerFit) || candidate.buyerFit.length === 0) reasons.push(REJECTION_CODES.NO_DEFENSIBLE_BUYER_FIT);
  reasons.push(...qualityFlagsToReasonCodes(candidate.qualityFlags));
  return [...new Set(reasons)];
}

function toCandidateDiagnostic(candidate) {
  const rejectionReasons = candidate.eligibleDecisionCandidate ? [] : buildRejectionReasons(candidate);
  const matchedConceptGroups = Array.isArray(candidate.matchedConceptGroups)
    ? candidate.matchedConceptGroups
    : (candidate.intentMatch?.semanticGroupHits || []).map((group) => group.name);
  return {
    domain: candidate.domain,
    source: candidate.source,
    generationPass: candidate.generationPass,
    availabilityChecked: candidate.source === "generated-available" || candidate.source === "namesilo-available",
    available: candidate.availability === "available",
    eligible: candidate.eligibleDecisionCandidate,
    rejectionReasons,
    qualityFlags: qualityFlagsToReasonCodes(candidate.qualityFlags),
    matchedTerms: candidate.matchedTerms || candidate.intentMatch?.meaningfulTokenHits || [],
    matchedConceptGroups,
    accidentalMatches: candidate.accidentalMatches || candidate.intentMatch?.accidentalSubstringHits || [],
    scores: {
      semanticFit: candidate.scores.semanticFit,
      buyerFit: candidate.scores.buyerFit,
      brandability: candidate.scores.brandability,
      pronounceability: candidate.scores.pronounceability,
      acquisitionSignal: candidate.scores.acquisitionSignal,
      tldTrust: candidate.scores.tldTrust,
      riskAdjusted: candidate.scores.riskAdjusted,
      overall: candidate.eligibleDecisionCandidate ? candidate.fetchMatch : null,
    },
    auction:
      candidate.source === "auction" || candidate.source === "namesilo-auction"
        ? {
            currentBid: candidate.currentBid,
            bidCount: candidate.bidCount,
            endsIn: candidate.auctionEndsIn,
          }
        : undefined,
  };
}

function deriveBuyerFit(profile, intentMatch) {
  if (profile.hasLuxuryEmeraldIntent) {
    return LUXURY_EMERALD_TAXONOMY.buyerUseCases.slice(0, 3);
  }
  const groups = intentMatch.semanticGroupHits.map((group) => group.name);
  if (groups.includes("cyber")) return ["Security teams", "Threat monitoring tools", "Enterprise buyers"];
  if (groups.includes("local")) return ["Local agencies", "SMB growth teams", "Service businesses"];
  if (groups.includes("ai")) return ["AI product teams", "Automation operators", "Customer ops software"];
  if (groups.includes("jewelry") || groups.includes("gemstone") || groups.includes("luxury")) {
    return ["Luxury jewelry house", "Gemstone dealer", "Collector-focused boutique"];
  }
  if (groups.length > 0) return profile.buyerUseCases.slice(0, 3);
  return [];
}

function computeAcquisitionSignal(opportunity, snatchSignal) {
  const currentBid = Number(opportunity.currentBid || 0);
  const bidCount = Number(opportunity.bidCount || 0);
  const base = snatchSignal === "high" ? 78 : snatchSignal === "medium" ? 66 : 54;
  const lowBidBonus = currentBid > 0 && currentBid < 150 ? 8 : 0;
  const highBidPenalty = currentBid > 1200 ? 12 : 0;
  const competitionPenalty = bidCount > 8 ? 8 : 0;
  return clampScore(base + lowBidBonus - highBidPenalty - competitionPenalty, 25, 96);
}

function computeOverallCandidateConfidence(scores) {
  return clampScore(
    scores.semanticFit * 0.3 +
      scores.buyerFit * 0.2 +
      scores.brandability * 0.2 +
      scores.pronounceability * 0.1 +
      scores.tldTrust * 0.08 +
      scores.acquisitionSignal * 0.07 +
      scores.riskAdjusted * 0.05,
    25,
    97
  );
}

function isEligibleDecisionCandidate(candidate) {
  const qualityFlags = candidate.qualityFlags || [];
  const blocked =
    qualityFlags.includes("gibberish") ||
    qualityFlags.includes("accidental-substring-match") ||
    qualityFlags.includes("hard-to-pronounce") ||
    qualityFlags.includes("weak-category-fit");
  const hasUseCaseMapping = Array.isArray(candidate.buyerFit) && candidate.buyerFit.length > 0;
  return (
    candidate.scores.semanticFit >= 60 &&
    candidate.scores.brandability >= 55 &&
    candidate.scores.pronounceability >= 50 &&
    ((candidate.meaningfulMatchCount || 0) > 0 || (candidate.semanticGroupHits || 0) > 0) &&
    !blocked &&
    hasUseCaseMapping
  );
}

function enrichByIntent(opportunities, intent) {
  const profile = buildIntentProfile(intent);

  return opportunities.map((opportunity, index, all) => {
    const domain = String(opportunity.domain || "").toLowerCase();
    const root = normalizeRoot(opportunity.root || domain.split(".")[0] || "");
    const rootSegments = segmentDomainRoot(root);
    const intentMatch = evaluateIntentMatch(root, rootSegments, profile);
    const quality = analyzeDomainQuality(root, rootSegments, intentMatch);
    const endsHours = parseEndsHours(opportunity.auctionEndsOnUtc);
    const currentBid = Number(opportunity.currentBid || 0);
    const bidCount = Number(opportunity.bidCount || 0);
    const snatchSignal = rankSignal(currentBid, bidCount, endsHours);
    const acquisitionSignal = computeAcquisitionSignal(opportunity, snatchSignal);
    const tldTrust = clampScore(opportunity.scores?.tldTrust || 70);
    const semanticFit = clampScore(
      (opportunity.scores?.semanticFit || 52) * 0.45 +
        intentMatch.meaningfulHits * 13 +
        intentMatch.groupHits * 10 +
        quality.dictionaryCoverage * 28 -
        intentMatch.accidentalSubstringHits.length * 16
    );
    const brandability = clampScore((opportunity.scores?.brandability || 62) * 0.35 + quality.nameQuality * 0.65);
    const pronounceability = quality.pronounceability;
    const buyerFitScore = clampScore(
      (opportunity.scores?.buyerFit || 58) * 0.4 + intentMatch.groupHits * 14 + intentMatch.meaningfulHits * 8
    );
    const acquisitionFriction = clampScore(opportunity.scores?.acquisitionFriction || 55);
    const seoPotential = clampScore(opportunity.scores?.seoPotential || 60);
    const aiAppFit = clampScore(opportunity.scores?.aiAppFit || 58);
    const riskPenalty =
      quality.qualityFlags.includes("gibberish") || quality.qualityFlags.includes("hard-to-pronounce")
        ? 18
        : quality.qualityFlags.includes("weak-category-fit")
        ? 10
        : 0;
    const riskAdjusted = clampScore((opportunity.scores?.riskAdjusted || 62) - riskPenalty);
    const buyerFit = deriveBuyerFit(profile, intentMatch);

    const scores = {
      semanticFit,
      buyerFit: buyerFitScore,
      brandability,
      pronounceability,
      nameQuality: quality.nameQuality,
      acquisitionSignal,
      acquisitionFriction,
      tldTrust,
      seoPotential,
      aiAppFit,
      riskAdjusted,
      overall: 0,
    };

    const provisional = {
      ...opportunity,
      root,
      rootSegments,
      intentHitCount: intentMatch.meaningfulHits,
      meaningfulMatchCount: intentMatch.meaningfulHits,
      semanticGroupHits: intentMatch.groupHits,
      intentMatch,
      primaryCategory: profile.category,
      snatchSignal,
      buyerFit,
      qualityFlags: quality.qualityFlags,
      scores,
    };
    provisional.eligibleDecisionCandidate = isEligibleDecisionCandidate(provisional);
    provisional.overallCandidateConfidence = provisional.eligibleDecisionCandidate ? computeOverallCandidateConfidence(scores) : null;
    provisional.eligibleDecisionCandidate =
      provisional.eligibleDecisionCandidate && (provisional.overallCandidateConfidence || 0) >= 58;
    provisional.fetchMatch = provisional.eligibleDecisionCandidate ? provisional.overallCandidateConfidence : 0;
    provisional.confidence = Number(
      (Math.max(0.25, Math.min(0.97, provisional.overallCandidateConfidence / 100))).toFixed(2)
    );
    provisional.fetchReason = provisional.eligibleDecisionCandidate
      ? `This name aligns to ${profile.category.toLowerCase()} intent through meaningful terms (${intentMatch.meaningfulTokenHits
          .slice(0, 3)
          .join(", ")}), while keeping usable brand structure.`
      : "Rejected from decision candidates due to weak semantic alignment or low name quality.";
    provisional.catch =
      currentBid > 1000
        ? "Auction pressure is high. Only pursue if this naming direction is strategically strong."
        : "Verify trademark and pronunciation before placing bids; auction price can move near close.";
    provisional.nextAction = "Validate trademark exposure and shortlist against one stronger semantic alternative before bidding.";
    provisional.riskFlags = [...new Set([...(opportunity.riskFlags || []), ...quality.qualityFlags])];
    provisional.scores.overall = provisional.fetchMatch;

    const relatedDomains = all
      .filter((item) => item.id !== opportunity.id && item.tld === opportunity.tld)
      .slice(0, 3)
      .map((item) => item.domain);
    provisional.relatedDomains = relatedDomains;
    provisional.surfacedAt = new Date().toISOString();

    return provisional;
  });
}

function generateSuggestionCandidates(intent, limit = 8) {
  const profile = buildIntentProfile(intent);
  const baseTokens = profile.expandedTokens.slice(0, 5);
  const seed = baseTokens.length ? baseTokens : ["brand", "atelier", "collective"];
  const buyerFit = profile.buyerUseCases.slice(0, 3);
  const category = profile.category;
  const basePhrase = titleCase(seed.slice(0, 3).join(" "));
  const tlds = [".com", ".ai", ".co", ".io", ".net"];
  const stems = [
    seed.slice(0, 2).join(""),
    `${seed[0]}atelier`,
    `${seed[0]}vault`,
    `${seed[0]}house`,
    `${seed[0]}collective`,
    `${seed[0]}reserve`,
    `${seed[0]}studio`,
    `${seed[0]}gallery`,
    `${seed[0]}labs`,
  ]
    .map((stem) => String(stem || "").replace(/[^a-z0-9]/g, "").toLowerCase())
    .filter((stem) => stem.length >= 4);

  const uniqueDomains = [];
  for (let i = 0; i < stems.length; i += 1) {
    const stem = stems[i];
    for (let j = 0; j < tlds.length; j += 1) {
      const domain = `${stem}${tlds[j]}`;
      if (!uniqueDomains.includes(domain)) uniqueDomains.push(domain);
      if (uniqueDomains.length >= limit) break;
    }
    if (uniqueDomains.length >= limit) break;
  }

  return uniqueDomains.map((domain, idx) => {
    const [root, tld] = domain.split(".");
    const baseScore = clampScore(76 - idx * 2, 60, 90);
    const pronounceability = clampScore(72 - idx);
    const acquisitionSignal = clampScore(58 - idx, 35, 68);
    return {
      id: `suggested-${domain}`,
      domain,
      root,
      tld: `.${tld}`,
      source: "suggestion",
      salesMode: "buy-now",
      domainType: "brandable",
      intentHitCount: Math.max(1, seed.filter((token) => hasMeaningfulTokenMatch(segmentDomainRoot(root), token)).length),
      primaryCategory: category,
      fetchMatch: baseScore,
      snatchSignal: idx < 2 ? "medium" : "low",
      confidence: Number((Math.max(0.61, Math.min(0.91, baseScore / 100))).toFixed(2)),
      fetchReason: `No high-confidence live auction candidate matched "${basePhrase}". This generated option preserves the same naming direction.`,
      buyerFit,
      catch: "This is an intent-based suggestion, so verify availability and trademark risk before buying.",
      nextAction: "Run a registrar availability check, then shortlist two names before pricing or offer decisions.",
      qualityFlags: [],
      riskFlags: ["trademark-watch"],
      overallCandidateConfidence: baseScore,
      eligibleDecisionCandidate: true,
      price: 149 + idx * 35,
      currentBid: 0,
      bidCount: 0,
      auctionEndsIn: "N/A",
      auctionEndsOnUtc: null,
      scores: {
        semanticFit: clampScore(baseScore + 3),
        buyerFit: clampScore(baseScore + 1),
        brandability: clampScore(baseScore + 5),
        pronounceability,
        nameQuality: clampScore(baseScore + 2),
        acquisitionSignal,
        acquisitionFriction: clampScore(72 - idx, 55, 86),
        tldTrust: tld === "com" ? 88 : 76,
        seoPotential: clampScore(baseScore - 1),
        aiAppFit: clampScore(seed.includes("ai") ? baseScore + 7 : baseScore - 3),
        riskAdjusted: clampScore(baseScore - 5),
        overall: baseScore,
      },
      relatedDomains: uniqueDomains.filter((entry) => entry !== domain).slice(0, 3),
      surfacedAt: new Date().toISOString(),
    };
  });
}

const dom = {
  intentForm: document.getElementById("intent-form"),
  intentInput: document.getElementById("intent-input"),
  intentCount: document.getElementById("intent-count"),
  keyboardHint: document.getElementById("keyboard-hint"),
  commandWrap: document.querySelector(".command-wrap"),
  workspaceStatePill: document.getElementById("workspace-state-pill"),
  stepBrief: document.getElementById("step-brief"),
  stepSurface: document.getElementById("step-surface"),
  stepRank: document.getElementById("step-rank"),
  stepAction: document.getElementById("step-action"),
  starterBriefs: document.getElementById("starter-briefs"),
  constraintsToggle: document.getElementById("constraints-toggle"),
  constraintsPanel: document.getElementById("constraints-panel"),
  constraintChips: document.getElementById("constraint-chips"),
  activeConstraints: document.getElementById("active-constraints"),
  fetchButton: document.getElementById("fetch-button"),
  statusRail: document.getElementById("status-rail"),
  statusList: document.getElementById("status-list"),
  resultsHeader: document.getElementById("results-header"),
  resultsCount: document.getElementById("results-count"),
  sortSelect: document.getElementById("sort-mode"),
  filtersWrap: document.getElementById("filters"),
  dataSourceBanner: document.getElementById("data-source-banner"),
  workspaceBanner: document.getElementById("workspace-banner"),
  skeletonList: document.getElementById("skeleton-list"),
  opportunityList: document.getElementById("opportunity-list"),
  emptyState: document.getElementById("empty-state"),
  diagnosticsPanel: document.getElementById("candidate-diagnostics"),
  endNote: document.getElementById("end-note"),
  retryButton: document.getElementById("retry-button"),
  compareTray: document.getElementById("compare-tray"),
  compareText: document.getElementById("compare-text"),
  clearCompare: document.getElementById("clear-compare"),
  intelligenceModal: document.getElementById("intelligence-modal"),
  intelligenceModalClose: document.getElementById("intelligence-modal-close"),
  intelligenceModalBody: document.getElementById("intelligence-modal-body"),
  toast: document.getElementById("toast"),
};

let fetchLoopToken = 0;
let toastTimer = null;
let promptFillTimer = null;
let lastRenderedCount = 0;
let activeModalCandidateId = null;

function getDomainSlug(domain) {
  return String(domain || "")
    .toLowerCase()
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function canRunFetch() {
  return state.intent.trim().length > 0 && state.fetchState !== "fetching";
}

function autoResizeIntentInput() {
  dom.intentInput.style.height = "auto";
  const next = Math.min(dom.intentInput.scrollHeight, 280);
  dom.intentInput.style.height = `${Math.max(next, 154)}px`;
}

function updateIntentCount() {
  if (dom.intentCount) dom.intentCount.textContent = String(state.intent.length);
}

function updateProgressRail() {
  const steps = [dom.stepBrief, dom.stepSurface, dom.stepRank, dom.stepAction].filter(Boolean);
  steps.forEach((step) => step.classList.remove("active", "complete"));
  if (!steps.length) return;

  if (state.fetchState === "idle" || state.fetchState === "primed") {
    dom.stepBrief.classList.add("active");
    return;
  }

  if (state.fetchState === "fetching") {
    dom.stepBrief.classList.add("complete");
    if (state.activeStepIndex <= 1) dom.stepSurface.classList.add("active");
    else if (state.activeStepIndex <= 3) {
      dom.stepSurface.classList.add("complete");
      dom.stepRank.classList.add("active");
    } else {
      dom.stepSurface.classList.add("complete");
      dom.stepRank.classList.add("complete");
      dom.stepAction.classList.add("active");
    }
    return;
  }

  if (state.fetchState === "surfaced" || state.fetchState === "refining") {
    dom.stepBrief.classList.add("complete");
    dom.stepSurface.classList.add("complete");
    dom.stepRank.classList.add("complete");
    dom.stepAction.classList.add("active");
    return;
  }

  if (state.fetchState === "empty" || state.fetchState === "error") {
    dom.stepBrief.classList.add("complete");
    dom.stepSurface.classList.add("active");
  }
}

function setFetchState(next) {
  state.fetchState = next;
  if (next === "idle" || next === "primed") state.fetchPhase = next;
  if (next === "surfaced" || next === "refining") state.fetchPhase = "surfaced";
  if (next === "empty") state.fetchPhase = "empty";
  if (next === "error") state.fetchPhase = "error";
  syncStateViews();
}

function renderEndNote(visible) {
  if (!dom.endNote) return;
  dom.endNote.classList.toggle("active", Boolean(visible));
}

function syncStateViews() {
  const fetchingPhases = new Set([
    "interpreting",
    "fetching-auctions",
    "ranking-auctions",
    "generating",
    "checking-availability",
    "regenerating",
    "building-candidates",
  ]);
  const fetching = fetchingPhases.has(state.fetchPhase);
  const hasResults = state.fetchState === "surfaced" || state.fetchState === "refining";
  const canFetch = canRunFetch();
  const primed = state.intent.trim().length > 0 && !fetching;

  dom.intentInput.disabled = fetching;
  dom.fetchButton.disabled = !canFetch;
  dom.fetchButton.classList.toggle("ready", canFetch);
  dom.fetchButton.textContent = fetching ? "Fetching..." : "Fetch";
  dom.statusRail.classList.toggle("active", fetching);
  dom.resultsHeader.classList.toggle("active", hasResults);
  dom.skeletonList.style.display = fetching ? "grid" : "none";
  dom.opportunityList.style.display = hasResults ? "grid" : "none";
  dom.emptyState.classList.toggle("active", state.fetchState === "empty" || state.fetchState === "error");
  dom.commandWrap.classList.toggle("primed", primed && (state.fetchState === "primed" || state.fetchState === "surfaced"));
  dom.commandWrap.classList.toggle("fetching", fetching);
  if (dom.constraintsPanel) dom.constraintsPanel.classList.toggle("open", state.constraintsOpen);
  if (dom.constraintsToggle) dom.constraintsToggle.textContent = state.constraintsOpen ? "Hide constraints" : "Add constraints";
  if (dom.workspaceStatePill) {
    dom.workspaceStatePill.classList.remove("fetching", "surfaced");
    if (state.fetchState === "fetching") {
      dom.workspaceStatePill.classList.add("fetching");
      dom.workspaceStatePill.textContent = "Fetching";
    } else if (state.fetchState === "surfaced" || state.fetchState === "refining") {
      dom.workspaceStatePill.classList.add("surfaced");
      dom.workspaceStatePill.textContent = "Opportunities surfaced";
    } else if (state.fetchState === "error") {
      dom.workspaceStatePill.textContent = "Fetch interrupted";
    } else {
      dom.workspaceStatePill.textContent = "Ready";
    }
  }
  updateIntentCount();
  updateProgressRail();
  renderActiveConstraints();
  if (state.fetchState !== "surfaced" && state.fetchState !== "refining") {
    renderEndNote(false);
  }
}

function pulseFetchButton() {
  dom.fetchButton.classList.remove("pulse");
  void dom.fetchButton.offsetWidth;
  dom.fetchButton.classList.add("pulse");
}

function renderStarterBriefs() {
  dom.starterBriefs.innerHTML = "";
  starterBriefs.forEach((example) => {
    const button = document.createElement("button");
    button.type = "button";
    const active = example.id === state.selectedExampleId;
    button.className = `chip quick-chip ${active ? "active pulse" : ""}`;
    button.textContent = example.title;
    button.disabled = state.fetchState === "fetching";
    button.addEventListener("click", () => {
      state.selectedExampleId = example.id;
      state.intent = example.prompt;
      dom.intentInput.focus({ preventScroll: true });
      dom.intentInput.value = "";
      if (promptFillTimer) clearInterval(promptFillTimer);
      let idx = 0;
      const text = example.prompt;
      const steps = 3;
      promptFillTimer = setInterval(() => {
        idx = Math.min(text.length, idx + Math.ceil(text.length / steps));
        dom.intentInput.value = text.slice(0, idx);
        state.intent = dom.intentInput.value;
        updateIntentCount();
        autoResizeIntentInput();
        if (idx >= text.length) {
          clearInterval(promptFillTimer);
          promptFillTimer = null;
        }
      }, 16);
      if (state.fetchState !== "surfaced") {
        setFetchState("primed");
      }
      pulseFetchButton();
      renderStarterBriefs();
      dom.commandWrap.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    dom.starterBriefs.appendChild(button);
  });
}

function renderConstraintChips() {
  dom.constraintChips.innerHTML = "";
  constraintOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${state.activeConstraints.includes(option.id) ? "active" : ""}`;
    button.textContent = option.label;
    button.disabled = state.fetchState === "fetching";
    button.addEventListener("click", () => {
      if (state.activeConstraints.includes(option.id)) {
        state.activeConstraints = state.activeConstraints.filter((id) => id !== option.id);
      } else {
        state.activeConstraints = [...state.activeConstraints, option.id];
      }
      renderConstraintChips();
      renderActiveConstraints();
    });
    dom.constraintChips.appendChild(button);
  });
}

function renderActiveConstraints() {
  if (!dom.activeConstraints) return;
  dom.activeConstraints.innerHTML = "";
  state.activeConstraints.forEach((id) => {
    const opt = constraintOptions.find((item) => item.id === id);
    if (!opt) return;
    const tag = document.createElement("span");
    tag.className = "active-constraint";
    tag.textContent = opt.label;
    dom.activeConstraints.appendChild(tag);
  });
}

function renderStatusRail() {
  dom.statusList.innerHTML = "";
  statusSteps.forEach((step, idx) => {
    const item = document.createElement("li");
    item.className = "status-item";
    if (idx < state.activeStepIndex) item.classList.add("complete");
    else if (idx === state.activeStepIndex) item.classList.add("active");
    const dotLabel = idx < state.activeStepIndex ? "✓" : "";
    item.innerHTML = `<span class="dot">${dotLabel}</span><span>${step}</span>`;
    dom.statusList.appendChild(item);
  });
}

function renderSkeletons() {
  dom.skeletonList.innerHTML = "";
  for (let i = 0; i < 3; i += 1) {
    const sk = document.createElement("article");
    sk.className = "card skeleton-card";
    sk.innerHTML = `
      <div class="sk-line" style="width: 42%; height: 18px; margin-bottom: 10px;"></div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div class="sk-line" style="width: 76px; margin:0;"></div>
        <div class="sk-line" style="width: 82px; margin:0;"></div>
        <div class="sk-line" style="width: 96px; margin:0;"></div>
      </div>
      <div class="sk-line" style="width: 92%;"></div>
      <div class="sk-line" style="width: 84%;"></div>
      <div class="sk-line" style="width: 64%;"></div>
      <div style="display:flex; gap:8px; margin:10px 0;">
        <div class="sk-line" style="width: 86px; margin:0;"></div>
        <div class="sk-line" style="width: 72px; margin:0;"></div>
        <div class="sk-line" style="width: 68px; margin:0;"></div>
      </div>
      <div class="sk-line" style="width: 100%; height: 40px; border-radius:10px;"></div>
    `;
    dom.skeletonList.appendChild(sk);
  }
}

function getSignalRank(signal) {
  if (signal === "high") return 3;
  if (signal === "medium") return 2;
  return 1;
}

function applyFilters(opps) {
  if (state.activeFilters.length === 0) return opps;
  return opps.filter((opportunity) =>
    state.activeFilters.every((filter) => {
      if (filter === "auction") return opportunity.source === "auction" || opportunity.source === "namesilo-auction";
      if (filter === "available")
        return (
          opportunity.source === "available" ||
          opportunity.source === "generated-available" ||
          opportunity.source === "namesilo-available"
        );
      if (filter === "premium") return opportunity.source === "premium";
      if (filter === "low-risk") return opportunity.scores.riskAdjusted >= 80;
      if (filter === "brandable") return opportunity.domainType === "brandable" || opportunity.domainType === "premium-short";
      if (filter === "ai-fit") return opportunity.scores.aiAppFit >= 80;
      if (filter === "under-500") {
        if (typeof opportunity.price === "number") return opportunity.price < 500;
        if (typeof opportunity.currentBid === "number") return opportunity.currentBid < 500;
        return false;
      }
      return true;
    })
  );
}

function sortOpportunities(opps) {
  const sorted = [...opps];
  if (state.sortMode === "fetch-match") {
    sorted.sort((a, b) => b.fetchMatch - a.fetchMatch);
  } else if (state.sortMode === "snatch-signal") {
    sorted.sort((a, b) => getSignalRank(b.snatchSignal) - getSignalRank(a.snatchSignal) || b.fetchMatch - a.fetchMatch);
  } else {
    sorted.sort((a, b) => b.scores.acquisitionFriction - a.scores.acquisitionFriction);
  }
  return sorted;
}

function filterByIntentRelevance(opportunities, intent) {
  const tokens = tokenizeIntent(intent);
  if (tokens.length === 0) {
    return {
      items: opportunities,
      usedFallback: false,
    };
  }

  const relevant = opportunities.filter((item) => (item.meaningfulMatchCount || 0) > 0 || (item.semanticGroupHits || 0) > 0);
  return {
    items: relevant,
    usedFallback: false,
  };
}

function splitEligibleCandidates(opportunities) {
  const eligible = opportunities.filter((item) => item.eligibleDecisionCandidate);
  const rejected = opportunities
    .filter((item) => !item.eligibleDecisionCandidate)
    .map((item) => ({
      domain: item.domain,
      qualityFlags: item.qualityFlags || [],
      semanticFit: item.scores?.semanticFit ?? 0,
      brandability: item.scores?.brandability ?? 0,
      pronounceability: item.scores?.pronounceability ?? 0,
      confidence: item.overallCandidateConfidence ?? 0,
    }));
  return {
    eligible,
    rejected,
  };
}

function buildEffectiveIntent() {
  const phrases = state.activeConstraints
    .map((id) => constraintOptions.find((option) => option.id === id)?.phrase)
    .filter(Boolean);
  if (phrases.length === 0) return state.intent;
  return `${state.intent}\n${phrases.join("\n")}`;
}

function renderResultsHeader(itemsCount) {
  dom.resultsCount.textContent = `${itemsCount} ${itemsCount === 1 ? "domain" : "domains"} surfaced`;
  dom.sortSelect.value = state.sortMode;
  dom.sortSelect.classList.add("active");
  if (dom.dataSourceBanner) {
    const hasGeneratedAvailable = state.opportunities.some(
      (item) => item.source === "generated-available" || item.source === "namesilo-available"
    );
    const hasAuctions = state.opportunities.some((item) => item.source === "auction" || item.source === "namesilo-auction");
    if (state.availabilityFailed && hasAuctions && !hasGeneratedAvailable) {
      dom.dataSourceBanner.classList.add("active");
      dom.dataSourceBanner.textContent = "Availability check unavailable. Showing qualified live auctions.";
    } else if (hasGeneratedAvailable && hasAuctions) {
      dom.dataSourceBanner.classList.add("active");
      dom.dataSourceBanner.textContent = "Blended candidates: available now and live auctions.";
    } else if (hasGeneratedAvailable) {
      dom.dataSourceBanner.classList.add("active");
      dom.dataSourceBanner.textContent = "Available now at NameSilo.";
    } else {
      dom.dataSourceBanner.classList.remove("active");
      dom.dataSourceBanner.textContent = "";
    }
  }

  dom.filtersWrap.innerHTML = "";
  dom.filtersWrap.classList.add("filters");
  ["auction", "available", "premium", "low-risk", "brandable", "ai-fit", "under-500"].forEach((key) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip ${state.activeFilters.includes(key) ? "active" : ""}`;
    chip.textContent = filterLabel[key];
    chip.addEventListener("click", () => handleFilterToggle(key));
    dom.filtersWrap.appendChild(chip);
  });

  if (state.activeFilters.length) {
    dom.workspaceBanner.classList.add("active");
    dom.workspaceBanner.textContent = `Showing only: ${state.activeFilters.map((key) => filterLabel[key]).join(", ")}`;
  } else {
    dom.workspaceBanner.classList.remove("active");
    dom.workspaceBanner.textContent = "";
  }
}

function renderBuyerFit(items) {
  const list = [...items];
  const visible = list.slice(0, 3);
  const overflow = list.length - visible.length;
  const chips = visible.map((item) => `<span class="buyer-chip">${item}</span>`);
  if (overflow > 0) chips.push(`<span class="buyer-chip">+${overflow}</span>`);
  return chips.join("");
}

function renderRiskFlags(riskFlags) {
  return riskFlags.map((flag) => `<span class="buyer-chip">${riskLabel[flag] || flag}</span>`).join("");
}

function renderExpandPanel(opportunity, expanded) {
  const relatedDomains = Array.isArray(opportunity.relatedDomains) ? opportunity.relatedDomains : [];
  const scoreFields = [
    ["Semantic fit", opportunity.scores.semanticFit],
    ["Buyer use-case fit", opportunity.scores.buyerFit],
    ["Name quality", opportunity.scores.nameQuality],
    ["Brandability", opportunity.scores.brandability],
    ["Pronounceability", opportunity.scores.pronounceability],
    ["Acquisition signal", opportunity.scores.acquisitionSignal],
    ["TLD trust", opportunity.scores.tldTrust],
    ["Acquisition friction", opportunity.scores.acquisitionFriction],
    ["SEO potential", opportunity.scores.seoPotential],
    ["AI app fit", opportunity.scores.aiAppFit],
    ["Risk adjusted", opportunity.scores.riskAdjusted],
  ];
  return `
    <div class="expand-panel ${expanded ? "open" : ""}" id="expand-${opportunity.id}">
      <div class="label">Intelligence breakdown</div>
      ${scoreFields
        .map(
          ([label, value]) => `
            <div class="score-item">
              <div class="score-label-row"><span>${label}</span><span>${value}</span></div>
              <div class="score-bar"><div class="score-fill ${expanded ? "animate" : ""}" style="width:${expanded ? value : 0}%;"></div></div>
            </div>
          `
        )
        .join("")}
      ${
        opportunity.qualityFlags?.length
          ? `<div class="label">Quality flags</div><div class="buyer-chips">${renderRiskFlags(opportunity.qualityFlags)}</div>`
          : ""
      }
      ${
        debugCandidates
          ? `<div class="label">Eligibility gate</div>
      <div class="meta-note">${
        opportunity.eligibleDecisionCandidate ? "Passed" : "Failed"
      } · Semantic fit: ${opportunity.scores.semanticFit} ${opportunity.scores.semanticFit >= 60 ? ">= 60" : "< 60"} · Brandability: ${
              opportunity.scores.brandability
            } ${opportunity.scores.brandability >= 55 ? ">= 55" : "< 55"} · Pronounceability: ${
              opportunity.scores.pronounceability
            } ${opportunity.scores.pronounceability >= 50 ? ">= 50" : "< 50"}</div>
      <div class="meta-note">Meaningful concept groups: ${
        opportunity.intentMatch?.semanticGroupHits?.map((group) => group.name).join(", ") || "none"
      }</div>
      <div class="meta-note">Buyer-fit mapping: ${opportunity.buyerFit?.join(", ") || "none"}</div>`
          : ""
      }
      <div class="label">Related domains</div>
      <div class="related-row">
        ${relatedDomains.map((domain) => `<span class="related-chip mono">${domain}</span>`).join("")}
      </div>
      <p class="disclaimer"><a href="/methodology/">Methodology.</a></p>
    </div>
  `;
}

function openIntelligenceModal(candidateId) {
  const candidate = state.opportunities.find((entry) => entry.id === candidateId);
  if (!candidate || !dom.intelligenceModal || !dom.intelligenceModalBody) return;
  activeModalCandidateId = candidateId;
  dom.intelligenceModalBody.innerHTML = renderExpandPanel(candidate, true);
  dom.intelligenceModal.classList.add("active");
  dom.intelligenceModal.setAttribute("aria-hidden", "false");
}

function closeIntelligenceModal() {
  if (!dom.intelligenceModal || !dom.intelligenceModalBody) return;
  activeModalCandidateId = null;
  dom.intelligenceModal.classList.remove("active");
  dom.intelligenceModal.setAttribute("aria-hidden", "true");
  dom.intelligenceModalBody.innerHTML = "";
}

function renderOpportunityCard(opportunity, index) {
  const watched = state.watchedIds.includes(opportunity.id);
  const comparing = state.compareIds.includes(opportunity.id);
  const signalValue = typeof opportunity.snatchSignal === "string" && opportunity.snatchSignal ? opportunity.snatchSignal : "low";
  const signalClass = signalBadgeClass[signalValue] || "";
  const isLiveAuction =
    (opportunity.source === "auction" || opportunity.source === "namesilo-auction") && opportunity.salesMode === "auction";
  const isRegisterPath =
    opportunity.source === "generated-available" || opportunity.source === "namesilo-available" || opportunity.salesMode === "register";

  let priceMeta = "";
  if (opportunity.source === "auction" || opportunity.source === "namesilo-auction") {
    priceMeta = `Current bid: $${opportunity.currentBid ?? 0} · Ends in ${opportunity.auctionEndsIn ?? "N/A"} · ${
      opportunity.bidCount ?? 0
    } bids`;
  } else if (typeof opportunity.registrationPrice === "number") {
    priceMeta = `Registration: $${opportunity.registrationPrice.toLocaleString()}`;
  } else if (typeof opportunity.price === "number") {
    priceMeta = `Indicative price: $${opportunity.price.toLocaleString()}`;
  } else {
    priceMeta = isRegisterPath ? "Registration pricing shown at checkout." : "Pricing by seller review.";
  }

  let modeMeta = "";
  if (opportunity.salesMode === "auction") {
    modeMeta = "Current bid is not final price.";
  } else if (opportunity.salesMode === "register") {
    modeMeta = "Available to register right now.";
  } else if (opportunity.salesMode === "make-offer") {
    modeMeta = "Seller acceptance required.";
  } else {
    modeMeta = "Registration price must be confirmed.";
  }

  const domainSlug = getDomainSlug(opportunity.domain);

  return `
    <article class="card opportunity-card ${state.fetchState === "refining" ? "refining" : ""}" style="animation-delay:${Math.min(
      index * 55,
      330
    )}ms;">
      <div class="card-top">
        <a class="domain-name mono" href="/domains/${domainSlug}">${opportunity.domain}</a>
        <div class="badge-row">
          <span class="badge">${sourceLabel[opportunity.source]}</span>
          <span class="badge">${salesModeLabel[opportunity.salesMode] || "Acquisition"}</span>
          <span class="badge blue">Candidate Confidence ${opportunity.fetchMatch}</span>
          <span class="badge ${signalClass}">${signalValue[0].toUpperCase() + signalValue.slice(1)} Deal Signal</span>
        </div>
      </div>

      <div class="label">Fit</div>
      <p class="value">${opportunity.fetchReason}</p>

      <div class="label">Best for</div>
      <div class="buyer-chips">${renderBuyerFit(opportunity.buyerFit)}</div>

      <div class="label">Catch</div>
      <div class="catch-panel">
        <p class="value" style="margin-top:0;">${opportunity.catch}</p>
        <div class="buyer-chips">${renderRiskFlags(opportunity.riskFlags)}</div>
        <div class="meta-note">${priceMeta}</div>
        <div class="meta-note">${modeMeta}</div>
      </div>

      <div class="label">Next</div>
      <p class="value">${opportunity.nextAction}</p>

      <div class="action-row">
        <button class="btn-full" data-action="expand" data-id="${opportunity.id}">
          View Intelligence
        </button>
        <div class="btn-inline-row">
          <button class="btn-secondary ${watched ? "active" : ""}" data-action="watch" data-id="${opportunity.id}">
            ${watched ? "Watching" : "Watch"}
          </button>
          <button class="btn-text ${comparing ? "active" : ""}" data-action="compare" data-id="${opportunity.id}">
            ${comparing ? "Comparing" : "Compare"}
          </button>
          <button class="btn-text" data-action="view-product" data-id="${opportunity.id}">
            View Product
          </button>
          <button class="btn-text" data-action="${isLiveAuction ? "view-auction" : "snatch"}" data-id="${opportunity.id}">
            ${isLiveAuction ? "View Auction" : isRegisterPath ? "Register at NameSilo" : "Snatch"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderOpportunityList() {
  const filtered = applyFilters(state.opportunities);
  const sorted = sortOpportunities(filtered);
  lastRenderedCount = sorted.length;

  if (state.fetchState === "surfaced" || state.fetchState === "refining") {
    renderResultsHeader(sorted.length);
  }

  if ((state.fetchState === "surfaced" || state.fetchState === "refining") && sorted.length === 0) {
    setFetchState("empty");
    renderEmptyState();
    renderEndNote(false);
    return;
  }

  if (state.fetchState !== "surfaced" && state.fetchState !== "refining") return;

  dom.opportunityList.innerHTML = sorted.map(renderOpportunityCard).join("");
  dom.opportunityList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-id");
      const action = button.getAttribute("data-action");
      if (!id || !action) return;
      if (action === "expand") {
        openIntelligenceModal(id);
      } else if (action === "watch") {
        const item = state.opportunities.find((entry) => entry.id === id);
        if (state.watchedIds.includes(id)) {
          state.watchedIds = state.watchedIds.filter((entry) => entry !== id);
          if (item) showToast(`${item.domain} removed from watchlist`);
        } else {
          state.watchedIds = [...state.watchedIds, id];
          if (item) showToast(`${item.domain} added to watchlist`);
        }
        renderOpportunityList();
      } else if (action === "compare") {
        if (state.compareIds.includes(id)) {
          state.compareIds = state.compareIds.filter((entry) => entry !== id);
        } else if (state.compareIds.length < 2) {
          state.compareIds = [...state.compareIds, id];
        } else {
          showToast("Compare queue is limited to 2 domains.");
        }
        renderCompareTray();
        renderOpportunityList();
      } else if (action === "view-auction") {
        const item = state.opportunities.find((entry) => entry.id === id);
        if (item?.auctionUrl) {
          window.open(item.auctionUrl, "_blank", "noopener,noreferrer");
        } else {
          showToast("Auction link unavailable for this candidate.");
        }
      } else if (action === "view-product") {
        const item = state.opportunities.find((entry) => entry.id === id);
        if (item?.domain) {
          window.open(`/domains/${getDomainSlug(item.domain)}`, "_blank", "noopener,noreferrer");
        }
      } else if (action === "snatch") {
        const item = state.opportunities.find((entry) => entry.id === id);
        if (item?.registrationUrl) {
          window.open(item.registrationUrl, "_blank", "noopener,noreferrer");
        } else {
          showToast(item ? `Acquisition path saved for ${item.domain}.` : "Acquisition path saved.");
        }
      }
    });
  });
  renderEndNote(sorted.length > 0 && state.compareIds.length === 0);
}

function renderCompareTray() {
  if (state.compareIds.length === 0) {
    dom.compareTray.classList.remove("active");
    document.body.classList.remove("compare-active");
    dom.compareText.textContent = "";
    if (state.fetchState === "surfaced" || state.fetchState === "refining") {
      renderEndNote(lastRenderedCount > 0);
    }
    return;
  }
  const names = state.compareIds
    .map((id) => state.opportunities.find((entry) => entry.id === id))
    .filter(Boolean)
    .map((item) => item.domain);
  dom.compareTray.classList.add("active");
  document.body.classList.add("compare-active");
  dom.compareText.innerHTML = `<div class="compare-domains">${names
    .map((name) => `<span class="compare-domain mono">${name}</span>`)
    .join("")}</div>`;
  renderEndNote(false);
}

function passesDiagnosticsFilter(candidate) {
  if (state.diagnosticsFilter === "all") return true;
  if (state.diagnosticsFilter === "semantic") {
    return candidate.rejectionReasons.includes(REJECTION_CODES.SEMANTIC_FIT_BELOW_THRESHOLD);
  }
  if (state.diagnosticsFilter === "quality") {
    return (
      candidate.rejectionReasons.includes(REJECTION_CODES.GIBBERISH_PATTERN) ||
      candidate.rejectionReasons.includes(REJECTION_CODES.BRANDABILITY_BELOW_THRESHOLD) ||
      candidate.rejectionReasons.includes(REJECTION_CODES.WEAK_CATEGORY_FIT)
    );
  }
  if (state.diagnosticsFilter === "pronunciation") {
    return (
      candidate.rejectionReasons.includes(REJECTION_CODES.PRONOUNCEABILITY_BELOW_THRESHOLD) ||
      candidate.rejectionReasons.includes(REJECTION_CODES.REPEATED_CHARACTER_PATTERN)
    );
  }
  if (state.diagnosticsFilter === "accidental") {
    return candidate.rejectionReasons.includes(REJECTION_CODES.ACCIDENTAL_SUBSTRING_MATCH);
  }
  return true;
}

function renderDiagnosticsPanel() {
  if (!dom.diagnosticsPanel) return;
  if (!debugCandidates) {
    dom.diagnosticsPanel.style.display = "none";
    dom.diagnosticsPanel.innerHTML = "";
    return;
  }

  const rejected = state.candidateDiagnostics.filter((item) => !item.eligible);
  const eligible = state.candidateDiagnostics.filter((item) => item.eligible);
  const generatedDiagnostics = state.fetchDiagnostics || {};
  const query = state.diagnosticsQuery.trim().toLowerCase();
  const visibleRejected = rejected
    .filter((item) => passesDiagnosticsFilter(item))
    .filter((item) => (query ? item.domain.toLowerCase().includes(query) : true));

  dom.diagnosticsPanel.style.display = "block";
  dom.diagnosticsPanel.innerHTML = `
    <details class="diagnostics-details" open>
      <summary class="label">Candidate Diagnostics</summary>
      <div class="meta-note" style="margin:8px 0;">
        ${state.rawCandidateCount} raw auction records · ${eligible.length} eligible decision candidates · ${rejected.length} rejected before surfacing
      </div>
      <div class="meta-note" style="margin:8px 0;">
        Generated: ${(generatedDiagnostics.generatedDomains || []).length} · Syntax rejects: ${
    (generatedDiagnostics.syntaxRejections || []).length
  } · Quality rejects: ${(generatedDiagnostics.qualityRejections || []).length} · Unavailable: ${
    (generatedDiagnostics.unavailableDomains || []).length
  }
      </div>
      <div class="meta-note" style="margin:8px 0;">
        Syntax sample: ${(generatedDiagnostics.syntaxRejections || [])
          .slice(0, 3)
          .map((item) => `${item.domain} (${item.reason})`)
          .join(" · ") || "none"}
      </div>
      <div class="meta-note" style="margin:8px 0;">
        Unavailable sample: ${(generatedDiagnostics.unavailableDomains || [])
          .slice(0, 3)
          .map((item) => item.domain)
          .join(" · ") || "none"}
      </div>
      <div class="chip-row" style="margin-bottom:8px;">
        ${[
          ["all", "All rejected"],
          ["semantic", "Semantic failures"],
          ["quality", "Quality failures"],
          ["pronunciation", "Pronunciation failures"],
          ["accidental", "Accidental matches"],
        ]
          .map(
            ([id, label]) =>
              `<button type="button" class="chip diagnostics-filter ${state.diagnosticsFilter === id ? "active" : ""}" data-dx-filter="${id}">${label}</button>`
          )
          .join("")}
      </div>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
        <input id="diagnostics-query" class="intent-input" style="min-height:44px;height:44px;" placeholder="Filter rejected domains…" value="${state.diagnosticsQuery.replace(
          /"/g,
          "&quot;"
        )}" />
        <button type="button" class="btn-secondary" id="export-diagnostics-btn">Export diagnostics</button>
      </div>
      <div class="diagnostics-list">
        ${
          visibleRejected.length === 0
            ? `<div class="meta-note">No rejected candidates for this filter.</div>`
            : visibleRejected
                .map(
                  (item) => `
              <article class="card" style="padding:10px; margin-bottom:8px;">
                <div class="mono" style="font-size:13px;">${item.domain}</div>
                <div class="meta-note">Rejected</div>
                <div class="meta-note">Source: ${item.source || "unknown"}${item.generationPass ? ` · Pass ${item.generationPass}` : ""}</div>
                <div class="meta-note">Semantic fit: ${item.scores.semanticFit} · Brandability: ${item.scores.brandability} · Pronounceability: ${item.scores.pronounceability} · Acquisition signal: ${item.scores.acquisitionSignal}</div>
                <div class="meta-note">Reasons: ${(item.rejectionReasons || []).join(", ") || "none"}</div>
                ${
                  item.accidentalMatches?.length
                    ? `<div class="meta-note">Accidental match: ${item.accidentalMatches.join(", ")}</div>`
                    : ""
                }
              </article>
            `
                )
                .join("")
        }
      </div>
    </details>
  `;

  dom.diagnosticsPanel.querySelectorAll("[data-dx-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.diagnosticsFilter = button.getAttribute("data-dx-filter") || "all";
      renderDiagnosticsPanel();
    });
  });
  const queryInput = document.getElementById("diagnostics-query");
  if (queryInput) {
    queryInput.addEventListener("input", (event) => {
      state.diagnosticsQuery = event.target.value || "";
      renderDiagnosticsPanel();
    });
  }
  const exportButton = document.getElementById("export-diagnostics-btn");
  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (!debugCandidates) return;
      const payload = {
        fetchBrief: state.intent,
        fetchedTimestamp: state.lastFetchTimestamp,
        totalRawRecords: state.rawCandidateCount,
        eligibleCount: eligible.length,
        rejectedCount: rejected.length,
        sourceSummary: state.sourceSummary,
        generationDiagnostics: state.fetchDiagnostics,
        candidateDiagnostics: state.candidateDiagnostics,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "candidate-diagnostics.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }
}

function renderEmptyState() {
  if (dom.dataSourceBanner && state.fetchState !== "surfaced" && state.fetchState !== "refining") {
    dom.dataSourceBanner.classList.remove("active");
    dom.dataSourceBanner.textContent = "";
  }
  if (state.fetchState === "empty") {
    dom.emptyState.innerHTML = `
      <h3>No qualified domains surfaced.</h3>
      <p>We checked auctions and live registration availability but did not find candidates that met fit and quality thresholds.</p>
      <button class="btn-primary" id="refine-intent-btn">Edit request</button>
    `;
    const btn = document.getElementById("refine-intent-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        dom.intentInput.focus();
      });
    }
  } else if (state.fetchState === "error") {
    dom.emptyState.innerHTML = `
      <h3>Fetch failed.</h3>
      <p>Live auction and availability checks are currently unavailable.</p>
      ${state.lastError ? `<p class="meta-note">${state.lastError}</p>` : ""}
      <button class="btn-primary" id="retry-surface-btn">Retry</button>
    `;
    const btn = document.getElementById("retry-surface-btn");
    if (btn) {
      btn.addEventListener("click", runFetch);
    }
  } else if (state.fetchState === "idle") {
    dom.emptyState.innerHTML = `
      <h3>Ready</h3>
      <p>Describe what you need and fetch.</p>
    `;
  } else {
    dom.emptyState.innerHTML = "";
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("active");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove("active");
  }, 1700);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildConstraintPayload() {
  return {
    preferredTlds: state.activeConstraints.includes("prefer-com") ? [".com"] : undefined,
    includeAuctions: true,
    maxBudget: state.activeConstraints.includes("under-500") ? 500 : undefined,
    avoidHyphens: state.activeConstraints.includes("avoid-hyphens"),
    shortNames: state.activeConstraints.includes("short-names"),
    premium: state.activeConstraints.includes("more-premium"),
  };
}

async function fetchDomainFetch(brief) {
  const response = await fetch("/api/domain-fetch", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      brief,
      constraints: buildConstraintPayload(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Domain fetch failed.");
  }
  if (!Array.isArray(payload?.decisionCandidates)) {
    throw new Error("Domain fetch response is missing decisionCandidates.");
  }
  return payload;
}

function adaptApiCandidateToUi(candidate) {
  const scores = candidate?.scores || {};
  const acquisitionPath = candidate?.acquisitionPath || {};
  const isAuction = candidate?.source === "namesilo-auction" || acquisitionPath.type === "auction";
  const salesMode =
    candidate?.salesMode ||
    (acquisitionPath.type === "register"
      ? "register"
      : acquisitionPath.type === "auction"
      ? "auction"
      : acquisitionPath.type === "buy-now"
      ? "buy-now"
      : acquisitionPath.type === "make-offer"
      ? "make-offer"
      : "buy-now");

  return {
    ...candidate,
    id: candidate?.candidateId || candidate?.id || candidate?.domain,
    fetchMatch:
      typeof candidate?.fetchMatch === "number"
        ? candidate.fetchMatch
        : typeof scores.overall === "number"
        ? scores.overall
        : 0,
    fetchReason: candidate?.fetchReason || candidate?.whySurfaced || "",
    snatchSignal: candidate?.snatchSignal || (isAuction ? "medium" : "low"),
    salesMode,
    source:
      candidate?.source === "namesilo-auction"
        ? "namesilo-auction"
        : candidate?.source === "namesilo-available"
        ? "namesilo-available"
        : candidate?.source || "available",
    currentBid:
      typeof candidate?.currentBid === "number"
        ? candidate.currentBid
        : typeof acquisitionPath.currentBid === "number"
        ? acquisitionPath.currentBid
        : 0,
    bidCount:
      typeof candidate?.bidCount === "number"
        ? candidate.bidCount
        : typeof acquisitionPath.bidCount === "number"
        ? acquisitionPath.bidCount
        : 0,
    auctionEndsIn: candidate?.auctionEndsIn || acquisitionPath.auctionEndsIn || "N/A",
    auctionEndsOnUtc: candidate?.auctionEndsOnUtc || acquisitionPath.auctionEndsAt || null,
    auctionUrl: candidate?.auctionUrl || acquisitionPath.actionUrl || candidate?.sourceUrl,
    registrationPrice:
      typeof candidate?.registrationPrice === "number"
        ? candidate.registrationPrice
        : typeof acquisitionPath.registrationPrice === "number"
        ? acquisitionPath.registrationPrice
        : undefined,
    registrationUrl: candidate?.registrationUrl || acquisitionPath.actionUrl || candidate?.sourceUrl,
    relatedDomains: Array.isArray(candidate?.alternatives) ? candidate.alternatives.map((item) => item.domain).filter(Boolean) : [],
    buyerFit: Array.isArray(candidate?.buyerFit) ? candidate.buyerFit : [],
    catch: candidate?.catch || "",
    nextAction: candidate?.nextAction || "",
    riskFlags: Array.isArray(candidate?.riskFlags) ? candidate.riskFlags : [],
    qualityFlags: Array.isArray(candidate?.qualityFlags) ? candidate.qualityFlags : [],
    scores: {
      semanticFit: Number(scores.semanticFit || 0),
      buyerFit: Number(scores.buyerFit || 0),
      brandability: Number(scores.brandability || 0),
      pronounceability: Number(scores.pronounceability || 0),
      nameQuality: Number(scores.nameQuality || scores.brandability || 0),
      acquisitionSignal: Number(scores.acquisitionSignal || 0),
      acquisitionFriction: Number(scores.acquisitionFriction || 0),
      tldTrust: Number(scores.tldTrust || 0),
      seoPotential: Number(scores.seoPotential || 0),
      aiAppFit: Number(scores.aiAppFit || 0),
      riskAdjusted: Number(scores.riskAdjusted || 0),
      overall:
        typeof scores.overall === "number"
          ? scores.overall
          : typeof candidate?.fetchMatch === "number"
          ? candidate.fetchMatch
          : 0,
    },
  };
}

async function runFetch() {
  if (!canRunFetch()) return;
  fetchLoopToken += 1;
  const token = fetchLoopToken;

  state.activeStepIndex = 0;
  closeIntelligenceModal();
  state.fetchPhase = "interpreting";
  state.lastError = "";
  state.usedSuggestionFallback = false;
  state.noQualifiedLive = false;
  state.rejectedCandidates = [];
  state.candidateDiagnostics = [];
  state.rawCandidateCount = 0;
  state.sourceSummary = null;
  state.fetchDiagnostics = null;
  state.availabilityFailed = false;
  state.phaseMetrics = {
    auctionRawCount: 0,
    auctionQualifiedCount: 0,
    generatedCount: 0,
    availabilityCheckedCount: 0,
    availableCount: 0,
    registrationQualifiedCount: 0,
    generationPass: 0,
    errors: [],
  };
  state.lastFetchTimestamp = new Date().toISOString();
  state.expandedId = null;
  state.compareIds = [];
  state.watchedIds = [];
  state.fetchState = "fetching";
  syncStateViews();
  renderStatusRail();
  renderSkeletons();
  renderCompareTray();

  try {
    if (token !== fetchLoopToken) return;
    state.fetchPhase = "interpreting";
    state.activeStepIndex = 0;
    renderStatusRail();
    await sleep(120);

    if (token !== fetchLoopToken) return;
    state.fetchPhase = "fetching-auctions";
    state.activeStepIndex = 1;
    renderStatusRail();
    if (token !== fetchLoopToken) return;
    const effectiveIntent = buildEffectiveIntent();
    const result = await fetchDomainFetch(effectiveIntent);
    if (token !== fetchLoopToken) return;

    state.fetchPhase = "ranking-auctions";
    state.activeStepIndex = 2;
    renderStatusRail();
    await sleep(80);

    const sourceSummary = result.sourceSummary || {};
    state.fetchDiagnostics = result.diagnostics || null;
    window.__intentFetchWorkspace = {
      requestId: result.requestId,
      brief: effectiveIntent,
      candidates: Array.isArray(result.candidates) ? result.candidates : Array.isArray(result.decisionCandidates) ? result.decisionCandidates : [],
      sourceSummary,
    };
    document.dispatchEvent(new CustomEvent("intent-fetch:workspace-updated"));
    state.sourceSummary = sourceSummary;
    state.phaseMetrics = {
      auctionRawCount: Number(sourceSummary.auctionRecordsScanned || 0),
      auctionQualifiedCount: Number(sourceSummary.qualifiedAuctions || 0),
      generatedCount: Number(sourceSummary.generatedNames || 0),
      availabilityCheckedCount: Number(sourceSummary.availabilityChecked || 0),
      availableCount: Number(sourceSummary.availableDomains || 0),
      registrationQualifiedCount: Number(sourceSummary.registrationQualifiedCount || 0),
      generationPass: Number(sourceSummary.generationPasses || 0),
      errors: Array.isArray(sourceSummary.errors) ? sourceSummary.errors : [],
    };

    if (state.phaseMetrics.generatedCount > 0) {
      state.fetchPhase = "generating";
      state.activeStepIndex = 3;
      renderStatusRail();
      await sleep(80);
    }
    if (state.phaseMetrics.availabilityCheckedCount > 0) {
      state.fetchPhase = "checking-availability";
      state.activeStepIndex = 4;
      renderStatusRail();
      await sleep(80);
    }

    state.fetchPhase = "building-candidates";
    state.activeStepIndex = 5;
    renderStatusRail();
    await sleep(80);

    const auctionCandidates = Array.isArray(result.auctionCandidates) ? result.auctionCandidates : [];
    const registrationCandidates = Array.isArray(result.registrationCandidates) ? result.registrationCandidates : [];
    const decisionCandidates = Array.isArray(result.decisionCandidates) ? result.decisionCandidates : [];
    state.rawCandidateCount = auctionCandidates.length + registrationCandidates.length;
    state.candidateDiagnostics = [
      ...auctionCandidates.map((item) => toCandidateDiagnostic(item)),
      ...registrationCandidates.map((item) => toCandidateDiagnostic(item)),
    ];

    if (debugCandidates) {
      console.table(
        state.candidateDiagnostics.map((candidate) => ({
          domain: candidate.domain,
          eligible: candidate.eligible,
          semanticFit: candidate.scores.semanticFit,
          brandability: candidate.scores.brandability,
          pronounceability: candidate.scores.pronounceability,
          acquisitionSignal: candidate.scores.acquisitionSignal,
          reasons: candidate.rejectionReasons.join(", "),
        }))
      );
    }
    state.opportunities = decisionCandidates.map(adaptApiCandidateToUi);
    state.noQualifiedLive = Number(sourceSummary.qualifiedAuctions || 0) === 0;
    state.usedSuggestionFallback = Number(sourceSummary.registrationQualifiedCount || 0) > 0;
    state.availabilityFailed = state.phaseMetrics.errors.some((entry) => entry.source === "availability");
    state.rejectedCandidates = state.candidateDiagnostics.filter((item) => !item.eligible);

    const failureSources = new Set(state.phaseMetrics.errors.map((entry) => entry.source));
    const bothSourcesFailed = failureSources.has("auctions") && failureSources.has("availability");
    if (state.opportunities.length === 0 && bothSourcesFailed) {
      state.fetchPhase = "error";
      state.lastError = "Auction and availability sources are currently unavailable.";
      setFetchState("error");
      renderEmptyState();
      renderOpportunityList();
    } else if (state.opportunities.length === 0) {
      state.fetchPhase = "empty";
      setFetchState("empty");
      renderEmptyState();
      renderOpportunityList();
    } else {
      state.fetchPhase = "surfaced";
      setFetchState("surfaced");
      renderOpportunityList();
    }
    renderCompareTray();
    renderDiagnosticsPanel();
    if (state.fetchState !== "empty") renderEmptyState();
  } catch (error) {
    state.usedSuggestionFallback = false;
    state.noQualifiedLive = false;
    state.rejectedCandidates = [];
    state.candidateDiagnostics = [];
    state.rawCandidateCount = 0;
    state.sourceSummary = null;
    state.fetchDiagnostics = null;
    state.phaseMetrics = {
      auctionRawCount: 0,
      auctionQualifiedCount: 0,
      generatedCount: 0,
      availabilityCheckedCount: 0,
      availableCount: 0,
      registrationQualifiedCount: 0,
      generationPass: 0,
      errors: [],
    };
    state.lastError = error instanceof Error ? error.message : "Unknown fetch error.";
    window.__intentFetchWorkspace = null;
    state.fetchPhase = "error";
    setFetchState("error");
    renderEmptyState();
    renderDiagnosticsPanel();
  }
}

function handleSortChange(mode) {
  state.sortMode = mode;
  const visibleIds = new Set(applyFilters(state.opportunities).map((item) => item.id));
  if (state.expandedId && !visibleIds.has(state.expandedId)) state.expandedId = null;
  setFetchState("refining");
  renderOpportunityList();
  setTimeout(() => {
    if (state.fetchState === "refining") {
      setFetchState("surfaced");
      renderOpportunityList();
    }
  }, 150);
}

function handleFilterToggle(filter) {
  if (state.activeFilters.includes(filter)) state.activeFilters = state.activeFilters.filter((item) => item !== filter);
  else state.activeFilters = [...state.activeFilters, filter];
  const visibleIds = new Set(applyFilters(state.opportunities).map((item) => item.id));
  if (state.expandedId && !visibleIds.has(state.expandedId)) state.expandedId = null;
  setFetchState("refining");
  renderOpportunityList();
  setTimeout(() => {
    if (state.fetchState === "refining") {
      setFetchState("surfaced");
      renderOpportunityList();
    }
  }, 160);
}

function onInputChange(value) {
  state.intent = value;
  updateIntentCount();
  if (state.selectedExampleId && value !== starterBriefs.find((item) => item.id === state.selectedExampleId)?.prompt) {
    state.selectedExampleId = null;
    renderStarterBriefs();
  }
  if (value.trim().length === 0) {
    closeIntelligenceModal();
    state.opportunities = [];
    state.activeFilters = [];
    state.compareIds = [];
    state.watchedIds = [];
    state.usedSuggestionFallback = false;
    state.noQualifiedLive = false;
    state.rejectedCandidates = [];
    state.candidateDiagnostics = [];
    state.rawCandidateCount = 0;
    state.fetchDiagnostics = null;
    state.diagnosticsQuery = "";
    state.diagnosticsFilter = "all";
    window.__intentFetchWorkspace = null;
    document.dispatchEvent(new CustomEvent("intent-fetch:workspace-updated"));
    setFetchState("idle");
    renderCompareTray();
    renderEmptyState();
    renderStarterBriefs();
    renderConstraintChips();
    renderDiagnosticsPanel();
    return;
  }
  if (state.fetchState !== "surfaced") {
    setFetchState("primed");
  }
  autoResizeIntentInput();
}

function initEvents() {
  dom.intentInput.addEventListener("input", (event) => {
    onInputChange(event.target.value);
  });
  dom.intentInput.addEventListener("keyup", (event) => {
    onInputChange(event.target.value);
  });
  dom.intentInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    if (canRunFetch()) {
      event.preventDefault();
      runFetch();
    }
  });
  dom.intentInput.addEventListener("focus", () => {
    dom.commandWrap.classList.add("focused");
  });
  dom.intentInput.addEventListener("blur", () => {
    dom.commandWrap.classList.remove("focused");
  });
  if (dom.intentForm) {
    dom.intentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      runFetch();
    });
  } else {
    dom.fetchButton.addEventListener("click", runFetch);
  }
  dom.sortSelect.addEventListener("change", (event) => {
    handleSortChange(event.target.value);
  });
  if (dom.clearCompare) {
    dom.clearCompare.addEventListener("click", () => {
      state.compareIds = [];
      renderCompareTray();
      renderOpportunityList();
    });
  }
  if (dom.constraintsToggle) {
    dom.constraintsToggle.addEventListener("click", () => {
      state.constraintsOpen = !state.constraintsOpen;
      syncStateViews();
    });
  }
  if (dom.retryButton) dom.retryButton.addEventListener("click", runFetch);
  if (dom.intelligenceModalClose) {
    dom.intelligenceModalClose.addEventListener("click", closeIntelligenceModal);
  }
  if (dom.intelligenceModal) {
    dom.intelligenceModal.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.hasAttribute("data-modal-close")) {
        closeIntelligenceModal();
      }
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeIntelligenceModal();
  });
}

function init() {
  renderStarterBriefs();
  renderConstraintChips();
  renderStatusRail();
  renderSkeletons();
  renderEmptyState();
  renderDiagnosticsPanel();
  autoResizeIntentInput();
  updateIntentCount();
  updateProgressRail();
  syncStateViews();
  initEvents();
}

init();
