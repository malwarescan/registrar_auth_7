const crypto = require("crypto");

const intentsById = new Map();
const acquisitionEvents = [];

function slugifyIntent(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function categorySlug(businessType, productCategory) {
  const raw = String(businessType || productCategory || "domain-intent")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
  return slugifyIntent(raw) || "domain-intent";
}

function buyerProfileKey(targetBuyer) {
  const buyers = Array.isArray(targetBuyer) ? targetBuyer : [];
  if (buyers.some((entry) => /founder/i.test(entry))) return "founders/operators";
  if (buyers.some((entry) => /operator/i.test(entry))) return "operators/teams";
  const slugged = buyers
    .slice(0, 2)
    .map((entry) => slugifyIntent(entry))
    .filter(Boolean);
  return slugged.join(",") || "general-buyers";
}

function buildMatchedIntents(interpretedIntent, strategy, brief) {
  const intents = [];
  if (brief) intents.push(brief.trim());
  if (strategy?.primaryIntent && strategy.primaryIntent !== brief) {
    intents.push(String(strategy.primaryIntent).replace(/_/g, " "));
  }
  if (interpretedIntent?.productCategory) {
    intents.push(String(interpretedIntent.productCategory).toLowerCase());
  }
  if (interpretedIntent?.businessType) {
    intents.push(String(interpretedIntent.businessType).replace(/_/g, " ").toLowerCase());
  }
  return [...new Set(intents.map((entry) => entry.trim()).filter(Boolean))].slice(0, 5);
}

function buildDefaultMatchedIntents(candidate) {
  const intents = [];
  if (candidate?.primaryIntent) intents.push(String(candidate.primaryIntent).replace(/_/g, " "));
  if (candidate?.category) intents.push(String(candidate.category).toLowerCase());
  if (candidate?.namingLaneLabel) intents.push(`${String(candidate.namingLaneLabel).toLowerCase()} naming`);
  return [...new Set(intents.map((entry) => entry.trim()).filter(Boolean))].slice(0, 5);
}

function buildCandidateMatchedIntents(candidate, intentRecord) {
  const base = intentRecord?.matchedIntents || [];
  const extras = buildDefaultMatchedIntents(candidate);
  return [...new Set([...base, ...extras].map((entry) => entry.trim()).filter(Boolean))].slice(0, 6);
}

function createIntentId() {
  return `if_${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}`;
}

function createIntentRecord({ brief, interpretedIntent, strategy, fetchedAt, requestId }) {
  const intentId = createIntentId();
  const intentSlug = slugifyIntent(brief) || slugifyIntent(strategy?.primaryIntent) || "domain-intent";
  const intentCategory = categorySlug(interpretedIntent?.businessType, interpretedIntent?.productCategory);
  const buyerProfile = buyerProfileKey(interpretedIntent?.targetBuyer);

  const record = {
    intentId,
    intent_id: intentId,
    intentSlug,
    intent_slug: intentSlug,
    intentCategory,
    intent_category: intentCategory,
    buyerProfile,
    buyer_profile: buyerProfile,
    brief,
    label: brief.trim(),
    requestId,
    fetchedAt,
    interpretedIntent,
    strategy,
    matchedIntents: buildMatchedIntents(interpretedIntent, strategy, brief),
  };

  intentsById.set(intentId, record);
  return record;
}

function attachIntentSessionResults(intentRecord, { candidateCount, decisionCandidates = [] }) {
  if (!intentRecord) return intentRecord;
  intentRecord.candidateCount = candidateCount;
  intentRecord.candidateIds = decisionCandidates.map((c) => c.candidateId);
  intentsById.set(intentRecord.intentId, intentRecord);
  return intentRecord;
}

function titleCaseWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((word) => (/^ai$/i.test(word) ? "AI" : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function resolveIntentApplicationCategory(intentRecord, candidate) {
  if (intentRecord?.label) {
    const label = titleCaseWords(intentRecord.label);
    return /software|saas|tool|platform|product/i.test(label) ? label : `${label} Software`;
  }
  const raw = String(candidate?.primaryIntent || candidate?.category || "Domain").replace(/_/g, " ");
  return titleCaseWords(raw);
}

function resolveIntentBuyerType(intentRecord) {
  if (intentRecord?.buyerProfile) {
    return String(intentRecord.buyerProfile).replace(/\//g, " / ").replace(/,/g, ", ");
  }
  const buyers = intentRecord?.interpretedIntent?.targetBuyer;
  if (Array.isArray(buyers) && buyers.length) return buyers.slice(0, 2).join(" / ");
  return "Business buyers";
}

function buildDetectedSignals(intentRecord, candidate) {
  const signals = [];
  (candidate.matchedTerms || []).slice(0, 6).forEach((term) => {
    signals.push(titleCaseWords(term));
  });
  if (intentRecord?.label && !signals.length) {
    intentRecord.label.split(/\s+/).forEach((word) => signals.push(titleCaseWords(word)));
  }
  if (intentRecord?.interpretedIntent?.productCategory) {
    signals.push(titleCaseWords(String(intentRecord.interpretedIntent.productCategory)));
  }
  return [...new Set(signals.map((s) => s.trim()).filter(Boolean))].slice(0, 6);
}

function buildSchemaKeywords(intentRecord, candidate, matchedIntents) {
  const keywords = [...(matchedIntents || [])];
  if (intentRecord?.label) keywords.unshift(intentRecord.label.toLowerCase());
  if (intentRecord?.intentSlug) keywords.push(intentRecord.intentSlug.replace(/-/g, " "));
  (candidate.matchedTerms || []).forEach((term) => keywords.push(term.toLowerCase()));
  return [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 8);
}

function buildSourceIntentPayload(intentRecord, pageContext, candidate, scores) {
  if (!intentRecord) return undefined;
  return {
    intentId: intentRecord.intentId,
    intentSlug: intentRecord.intentSlug,
    intent: intentRecord.label,
    label: intentRecord.label,
    buyerType: resolveIntentBuyerType(intentRecord),
    category: resolveIntentApplicationCategory(intentRecord, candidate),
    rank: pageContext.rank,
    fitScore: pageContext.fitScore ?? scores.overall,
    candidateCount: intentRecord.candidateCount ?? null,
    source: "intent-fetch",
  };
}

function buildAlternativeDowngradeReason(current, related) {
  const currentScores = current.scores || {};
  const relatedScores = related.scores || {};
  const checks = [
    { key: "pronounceability", label: "Lower pronunciation confidence" },
    { key: "tldTrust", label: "Lower TLD trust" },
    { key: "brandability", label: "Lower brandability" },
    { key: "categoryClarity", label: "Weaker category clarity" },
    { key: "semanticFit", label: "Lower semantic fit" },
    { key: "buyerFit", label: "Lower buyer fit" },
    { key: "overall", label: "Lower overall fit" },
  ];

  let bestLabel = null;
  for (const check of checks) {
    const currentValue =
      check.key === "overall" ? currentScores.overall || 0 : currentScores[check.key] || 0;
    const relatedValue =
      check.key === "overall"
        ? relatedScores.overall || related.fitScore || 0
        : relatedScores[check.key] || 0;
    const scoreDelta = currentValue - relatedValue;
    if (scoreDelta > 3) {
      bestLabel = check.label;
      break;
    }
  }

  if (bestLabel) return bestLabel;
  if (related.matchReason && !/^related alternative/i.test(related.matchReason)) {
    return String(related.matchReason);
  }
  return "Lower-ranked alternative for this brief";
}

function buildAlternativeComparisonNote(current, related) {
  return buildAlternativeDowngradeReason(current, related);
}

function getIntent(intentId) {
  return intentsById.get(String(intentId || "")) || null;
}

function buildIntentMatchReasons(candidate, intentRecord) {
  const reasons = [];
  const matchedTerms = candidate.matchedTerms || [];

  if (matchedTerms.length) {
    reasons.push(`${matchedTerms.slice(0, 2).join("/")} wording`);
  } else if (intentRecord?.label) {
    reasons.push(`Aligned with “${intentRecord.label}” search intent`);
  }

  if (candidate.namingLaneLabel) {
    const lane = candidate.namingLaneLabel.toLowerCase();
    reasons.push(lane.includes("compound") ? "Clear compound structure" : `${candidate.namingLaneLabel} structure`);
  } else {
    reasons.push("Clear compound structure");
  }

  const tld = candidate.tld || (candidate.domain?.includes(".") ? `.${candidate.domain.split(".").pop()}` : ".com");
  if (candidate.acquisitionPath?.type === "auction") {
    reasons.push(`Live ${tld} auction path`);
  } else {
    reasons.push(`Available ${tld} registration`);
  }

  if ((candidate.scores?.tldTrust || 0) >= 85) {
    reasons.push("Strong TLD trust");
  }

  if ((candidate.scores?.brandability || 0) >= 70) {
    reasons.push("Strong brandable compound");
  }

  return reasons.slice(0, 5);
}

function buildEnhancedMatchedIntents(candidate, intentRecord) {
  const intents = [];
  if (intentRecord?.label) {
    intents.push(`${intentRecord.label.toLowerCase()} tool`);
  }
  const slug = intentRecord?.intentSlug || "";
  const label = String(intentRecord?.label || "").toLowerCase();
  if (slug === "founder-workflow" || /founder workflow/.test(label)) {
    intents.push("workflow software", "productivity SaaS", "operator workflow platform", "digital business");
  } else if (intentRecord?.matchedIntents?.length) {
    intentRecord.matchedIntents.forEach((entry) => intents.push(String(entry).toLowerCase()));
  }
  if (candidate.primaryIntent) intents.push(String(candidate.primaryIntent).replace(/_/g, " ").toLowerCase());
  if (candidate.category) intents.push(String(candidate.category).toLowerCase());
  return [...new Set(intents.map((entry) => entry.trim()).filter(Boolean))].slice(0, 6);
}

function appendNameSiloTrackingParams(actionUrl, { intentRecord, candidate, rank, fitScore }) {
  if (!actionUrl || !/^https:\/\/www\.namesilo\.com/i.test(actionUrl)) {
    return actionUrl;
  }

  try {
    const url = new URL(actionUrl);
    const tracking = {
      utm_source: "snatch",
      utm_medium: "domain_intent",
      utm_campaign: intentRecord?.intentSlug || "domain-intent",
      utm_content: candidate?.slug || candidate?.domain?.replace(/\./g, "-") || "unknown",
      utm_term: slugifyIntent(intentRecord?.label || "").replace(/-/g, "_").slice(0, 60),
      snatch_intent_id: intentRecord?.intentId || "",
      snatch_fit: fitScore != null && Number.isFinite(fitScore) ? String(Math.round(fitScore)) : "",
    };

    if (rank != null && Number.isFinite(rank)) {
      tracking.snatch_rank = String(Math.round(rank));
    }

    Object.entries(tracking).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    return actionUrl;
  }
}

function logAcquisitionClick(event) {
  const record = {
    event: "acquisition_click",
    ...event,
    timestamp: new Date().toISOString(),
  };
  acquisitionEvents.push(record);
  if (acquisitionEvents.length > 5000) acquisitionEvents.shift();
  process.stdout.write(`[intent] ${JSON.stringify(record)}\n`);
  return record;
}

function buildDomainDetailPath(slug, { intentId, intentSlug, rank, fitScore } = {}) {
  const params = new URLSearchParams();
  if (intentId) params.set("intent_id", intentId);
  if (intentSlug) params.set("intent", intentSlug);
  if (rank != null && rank !== "") params.set("rank", String(rank));
  if (fitScore != null && fitScore !== "") params.set("fit", String(fitScore));
  const query = params.toString();
  return `/domains/${slug}${query ? `?${query}` : ""}`;
}

function buildAcquirePath({ domain, intentId, candidateId, source, rank, fitScore }) {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  if (intentId) params.set("intent_id", intentId);
  if (candidateId) params.set("candidate_id", candidateId);
  if (source) params.set("source", source);
  if (rank != null && rank !== "") params.set("rank", String(rank));
  if (fitScore != null && fitScore !== "") params.set("fit", String(fitScore));
  return `/out/acquire?${params.toString()}`;
}

function parseIntentPageContext(searchParams) {
  const intentId = searchParams.get("intent_id") || "";
  const intentSlug = searchParams.get("intent") || "";
  const rankRaw = searchParams.get("rank");
  const fitRaw = searchParams.get("fit");
  return {
    intentId,
    intentSlug,
    rank: rankRaw != null && rankRaw !== "" ? Number(rankRaw) : null,
    fitScore: fitRaw != null && fitRaw !== "" ? Number(fitRaw) : null,
  };
}

function appendIntentQuery(path, pageContext) {
  if (!pageContext?.intentId) return path;
  const params = new URLSearchParams();
  params.set("intent_id", pageContext.intentId);
  if (pageContext.intentSlug) params.set("intent", pageContext.intentSlug);
  if (pageContext.rank != null) params.set("rank", String(pageContext.rank));
  if (pageContext.fitScore != null) params.set("fit", String(pageContext.fitScore));
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${params.toString()}`;
}

module.exports = {
  appendIntentQuery,
  appendNameSiloTrackingParams,
  attachIntentSessionResults,
  buildAcquirePath,
  buildAlternativeComparisonNote,
  buildAlternativeDowngradeReason,
  buildCandidateMatchedIntents,
  buildDefaultMatchedIntents,
  buildDetectedSignals,
  buildDomainDetailPath,
  buildEnhancedMatchedIntents,
  buildIntentMatchReasons,
  buildSchemaKeywords,
  buildSourceIntentPayload,
  createIntentRecord,
  getIntent,
  logAcquisitionClick,
  parseIntentPageContext,
  resolveIntentApplicationCategory,
  resolveIntentBuyerType,
  titleCaseWords,
};
