function normalizeSignalLabel(label) {
  const cleaned = String(label || "").trim();
  if (!cleaned) return "";

  if (/^saas/i.test(cleaned)) return "SaaS";
  if (/^ai$/i.test(cleaned)) return "AI";
  if (/^seo$/i.test(cleaned)) return "SEO";
  if (/^api$/i.test(cleaned)) return "API";
  if (/^b2b$/i.test(cleaned)) return "B2B";
  if (/^b2c$/i.test(cleaned)) return "B2C";

  return cleaned.replace(/\s+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupeNormalizedLabels(labels) {
  const seen = new Set();
  const normalized = [];

  for (const label of labels) {
    const next = normalizeSignalLabel(label);
    const key = next.toLowerCase();

    if (!next || seen.has(key)) continue;

    seen.add(key);
    normalized.push(next);
  }

  return normalized;
}

const SIGNAL_PATTERNS = [
  { pattern: /cybersecurity|cyber security|infosec|security/i, label: "Cybersecurity" },
  { pattern: /\bsaas\b/i, label: "SaaS" },
  { pattern: /\bb2b\b/i, label: "B2B" },
  { pattern: /\bb2c\b/i, label: "B2C" },
  { pattern: /\bfounder/i, label: "Founder" },
  { pattern: /workflow/i, label: "Workflow" },
  { pattern: /\breceptionist/i, label: "Receptionist" },
  { pattern: /\benterprise/i, label: "Enterprise" },
  { pattern: /\bproductivity/i, label: "Productivity" },
  { pattern: /\bautomation/i, label: "Automation" },
  { pattern: /\bsoftware/i, label: "Software" },
  { pattern: /\b\.com\b/i, label: ".com" },
  { pattern: /\b\.ai\b/i, label: ".ai" },
];

export function detectBriefSignals(brief) {
  const text = String(brief || "").trim();
  if (!text) return [];

  const patternLabels = [];
  SIGNAL_PATTERNS.forEach(({ pattern, label }) => {
    if (pattern.test(text)) patternLabels.push(label);
  });

  const rawLabels = [];
  text.split(/[\s,]+/).forEach((raw) => {
    const word = raw.replace(/[^a-zA-Z0-9.]/g, "");
    if (word.length >= 4 && !/^\d+$/.test(word)) {
      rawLabels.push(word);
    }
  });

  return dedupeNormalizedLabels([...patternLabels, ...rawLabels]).slice(0, 5);
}

export function getCandidateStatusLabel(candidate) {
  if (candidate?.source === "namesilo-auction" || candidate?.acquisitionPath?.type === "auction") {
    return "Auction active";
  }
  if (candidate?.status === "available") return "Available now";
  return "Verify status";
}

export function getCandidateMarketStatus(candidate) {
  if (candidate?.source === "namesilo-auction" || candidate?.acquisitionPath?.type === "auction") {
    return "AUCTION ACTIVE";
  }
  if (candidate?.status === "available") return "AVAILABLE";
  return "VERIFY";
}

export function getCandidatePriceAmount(candidate) {
  const path = candidate?.acquisitionPath || {};
  const isAuction =
    candidate?.source === "namesilo-auction" || path.type === "auction" || candidate?.salesMode === "auction";

  if (isAuction) {
    const bid = toPriceNumber(path.currentBid ?? candidate?.currentBid ?? path.openingBid);
    if (bid !== null) {
      return `$${bid.toLocaleString("en-US", { minimumFractionDigits: bid % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
    }
    return "—";
  }

  const regPrice = toPriceNumber(path.registrationPrice ?? candidate?.registrationPrice);
  if (regPrice !== null) return `$${regPrice.toFixed(2)}`;
  return "—";
}

export function getCandidateAcquisitionPath(candidate) {
  const path = candidate?.acquisitionPath || {};
  const isAuction =
    candidate?.source === "namesilo-auction" || path.type === "auction" || candidate?.salesMode === "auction";
  if (isAuction) return "Current bid";
  if (candidate?.status === "available") return "Register";
  return "Verify";
}

function titleCaseWord(value) {
  return normalizeSignalLabel(value);
}

export function getCandidateReasonLine(candidate) {
  const terms = candidate?.matchedTerms?.filter(Boolean).slice(0, 2);
  if (terms?.length >= 2) {
    const normalized = terms.map((term) => titleCaseWord(term));
    if (/ai/i.test(normalized[0]) || /ai/i.test(normalized[1])) {
      return `${normalized.join(" + ")} signal`;
    }
    return `${normalized.join(" + ")} compound`;
  }
  if (terms?.length === 1) {
    const term = titleCaseWord(terms[0]);
    return /ai|saas|b2b|receptionist/i.test(term) ? `${term} signal` : term;
  }
  if (candidate?.namingLaneLabel) {
    const lane = candidate.namingLaneLabel.toLowerCase();
    if (lane.includes("compound")) return "Category compound";
    return candidate.namingLaneLabel;
  }
  return "Matched to brief";
}

export async function fetchDomainCandidates(brief) {
  const response = await fetch("/api/domain-fetch", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brief,
      constraints: {
        includeAuctions: true,
      },
    }),
  });

  const raw = await response.text();
  let payload = {};

  if (raw && raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`Domain fetch returned invalid JSON (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Domain fetch failed (HTTP ${response.status}).`);
  }

  if (!Array.isArray(payload?.decisionCandidates)) {
    throw new Error(
      raw.trim().length === 0
        ? "Domain fetch returned an empty response."
        : "Domain fetch response is missing decisionCandidates."
    );
  }

  return payload;
}

function toPriceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortDecisionCandidates(candidates) {
  return [...candidates].sort((left, right) => {
    const leftAuction = left?.source === "namesilo-auction" ? 1 : 0;
    const rightAuction = right?.source === "namesilo-auction" ? 1 : 0;
    if (leftAuction !== rightAuction) return rightAuction - leftAuction;
    return (right?.scores?.overall || 0) - (left?.scores?.overall || 0);
  });
}

export function getCandidateFitScore(candidate) {
  const scores = candidate?.scores || {};
  if (typeof scores.overall === "number") return Math.round(scores.overall);
  if (typeof candidate?.fetchMatch === "number") return Math.round(candidate.fetchMatch);
  return null;
}

export function getCandidatePriceLabel(candidate) {
  const amount = getCandidatePriceAmount(candidate);
  const pathLabel = getCandidateAcquisitionPath(candidate);
  if (amount === "—") return pathLabel === "Current bid" ? "Auction active" : "—";
  if (pathLabel === "Current bid") return `${amount} current bid`;
  if (pathLabel === "Register") return `${amount} register`;
  return amount;
}

export function getCandidateSlug(candidate) {
  if (candidate?.slug) return candidate.slug;
  if (candidate?.domain) return candidate.domain.replace(/\./g, "-");
  return "";
}

export function buildDomainDetailLink(slug, { intentId, intentSlug, rank, fitScore } = {}) {
  const params = new URLSearchParams();
  if (intentId) params.set("intent_id", intentId);
  if (intentSlug) params.set("intent", intentSlug);
  if (rank != null && rank !== "") params.set("rank", String(rank));
  if (fitScore != null && fitScore !== "") params.set("fit", String(fitScore));
  const query = params.toString();
  return `/domains/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}

/** @deprecated use getCandidatePriceLabel */
export const getCandidateAuctionLabel = getCandidatePriceLabel;
