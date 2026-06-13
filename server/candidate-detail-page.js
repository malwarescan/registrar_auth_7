const { isStatusStale, listSessionCandidates } = require("./domain-fetch/candidate-service");
const {
  appendIntentQuery,
  buildAcquirePath,
  buildAlternativeDowngradeReason,
  buildDefaultMatchedIntents,
  buildSchemaKeywords,
  buildSourceIntentPayload,
  getIntent,
  resolveIntentApplicationCategory,
  titleCaseWords,
} = require("./domain-fetch/intent-session");
const { toPublicMetadataUrl } = require("./public-url");
const { renderSnatchLogoAnchor } = require("./snatch-logo-markup");
const { buildSeoJsonLd, buildSeoRenderData } = require("./renderers/seo-renderer");
const { buildIntentOverlay } = require("./renderers/overlay-renderer");
const { candidateViewToProductRecord } = require("./candidate-store/product-record");
const { normalizePageMode } = require("./candidate-store/product-lifecycle");

function renderSnatchHeader() {
  return `<header class="site-header">${renderSnatchLogoAnchor("/experiments/intent-fetch/")}</header>`;
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatUtc(isoValue) {
  if (!isoValue) return "Not available";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not published";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatHumanPhrase(text) {
  return titleCaseWords(String(text || ""))
    .replace(/\bSaas\b/g, "SaaS")
    .replace(/\bAi\b/g, "AI");
}

function formatWithArticle(phrase) {
  const text = formatHumanPhrase(phrase).trim();
  if (!text) return "";
  const firstWord = text.split(/\s+/)[0].toLowerCase();
  const article = /^[aeiou]/i.test(firstWord) || /^ai$/i.test(firstWord) ? "an" : "a";
  return `${article} ${text}`;
}

function displayApplicationCategory(intentRecord, candidate) {
  const category = resolveIntentApplicationCategory(intentRecord, candidate);
  if (/^general$/i.test(category)) {
    return intentRecord?.label ? formatHumanPhrase(intentRecord.label) : "your brief";
  }
  return formatHumanPhrase(category);
}

function resolveConfidence(candidate, scores) {
  if (typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)) {
    return candidate.confidence;
  }
  if (typeof scores.overall === "number" && Number.isFinite(scores.overall)) {
    return scores.overall / 100;
  }
  return 0.5;
}

function scoreLevel(value) {
  if (value >= 80) return "High";
  if (value >= 65) return "Moderate";
  if (value >= 50) return "Fair";
  if (value >= 35) return "Low";
  return "Weak";
}

function resolveCandidateTld(candidate) {
  if (candidate.tld) return candidate.tld;
  if (!candidate.domain?.includes(".")) return "";
  return `.${candidate.domain.split(".").pop()}`;
}

function buildTermSignalCopy(term) {
  const token = String(term || "").toLowerCase();
  if (token === "desk") return "Desk signals support, workflow, and back-office software.";
  if (token === "support") return "Support wording reads clearly for help-desk and service products.";
  if (token === "ai") return "AI token aligns with automation and assistant positioning.";
  if (token === "flow" || token === "ops") return `${formatHumanPhrase(token)} suggests operations and workflow tooling.`;
  return `'${token}' matches language from your brief.`;
}

function normalizeTaxonomyCategory(value) {
  let text = formatHumanPhrase(String(value || "").replace(/_/g, " ").replace(/-/g, " "));
  if (/^ai product$/i.test(text)) return "AI Software";
  if (/\bproduct$/i.test(text) && !/software|saas|platform|tool/i.test(text)) {
    text = text.replace(/\s+Product$/i, " Software");
  }
  return text;
}

function resolveDisplayCategory(intentRecord, candidate) {
  if (intentRecord?.interpretedIntent?.productCategory) {
    return normalizeTaxonomyCategory(intentRecord.interpretedIntent.productCategory);
  }
  if (intentRecord?.intentCategory) {
    return normalizeTaxonomyCategory(String(intentRecord.intentCategory).replace(/-/g, " "));
  }
  return normalizeTaxonomyCategory(candidate.category || candidate.primaryIntent || "software");
}

function resolveSchemaApplicationCategory(intentRecord, candidate) {
  const label = intentRecord?.label ? formatHumanPhrase(intentRecord.label) : null;
  if (label && !/\bsoftware$/i.test(label)) {
    return `${label} Software`;
  }
  return resolveDisplayCategory(intentRecord, candidate);
}

function isWeakTokenMatch(term, domain) {
  const token = String(term || "").toLowerCase();
  const root = String(domain || "").split(".")[0].toLowerCase();
  if (!token || !root) return false;
  if (token === "ai" && root.endsWith("ai") && root.length > 4 && !root.startsWith("ai")) return true;
  if (token.length <= 2 && root.includes(token) && !root.startsWith(token)) return true;
  return false;
}

function buildTermEvidence(term, candidate) {
  if (isWeakTokenMatch(term, candidate.domain)) {
    return {
      title: "Brandable AI signal",
      detail: "The name carries an AI suffix, but the core brand needs explanation.",
    };
  }
  return {
    title: `Why '${String(term).toLowerCase()}' works`,
    detail: buildTermSignalCopy(term),
  };
}

function resolveIntentTitleLabel(intentRecord, candidate) {
  if (intentRecord?.label) return formatHumanPhrase(intentRecord.label);
  return formatHumanPhrase(candidate.primaryIntent || candidate.category || "Domain");
}

function formatIntentForDescription(intentRecord, candidate) {
  const label = resolveIntentTitleLabel(intentRecord, candidate);
  if (/^AI\s+/i.test(label)) {
    return `AI ${label.replace(/^AI\s+/i, "").toLowerCase()}`;
  }
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function formatIntentClarityPhrase(intentRecord, candidate) {
  const label = resolveIntentTitleLabel(intentRecord, candidate);
  if (/^AI\s+/i.test(label)) {
    return `AI ${label.replace(/^AI\s+/i, "").toLowerCase()}`;
  }
  return label;
}

const WORKFLOW_SIGNAL_TERMS = ["desk", "support", "workflow", "helpdesk", "help", "flow", "ops"];

function domainRootLabel(candidate) {
  return String(candidate.domain || "").split(".")[0].toLowerCase();
}

function hasDeskSignal(candidate) {
  const terms = (candidate.matchedTerms || []).map((term) => String(term).toLowerCase());
  const root = domainRootLabel(candidate);
  return terms.includes("desk") || root.includes("desk");
}

function hasWorkflowStyleSignal(candidate) {
  const root = domainRootLabel(candidate);
  const terms = (candidate.matchedTerms || []).map((term) => String(term).toLowerCase());
  return WORKFLOW_SIGNAL_TERMS.some((term) => terms.includes(term) || root.includes(term));
}

function resolveLiteralIntentAspect(intentRecord) {
  const words = String(intentRecord?.label || "").split(/\s+/);
  const specific = words.find((word) => !/^ai$/i.test(word) && word.length >= 3);
  if (specific) return specific.toLowerCase();
  return String(intentRecord?.label || "intent").toLowerCase();
}

function buildCalibratedRecommendation(scores, candidate, intentRecord) {
  const semantic = scores.semanticFit ?? 0;
  const clarity = scores.categoryClarity ?? 0;
  const tld = scores.tldTrust ?? 0;

  if (hasWorkflowStyleSignal(candidate) && (semantic < 70 || clarity < 70)) {
    const intentPhrase = formatIntentClarityPhrase(intentRecord, candidate);
    return `Support/workflow .com with moderate ${intentPhrase} clarity`;
  }

  if (semantic < 70 || clarity < 70) {
    if (tld >= 85) return "Brandable .com with moderate intent clarity";
    return "Promising but less literal";
  }
  if (scores.overall >= 80) return "Strong overall fit for this brief";
  return "Solid candidate with tradeoffs to review";
}

function buildFitScoreContext(scores) {
  const highlights = [];
  if (Number.isFinite(scores.tldTrust) && scores.tldTrust >= 85) {
    highlights.push("strong TLD trust");
  }
  if (Number.isFinite(scores.semanticFit) && scores.semanticFit < 70) {
    highlights.push("moderate semantic fit");
  }
  if (Number.isFinite(scores.categoryClarity) && scores.categoryClarity < 70) {
    highlights.push("moderate category clarity");
  }
  if (!highlights.length && Number.isFinite(scores.overall)) {
    highlights.push(`${scoreLevel(scores.overall).toLowerCase()} overall match`);
  }
  if (highlights.length <= 1) return highlights.join("");
  return `${highlights.slice(0, -1).join(", ")}, and ${highlights[highlights.length - 1]}`;
}

function buildTradeoffLabel(scores, candidate, intentRecord) {
  const clarity = scores.categoryClarity ?? 0;
  const semantic = scores.semanticFit ?? 0;
  const tld = scores.tldTrust ?? 0;

  if (hasWorkflowStyleSignal(candidate) && (clarity < 70 || semantic < 70)) {
    const aspect = resolveLiteralIntentAspect(intentRecord);
    return `Tradeoff: strong workflow signal, weaker literal ${aspect} signal`;
  }

  if (clarity < 70 || semantic < 70) {
    if (tld >= 80) return "Tradeoff: brandable .com, weaker literal clarity";
    return "Tradeoff: moderate intent clarity";
  }
  return null;
}

function displayAcquisitionEaseScore(scores) {
  if (Number.isFinite(scores.acquisitionSignal)) return scores.acquisitionSignal;
  if (Number.isFinite(scores.acquisitionFriction)) return Math.max(0, Math.min(100, 100 - scores.acquisitionFriction));
  return null;
}

function buildIntentFitCopy(intentRecord, candidate, scores) {
  const label = intentRecord?.label ? formatHumanPhrase(intentRecord.label) : displayApplicationCategory(intentRecord, candidate);
  const lower = label.toLowerCase();
  const semantic = scores.semanticFit ?? 0;
  const clarity = scores.categoryClarity ?? 0;
  if (semantic < 70 || clarity < 70) {
    if (/receptionist/.test(lower)) {
      return "Best if you want a coined AI assistant brand, not a literal receptionist name.";
    }
    return "Moderate category clarity — stronger as a brandable name than a literal descriptor.";
  }
  if (/receptionist/.test(lower)) {
    return "Fits AI receptionist, help desk, and SMB operations automation language.";
  }
  if (/workflow|operations|automation/.test(lower)) {
    return "Works for workflow, operations, and automation software positioning.";
  }
  return `Aligned with ${lower} buyer language from your brief.`;
}

function buildTldTrustCopy(candidate, scores, alternatives) {
  const tld = resolveCandidateTld(candidate) || ".com";
  const trust = Math.round(scores.tldTrust || 0);
  const hasWeakerAlts = (alternatives || []).some((alt) => {
    const altTld = alt.domain?.includes(".") ? `.${alt.domain.split(".").pop()}` : "";
    return altTld && altTld !== ".com";
  });
  if (tld === ".com" && hasWeakerAlts) {
    return ".com gives this candidate higher trust than the lower-TLD alternatives.";
  }
  if (Number.isFinite(scores.tldTrust)) {
    return `${scoreLevel(trust)} ${tld} trust score (${trust}).`;
  }
  return `${tld} extension for this candidate.`;
}

function buildScoreBackedEvidenceRows(candidate, scores, isAuction, intentRecord) {
  const rows = [];
  const terms = (candidate.matchedTerms || []).filter(Boolean);
  const provider = candidate.acquisitionPath?.provider || "NameSilo";
  const alternatives = candidate.relatedCandidates || candidate.alternatives || [];

  if (terms.length) {
    rows.push(buildTermEvidence(terms[0], candidate));
  }

  rows.push({
    title: "Intent match",
    detail: buildIntentFitCopy(intentRecord, candidate, scores),
  });

  if (Number.isFinite(scores.tldTrust)) {
    rows.push({
      title: `${resolveCandidateTld(candidate) || ".com"} trust`,
      detail: buildTldTrustCopy(candidate, scores, alternatives),
    });
  }

  if (isAuction) {
    rows.push({
      title: "Verified acquisition path",
      detail: `Live ${provider} auction route detected and verified.`,
    });
  } else if (candidate.status === "available") {
    rows.push({
      title: "Register path available",
      detail: `${provider} registration route verified.`,
    });
  }

  const seen = new Set();
  return rows
    .filter((row) => {
      const key = row.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function buildSyntheticIntentRecord(candidate) {
  const matched = candidate.matchedIntents || [];
  const briefLike = matched.find((entry) => String(entry).trim().split(/\s+/).length >= 2) || matched[0];
  const label = candidate.intentLabel
    ? formatHumanPhrase(candidate.intentLabel)
    : briefLike
    ? formatHumanPhrase(String(briefLike).slice(0, 80))
    : formatHumanPhrase(String(candidate.primaryIntent || candidate.category || "Domain").replace(/_/g, " ").replace(/-/g, " "));
  const productCategory = resolveDisplayCategory(null, candidate);
  return {
    label,
    interpretedIntent: {
      productCategory,
      targetBuyer: candidate.buyerFit || [],
    },
  };
}

function resolveIntentRecord(pageContext, candidate) {
  const intentIds = [pageContext.intentId, candidate.intentId].filter(Boolean);
  for (const intentId of intentIds) {
    const record = getIntent(intentId);
    if (record) return record;
  }
  if (candidate.intentLabel || candidate.matchedIntents?.length || candidate.primaryIntent || candidate.category) {
    return buildSyntheticIntentRecord(candidate);
  }
  return null;
}

function buildHeroSubtitle(candidate, intentRecord, isAuction) {
  const intentLabel = intentRecord?.label ? formatHumanPhrase(intentRecord.label) : null;
  const category = resolveDisplayCategory(intentRecord, candidate);
  const tld = resolveCandidateTld(candidate) || ".com";

  if (intentLabel && category && intentLabel.toLowerCase() !== category.toLowerCase()) {
    return `${intentLabel} domain candidate in ${category}`;
  }
  if (intentLabel) {
    return isAuction
      ? `${formatWithArticle(intentLabel)} · ${tld} auction candidate`
      : `${formatWithArticle(intentLabel)} candidate`;
  }
  return isAuction ? `${formatWithArticle(category)} · ${tld} auction candidate` : `${formatWithArticle(category)} candidate`;
}

function buildHeroDecisionLine(candidate, scores, intentRecord, isAuction) {
  return buildHeroSubtitle(candidate, intentRecord, isAuction);
}

function buildIntentBackHref(intentRecord) {
  if (!intentRecord?.intentId) return "/experiments/intent-fetch/";
  return `/experiments/intent-fetch/?intent_id=${encodeURIComponent(intentRecord.intentId)}`;
}

function formatRelativeVerified(isoValue) {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Verified just now";
  if (diffMin < 60) return `Verified ${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Verified ${diffHr} hr ago`;
  return `Verified ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function formatAuctionEnd(isoValue) {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  return `Ends ${formatted} UTC`;
}

function renderSummaryStrip(candidate, scores, isAuction, stale) {
  const overall = Math.round(scores.overall || 0);
  const fitContext = buildFitScoreContext(scores);
  const primaryPriceValue = isAuction
    ? formatUsd(candidate.acquisitionPath?.currentBid)
    : formatUsd(candidate.acquisitionPath?.registrationPrice);
  const verified = formatRelativeVerified(candidate.statusVerifiedAt);

  const items = [
    `<div class="productSummaryItem productSummaryItem--wide">
      <span class="productSummaryLabel">Fit score</span>
      <strong>${overall}</strong>
      ${fitContext ? `<span class="productSummaryContext">${escapeHtml(fitContext)}</span>` : ""}
    </div>`,
  ];

  if (stale) {
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Status</span><strong>Needs refresh</strong></div>`);
  } else if (isAuction) {
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Status</span><strong>Auction active</strong></div>`);
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Current bid</span><strong>${escapeHtml(primaryPriceValue)}</strong></div>`);
  } else {
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Status</span><strong>Available now</strong></div>`);
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Register</span><strong>${escapeHtml(primaryPriceValue)}</strong></div>`);
  }

  if (verified) {
    items.push(`<div class="productSummaryItem"><span class="productSummaryLabel">Verification</span><strong>${escapeHtml(verified)}</strong></div>`);
  }

  return `<div class="productSummaryStrip">${items.join("")}</div>`;
}

function renderTradeoffBadge(scores, candidate, intentRecord) {
  const label = buildTradeoffLabel(scores, candidate, intentRecord);
  if (!label) return "";
  return `<div class="reportTradeoffBadge" role="note">${escapeHtml(label)}</div>`;
}

function renderDecisionCard(candidate, stale, scores) {
  const nextAction =
    candidate.nextAction ||
    (stale
      ? "Refresh auction status, compare alternatives, then open the acquisition path."
      : "Compare alternatives, confirm timing, then open the acquisition path.");
  const catchCopy =
    candidate.catch ||
    (candidate.acquisitionPath?.type === "auction"
      ? "Current bid is not the final purchase price."
      : "Availability can change quickly before checkout.");

  return `<div class="reportDecisionCard">
            <h2 class="reportDecisionTitle">Recommended action</h2>
            <p class="reportDecisionBody">${escapeHtml(nextAction)}</p>
            <p class="reportDecisionCatch"><span class="reportDecisionCatchLabel">Catch:</span> ${escapeHtml(catchCopy)}</p>
          </div>`;
}

function renderConsiderationsBlock(candidate) {
  const items = [];
  if (candidate.lessIdealIf) items.push(candidate.lessIdealIf);
  if (candidate.bestIf && !items.includes(candidate.bestIf)) items.push(`Best if: ${candidate.bestIf}`);
  (candidate.tradeoffs || []).slice(0, 2).forEach((entry) => items.push(entry));
  if (!items.length) return "";

  const list = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<div class="reportConsiderations">
            <h2 class="productSectionTitle">Why it might not work</h2>
            <ul class="reportConsiderationsList">${list}</ul>
          </div>`;
}

function buildTrustRowHtml(candidate, isAuction, stale) {
  const primaryPriceValue = isAuction
    ? formatUsd(candidate.acquisitionPath?.currentBid)
    : formatUsd(candidate.acquisitionPath?.registrationPrice);

  if (stale) {
    return `<div class="productTrustRow">
          <span id="candidate-status-badge">Status needs refresh</span>
          <span class="productTrustSep" aria-hidden="true">·</span>
          <span>${escapeHtml(primaryPriceValue)} last seen bid</span>
        </div>`;
  }

  const parts = [];
  if (isAuction) {
    parts.push("Auction active");
    parts.push(`${primaryPriceValue} current bid`);
    const auctionEnd = formatAuctionEnd(candidate.acquisitionPath?.auctionEndsAt);
    if (auctionEnd) parts.push(auctionEnd);
  } else {
    parts.push("Available now");
    parts.push(`${primaryPriceValue} registration`);
  }

  const verified = formatRelativeVerified(candidate.statusVerifiedAt);
  if (verified) parts.push(verified.toLowerCase());

  const inner = parts
    .map((part, index) => {
      const badge =
        index === 0
          ? `<span id="candidate-status-badge">${escapeHtml(part)}</span>`
          : `<span>${escapeHtml(part)}</span>`;
      return index === 0 ? badge : `<span class="productTrustSep" aria-hidden="true">·</span>${badge}`;
    })
    .join("");

  return `<div class="productTrustRow">${inner}</div>`;
}

function renderScoreBarRow(label, value) {
  const numeric = Number.isFinite(value) ? value : null;
  const width = numeric === null ? 0 : Math.min(100, Math.max(0, numeric));
  return `<div class="score-bar-row">
    <div class="score-bar-head"><span>${escapeHtml(label)}</span><strong>${numeric ?? "N/A"}</strong></div>
    <div class="score-bar-track" aria-hidden="true"><span class="score-bar-fill" style="width:${width}%"></span></div>
  </div>`;
}

const SCORE_BREAKDOWN_ROWS = [
  ["Overall", "overall"],
  ["TLD trust", "tldTrust"],
  ["Pronounceability", "pronounceability"],
  ["Brandability", "brandability"],
  ["Acquisition ease", "acquisitionEase"],
  ["Semantic fit", "semanticFit"],
  ["Category clarity", "categoryClarity"],
];

function renderCompactScoreBreakdown(scores) {
  const rows = SCORE_BREAKDOWN_ROWS.map(([label, key]) => {
    const value = key === "acquisitionEase" ? displayAcquisitionEaseScore(scores) : scores[key];
    if (!Number.isFinite(value)) return "";
    return renderScoreBarRow(label, value);
  }).filter(Boolean);
  if (!rows.length) return "";
  return `<div class="scoreBreakdownBlock reportPanel">
            <h2 class="productSectionTitle">Fit breakdown</h2>
            <div class="score-bars">${rows.join("")}</div>
          </div>`;
}

function resolveBuyerFitLabels(candidate, intentRecord) {
  const labels = new Set();
  const label = String(intentRecord?.label || "").toLowerCase();
  if (/receptionist/.test(label)) {
    ["Receptionist automation", "Appointment routing", "AI front desk", "Customer intake"].forEach((entry) =>
      labels.add(entry)
    );
  }
  if (intentRecord?.interpretedIntent?.targetBuyer?.length) {
    intentRecord.interpretedIntent.targetBuyer.forEach((entry) => {
      if (entry && !/^business buyers$/i.test(entry)) labels.add(formatHumanPhrase(entry));
    });
  }
  (candidate.buyerFit || []).forEach((entry) => {
    if (entry) labels.add(formatHumanPhrase(entry));
  });
  const slug = intentRecord?.intentSlug || "";
  if (slug === "founder-workflow" || /founder workflow/.test(label)) {
    ["SaaS founders", "Operator-led teams", "Workflow software buyers"].forEach((entry) => labels.add(entry));
  }
  if (/receptionist/.test(label)) {
    ["Help desk automation", "Workflow assistants", "SMB operations software"].forEach((entry) => labels.add(entry));
  }
  if (!labels.size) {
    ["Operations teams", "Small business owners", "Automation buyers"].forEach((entry) => labels.add(entry));
  }
  const seen = new Set();
  return [...labels].filter((entry) => {
    const key = entry.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function renderBestFitModule(candidate, intentRecord) {
  const labels = resolveBuyerFitLabels(candidate, intentRecord);
  if (!labels.length) return "";
  const chips = labels.map((label) => `<span class="buyer-chip">${escapeHtml(label)}</span>`).join("");
  return `<div class="reportBestFitBlock reportPanel">
            <h2 class="productSectionTitle">Best fit</h2>
            <div class="buyer-chip-row">${chips}</div>
          </div>`;
}

function renderAcquisitionModule(candidate, isAuction, stale) {
  const provider = candidate.acquisitionPath?.provider || "NameSilo";
  const typeLabel = isAuction ? "Auction" : "Registration";
  const priceLabel = isAuction ? "Current bid" : "Registration price";
  const priceValue = isAuction
    ? formatUsd(candidate.acquisitionPath?.currentBid)
    : formatUsd(candidate.acquisitionPath?.registrationPrice);
  const verified = formatRelativeVerified(candidate.statusVerifiedAt) || "Not verified";
  const ends = candidate.acquisitionPath?.auctionEndsAt ? formatUtc(candidate.acquisitionPath.auctionEndsAt) : null;
  const statusLabel = stale ? "Needs refresh" : isAuction ? "Auction active" : "Available now";
  const sourceLabel = isAuction ? `${provider} auction inventory` : `${provider} registration inventory`;

  return `<div class="reportAcquisitionCard reportPanel">
            <h2 class="productSectionTitle">Verified acquisition path</h2>
            <dl class="reportAcquisitionGrid">
              <div><dt>Source</dt><dd>${escapeHtml(sourceLabel)}</dd></div>
              <div><dt>Status</dt><dd>${escapeHtml(statusLabel)}</dd></div>
              <div><dt>Type</dt><dd>${escapeHtml(typeLabel)}</dd></div>
              <div><dt>${escapeHtml(priceLabel)}</dt><dd>${escapeHtml(priceValue)}</dd></div>
              <div><dt>Verified</dt><dd>${escapeHtml(verified)}</dd></div>
              ${ends ? `<div><dt>Ends</dt><dd>${escapeHtml(ends)}</dd></div>` : ""}
            </dl>
          </div>`;
}

function formatRelatedPriceLabel(item) {
  if (typeof item.registrationPrice === "number") return formatUsd(item.registrationPrice);
  if (typeof item.currentBid === "number") return `${formatUsd(item.currentBid)} bid`;
  if (item.status === "available") return "Register";
  if (item.status === "auction-active") return "Auction";
  return "—";
}

function buildAlternativeFitReason(current, item, intentRecord) {
  const fitScore = Math.round(item.scores?.overall ?? item.fitScore ?? 0);
  if (item.matchReason && !/^related alternative/i.test(item.matchReason)) {
    return fitScore > 0 ? `${fitScore} fit · ${item.matchReason}` : item.matchReason;
  }
  const label = intentRecord?.label ? formatHumanPhrase(intentRecord.label).toLowerCase() : "your brief";
  return fitScore > 0 ? `${fitScore} fit · Category-adjacent to ${label}` : `Category-adjacent to ${label}`;
}

function buildAlternativePageContext(pageContext, item) {
  return {
    intentId: pageContext.intentId,
    intentSlug: pageContext.intentSlug,
    rank: item.rank ?? null,
    fitScore: item.fitScore ?? item.scores?.overall ?? null,
  };
}

function buildAlternativeComparisonRowHtml(current, item, pageContext, intentRecord) {
  const baseUrl = item.url || `/domains/${String(item.domain || "").replace(/\./g, "-")}`;
  const altContext = buildAlternativePageContext(pageContext, item);
  const url = appendIntentQuery(baseUrl, altContext);
  const price = formatRelatedPriceLabel(item);
  const fitReason = buildAlternativeFitReason(current, item, intentRecord);
  const tradeoff = buildAlternativeDowngradeReason(current, item);
  const rank = item.rank ?? "—";

  return `<article class="alternativesCompareRow">
        <div class="alternativesCompareDomain">
          <span class="alternativeRank">#${rank}</span>
          <a class="alternativeDomain" href="${escapeHtml(url)}">${escapeHtml(item.domain)}</a>
        </div>
        <p class="alternativesCompareFit">${escapeHtml(fitReason)}</p>
        <p class="alternativesCompareTradeoff">${escapeHtml(tradeoff)}</p>
        <span class="alternativesComparePrice">${escapeHtml(price)}</span>
        <a class="alternativeReview" href="${escapeHtml(url)}">Review →</a>
      </article>`;
}

function buildAlternativeRowHtml(current, item, pageContext, intentRecord = null) {
  return buildAlternativeComparisonRowHtml(current, item, pageContext, intentRecord);
}

function buildSchemaDescription(candidate, intentRecord, scores) {
  const overall = Math.round(scores.overall || 0);
  const tld = resolveCandidateTld(candidate) || ".com";
  const isAuction = candidate.source === "namesilo-auction" || candidate.acquisitionPath?.type === "auction";
  const intentPhrase = formatIntentForDescription(intentRecord, candidate);
  const context = buildFitScoreContext(scores);
  const lead = isAuction ? `${tld} auction candidate` : "domain candidate";
  return `${candidate.domain} is a ${lead} for ${intentPhrase} and workflow software, scoring ${overall}/100${context ? ` with ${context}` : ""}.`;
}

function buildPageTitle(candidate, intentRecord) {
  const intent = resolveIntentTitleLabel(intentRecord, candidate);
  return `${candidate.domain} — ${intent} Domain Candidate | Snatch.auction`;
}

function buildPageHeadingName(candidate, intentRecord) {
  const intent = resolveIntentTitleLabel(intentRecord, candidate);
  return `${candidate.domain} — ${intent} Domain Candidate`;
}

function buildPageDescription(candidate, scores, intentRecord) {
  return buildSchemaDescription(candidate, intentRecord, scores);
}

function buildCanonicalPageTitle(candidate) {
  const tld = resolveCandidateTld(candidate) || ".com";
  return `${candidate.domain} — ${tld} Auction Domain | Snatch.auction`;
}

function buildCanonicalPageHeadingName(candidate) {
  const tld = resolveCandidateTld(candidate) || ".com";
  return `${candidate.domain} — ${tld} Auction Domain`;
}

function buildCanonicalSchemaDescription(candidate, scores) {
  const overall = Math.round(scores.overall || 0);
  const tld = resolveCandidateTld(candidate) || ".com";
  const context = buildFitScoreContext(scores);
  return `${candidate.domain} is a live ${tld} auction domain on NameSilo, scoring ${overall}/100${context ? ` with ${context}` : ""}.`;
}

function buildCanonicalHeroSubtitle(candidate) {
  const tld = resolveCandidateTld(candidate) || ".com";
  return `Live ${tld} auction on NameSilo`;
}

function buildCanonicalCalibratedLine(scores) {
  if ((scores.tldTrust ?? 0) >= 85) return "Live .com auction with verified acquisition path";
  return "Live auction listing with verified acquisition path";
}

function buildBaseEvidenceRows(candidate, scores, isAuction) {
  const rows = [];
  const terms = (candidate.matchedTerms || []).filter(Boolean);
  if (terms.length) rows.push(buildTermEvidence(terms[0], candidate));
  if (Number.isFinite(scores.brandability)) {
    rows.push({
      title: "Brandability",
      detail: `${scoreLevel(scores.brandability)} brandability (${Math.round(scores.brandability)}).`,
    });
  }
  if (Number.isFinite(scores.tldTrust)) {
    rows.push({
      title: `${resolveCandidateTld(candidate) || ".com"} trust`,
      detail: buildTldTrustCopy(candidate, scores, []),
    });
  }
  if (isAuction) {
    rows.push({
      title: "Verified acquisition path",
      detail: "Live NameSilo auction route detected and verified.",
    });
  }
  return rows.slice(0, 4);
}


function buildAcquireCtaLabel(isAuction, primaryPriceValue, stale) {
  if (stale) return "Refresh before acquisition";
  if (isAuction) return `View auction at NameSilo → ${primaryPriceValue}`;
  return `Register at NameSilo → ${primaryPriceValue}`;
}

function resolveProductRecord(candidate, options = {}) {
  return options.record || candidateViewToProductRecord(candidate, {
    indexable: options.indexable,
    published: options.published,
  });
}

function resolveRecordPageMode(options = {}) {
  const normalized = normalizePageMode(options.pageMode || "");
  if (normalized === "active-indexed" || normalized === "active-noindex" || normalized === "ended" || normalized === "sold" || normalized === "unavailable" || normalized === "invalid") {
    return normalized;
  }
  if (options.archived) return "ended";
  return options.indexable ? "active-indexed" : "active-noindex";
}

function isInactiveProductPageMode(pageMode) {
  const normalized = normalizePageMode(pageMode);
  return ["ended", "sold", "unavailable", "invalid", "archived"].includes(normalized);
}

function resolveLifecyclePresentation(pageMode, candidate) {
  const normalized = normalizePageMode(pageMode);
  if (normalized === "sold") {
    return {
      heroSubtitle: "Auction sold",
      calibratedLine: "This auction has sold. Final known status is shown below.",
      ctaDisabled: true,
      acquireCtaLabel: "Auction sold",
    };
  }
  if (normalized === "unavailable") {
    return {
      heroSubtitle: "Auction no longer active",
      calibratedLine: "This auction listing is no longer active on NameSilo.",
      ctaDisabled: true,
      acquireCtaLabel: "Auction no longer active",
      showAlternatives: true,
    };
  }
  if (normalized === "ended" || normalized === "archived") {
    return {
      heroSubtitle: "Auction ended",
      calibratedLine: "This auction listing is no longer active.",
      ctaDisabled: true,
      acquireCtaLabel: "Auction ended",
      showAlternatives: true,
    };
  }
  return {
    heroSubtitle: buildCanonicalHeroSubtitle(candidate),
    calibratedLine: buildCanonicalCalibratedLine(candidate.scores || {}),
    ctaDisabled: false,
    acquireCtaLabel: null,
    showAlternatives: false,
  };
}

const PRODUCT_PAGE_MODES = new Set([
  "active-indexed",
  "active-noindex",
  "ended",
  "sold",
  "unavailable",
  "invalid",
  "canonical",
  "product",
  "archived",
  "preview",
]);

function applySeoHeadToHtml(html, seo) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(seo.description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />`)
    .replace(/<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${seo.robots}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(seo.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(seo.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`)
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/<\/script/gi, "<\\/script")}</script>`
    );
}

function buildCandidateJsonLd(candidate, canonicalUrl, ogImage, stale, matchedIntents, options = {}) {
  const { canonicalMode = false, record = null } = options;
  if (canonicalMode) {
    const productRecord = record || candidateViewToProductRecord(candidate, { indexable: options.indexable });
    const mode = resolveRecordPageMode({ indexable: options.indexable, archived: stale && candidate.status === "auction-ended" });
    return buildSeoJsonLd(productRecord, mode, {
      metadataBaseUrl: options.metadataBaseUrl,
      ogImage,
      stale,
    });
  }

  const {
    indexable = false,
    metadataBaseUrl = "https://snatch.auction",
    intentRecord = null,
  } = options;
  const scores = candidate.scores || {};
  const isAuction = candidate.source === "namesilo-auction" || candidate.acquisitionPath?.type === "auction";
  const applicationCategory = canonicalMode ? "Auction domain" : resolveSchemaApplicationCategory(intentRecord, candidate);
  const keywords = canonicalMode
    ? [...new Set((candidate.matchedTerms || []).map((term) => String(term).toLowerCase()))].slice(0, 8)
    : buildSchemaKeywords(intentRecord, candidate, matchedIntents);
  const description = canonicalMode
    ? buildCanonicalSchemaDescription(candidate, scores)
    : buildSchemaDescription(candidate, intentRecord, scores);
  const pageName = canonicalMode
    ? buildCanonicalPageHeadingName(candidate)
    : buildPageHeadingName(candidate, intentRecord);

  const webpage = {
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: pageName,
    description,
    isPartOf: { "@id": `${metadataBaseUrl}/#website` },
    dateModified: candidate.statusVerifiedAt,
  };

  const productNode = {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: candidate.domain,
    description,
    image: [ogImage],
    sku: candidate.candidateId,
    category: "Domain name",
    brand: { "@type": "Brand", name: candidate.domain },
    applicationCategory,
    keywords,
  };

  const graph = [
    {
      "@type": "Organization",
      "@id": `${metadataBaseUrl}/#organization`,
      name: "Snatch.auction",
      url: `${metadataBaseUrl}/`,
    },
    {
      "@type": "WebSite",
      "@id": `${metadataBaseUrl}/#website`,
      url: `${metadataBaseUrl}/`,
      name: "Snatch.auction",
      publisher: { "@id": `${metadataBaseUrl}/#organization` },
    },
    { ...webpage, about: { "@id": `${canonicalUrl}#product` } },
    {
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${metadataBaseUrl}/` },
        { "@type": "ListItem", position: 2, name: "Domain candidates", item: `${metadataBaseUrl}/domains` },
        { "@type": "ListItem", position: 3, name: candidate.domain, item: canonicalUrl },
      ],
    },
    productNode,
  ];

  if (!indexable && !canonicalMode) {
    webpage.name = buildPageHeadingName(candidate, intentRecord);
  }

  const productIndex = graph.findIndex((node) => node["@type"] === "Product");
  const hasAuctionPrice =
    isAuction &&
    !stale &&
    typeof candidate.acquisitionPath?.currentBid === "number" &&
    candidate.acquisitionPath?.priceCurrency;
  const hasRegistrationPrice =
    !isAuction &&
    !stale &&
    candidate.status === "available" &&
    typeof candidate.acquisitionPath?.registrationPrice === "number" &&
    candidate.acquisitionPath?.priceCurrency;

  if (hasAuctionPrice) {
    const offer = {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      url: candidate.acquisitionPath?.actionUrl,
      priceCurrency: candidate.acquisitionPath.priceCurrency,
      price: candidate.acquisitionPath.currentBid,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "NameSilo" },
      validThrough: candidate.acquisitionPath?.auctionEndsAt || candidate.statusExpiresAt,
      description: candidate.catch || "Current bid is not the final sale price.",
      businessFunction: "http://purl.org/goodrelations/v1#Sell",
      priceSpecification: {
        "@type": "PriceSpecification",
        price: candidate.acquisitionPath.currentBid,
        priceCurrency: candidate.acquisitionPath.priceCurrency,
        name: "Current auction bid",
      },
    };
    if (typeof candidate.acquisitionPath?.bidCount === "number" && candidate.acquisitionPath.bidCount > 0) {
      offer.offerCount = candidate.acquisitionPath.bidCount;
    }
    graph[productIndex].offers = offer;
  } else if (hasRegistrationPrice) {
    graph[productIndex].offers = {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      url: candidate.acquisitionPath?.actionUrl,
      priceCurrency: candidate.acquisitionPath.priceCurrency,
      price: candidate.acquisitionPath.registrationPrice,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "NameSilo" },
      validThrough: candidate.statusExpiresAt,
    };
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function renderCtaDisclaimers(isAuction, stale) {
  const lines = [];
  if (isAuction) {
    lines.push("Current bid is not the final purchase price.");
    lines.push("Auction status should be refreshed before bidding.");
  }
  lines.push("External acquisition handled by NameSilo.");
  if (stale) lines.unshift("Refresh status before opening the acquisition path.");
  return `<div class="productAcquireDisclaimers">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`;
}

function hydrateCandidateForDetailPage(candidate) {
  const session = listSessionCandidates();
  const rankById = new Map();
  session.forEach((entry, index) => {
    rankById.set(entry.candidateId, entry.sessionRank ?? index + 1);
  });

  const relatedSource = candidate.relatedCandidates || candidate.alternatives || [];
  const relatedCandidates = relatedSource.map((item) => ({
    ...item,
    rank: item.rank ?? rankById.get(item.candidateId) ?? null,
    fitScore: item.fitScore ?? item.scores?.overall ?? null,
  }));

  return {
    ...candidate,
    sessionRank: candidate.sessionRank ?? rankById.get(candidate.candidateId) ?? null,
    relatedCandidates,
    alternatives: relatedCandidates,
  };
}

function renderCandidatePageHtml(candidate, pageContext = {}, options = {}) {
  const pageMode = normalizePageMode(options.pageMode || "session");
  if (PRODUCT_PAGE_MODES.has(pageMode)) {
    return renderCanonicalDomainPage(candidate, pageContext, {
      ...options,
      pageMode,
      indexable: pageMode === "active-indexed" && options.indexable !== false,
    });
  }
  if (pageMode === "overlay") {
    return renderIntentOverlayPage(options.baseCandidate || candidate, candidate, pageContext, options);
  }
  return renderSessionRecommendationPage(candidate, pageContext, options);
}

function renderSessionRecommendationPage(candidate, pageContext = {}, options = {}) {
  candidate = hydrateCandidateForDetailPage(candidate);
  const { indexable = false, port, isProduction } = options;
  const metadataOptions = { port, isProduction, allowLocalhostInMetadata: false };
  const slug = candidate.slug || candidate.domain.replace(/\./g, "-");
  const canonicalUrl =
    candidate.canonicalUrl || toPublicMetadataUrl(`/domains/${slug}`, metadataOptions);
  const ogImage = toPublicMetadataUrl(`/domain-assets/${slug}.png`, metadataOptions);
  const metadataBaseUrl = toPublicMetadataUrl("/", metadataOptions).replace(/\/$/, "");
  const stale = isStatusStale(candidate);
  const visibleStatus = stale ? "pending-verification" : candidate.status;
  const statusLabel =
    visibleStatus === "available"
      ? "Available"
      : visibleStatus === "auction-active"
      ? "Auction active"
      : visibleStatus === "pending-verification"
      ? "Refresh required"
      : visibleStatus;
  const scores = candidate.scores || {};
  const confidence = resolveConfidence(candidate, scores);
  const isAuction = candidate.source === "namesilo-auction" || candidate.acquisitionPath?.type === "auction";
  const intentRecord = resolveIntentRecord(pageContext, candidate);
  const effectivePageContext = {
    ...pageContext,
    intentId: pageContext.intentId || candidate.intentId || "",
    rank: pageContext.rank ?? candidate.sessionRank ?? null,
    fitScore: pageContext.fitScore ?? scores.overall ?? null,
  };
  const pageDescription = buildPageDescription(candidate, scores, intentRecord);
  const pageTitle = buildPageTitle(candidate, intentRecord);
  const heroSubtitle = buildHeroSubtitle(candidate, intentRecord, isAuction);
  const calibratedLine = buildCalibratedRecommendation(scores, candidate, intentRecord);
  const tradeoffBadgeHtml = renderTradeoffBadge(scores, candidate, intentRecord);
  const summaryStripHtml = renderSummaryStrip(candidate, scores, isAuction, stale);
  const decisionCardHtml = renderDecisionCard(candidate, stale, scores);
  const considerationsHtml = renderConsiderationsBlock(candidate);
  const evidenceRows = buildScoreBackedEvidenceRows(candidate, scores, isAuction, intentRecord);
  const evidenceRowsHtml = evidenceRows
    .map(
      (row) =>
        `<li class="evidenceItem"><span class="evidenceMark" aria-hidden="true"></span><div class="evidenceCopy"><strong class="evidenceTitle">${escapeHtml(row.title)}</strong><p class="evidenceDetail">${escapeHtml(row.detail)}</p></div></li>`
    )
    .join("");
  const scoreBreakdownHtml = renderCompactScoreBreakdown(scores);
  const bestFitHtml = renderBestFitModule(candidate, intentRecord);
  const acquisitionHtml = renderAcquisitionModule(candidate, isAuction, stale);
  const buyerFitLabels = resolveBuyerFitLabels(candidate, intentRecord);
  const relatedRows = (candidate.relatedCandidates || candidate.alternatives || [])
    .map((item) => buildAlternativeComparisonRowHtml(candidate, item, effectivePageContext, intentRecord))
    .join("");
  const primaryPriceValue = isAuction
    ? formatUsd(candidate.acquisitionPath?.currentBid)
    : formatUsd(candidate.acquisitionPath?.registrationPrice);
  const acquireCtaLabel = buildAcquireCtaLabel(isAuction, primaryPriceValue, stale);
  const trustRowHtml = buildTrustRowHtml(candidate, isAuction, stale);
  const ctaDisclaimersHtml = renderCtaDisclaimers(isAuction, stale);
  const acquireHref = stale
    ? "#"
    : buildAcquirePath({
        domain: candidate.domain,
        intentId: effectivePageContext.intentId,
        candidateId: candidate.candidateId,
        source: "domain-detail",
        rank: effectivePageContext.rank,
        fitScore: effectivePageContext.fitScore,
      });
  const actionBlockHtml = stale
    ? `${trustRowHtml}
                <button type="button" id="refresh-candidate" class="productPrimaryCta productPrimaryCta--refresh" data-candidate-id="${escapeHtml(candidate.candidateId)}">${escapeHtml(acquireCtaLabel)}</button>
                ${ctaDisclaimersHtml}
                <p class="productAcquireNote">Last checked ${escapeHtml(formatUtc(candidate.statusVerifiedAt))}</p>`
    : `${trustRowHtml}
                <a id="open-acquisition-path" href="${escapeHtml(acquireHref)}" class="productPrimaryCta candidate-action-primary">${escapeHtml(acquireCtaLabel)}</a>
                ${ctaDisclaimersHtml}
                <button type="button" id="refresh-candidate" class="productRefreshLink" data-candidate-id="${escapeHtml(candidate.candidateId)}">Refresh status</button>`;
  const intentContextHtml = intentRecord
    ? `<p class="productContext">
          <a class="productContextBack" href="${escapeHtml(buildIntentBackHref(intentRecord))}">← Results</a>
          <span class="productContextSep" aria-hidden="true">/</span>
          <span class="productContextBrief">${escapeHtml(formatHumanPhrase(intentRecord.label))}</span>
        </p>`
    : "";
  const matchedIntents = candidate.matchedIntents?.length
    ? candidate.matchedIntents
    : buildDefaultMatchedIntents(candidate);
  const sourceIntent = buildSourceIntentPayload(intentRecord, effectivePageContext, candidate, scores);
  const handoff = stale
    ? undefined
    : {
        type: "tracked_redirect",
        url: acquireHref,
      };
  const decisionCandidateData = {
    schemaVersion: candidate.schemaVersion,
    candidateId: candidate.candidateId,
    candidateType: candidate.candidateType,
    domain: candidate.domain,
    canonicalUrl,
    matchedIntents,
    source: candidate.source,
    status: visibleStatus,
    statusVerifiedAt: candidate.statusVerifiedAt,
    statusExpiresAt: candidate.statusExpiresAt,
    category: resolveDisplayCategory(intentRecord, candidate),
    intentCategory: resolveDisplayCategory(intentRecord, candidate),
    whySurfaced: candidate.whySurfaced,
    buyerFit: buyerFitLabels,
    catch: candidate.catch,
    nextAction: candidate.nextAction,
    acquisitionPath: {
      type: candidate.acquisitionPath?.type,
      provider: candidate.acquisitionPath?.provider,
      priceType: candidate.acquisitionPath?.priceType,
      url: candidate.acquisitionPath?.actionUrl,
      currentBid: candidate.acquisitionPath?.currentBid,
      bidCount: candidate.acquisitionPath?.bidCount,
      auctionEndsAt: candidate.acquisitionPath?.auctionEndsAt,
      registrationPrice: candidate.acquisitionPath?.registrationPrice,
      renewalPrice: candidate.acquisitionPath?.renewalPrice,
      sourceType: isAuction ? "auction-inventory" : "custom-generated-availability",
      requiresConfirmation: true,
    },
    scores: {
      semanticFit: scores.semanticFit,
      buyerFit: scores.buyerFit,
      brandability: scores.brandability,
      pronounceability: scores.pronounceability,
      categoryClarity: scores.categoryClarity,
      tldTrust: scores.tldTrust,
      acquisitionFriction: scores.acquisitionFriction,
      riskAdjusted: scores.riskAdjusted,
      overall: scores.overall,
    },
    confidence: candidate.confidence,
    availableActions: candidate.availableActions,
    nextAction: candidate.nextAction,
    sourceIntent,
    intent: sourceIntent,
    handoff,
    sessionIntent: sourceIntent,
  };
  const jsonLd = buildCandidateJsonLd(candidate, canonicalUrl, ogImage, stale, matchedIntents, {
    indexable,
    metadataBaseUrl,
    intentRecord,
  });
  const safeCandidateJson = JSON.stringify(decisionCandidateData).replace(/<\/script/gi, "<\\/script");
  const safeJsonLd = JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script");
  const alternateApiHref = `/api/candidates/${encodeURIComponent(candidate.candidateId)}`;
  const robotsContent = indexable
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const isLongDomain = String(candidate.domain || "").length > 18;
  const alternativesHtml = relatedRows
    ? `<div class="alternativesCompare">
            <div class="alternativesCompareHead" aria-hidden="true">
              <span>Domain</span>
              <span>Fit reason</span>
              <span>Tradeoff</span>
              <span>Price</span>
              <span>Action</span>
            </div>
            ${relatedRows}
          </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="${robotsContent}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(candidate.domain)} | Snatch.auction" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link rel="alternate" type="application/json" href="${escapeHtml(alternateApiHref)}" title="Decision Candidate JSON" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-feed.ndjson" title="Domain Candidate Feed" />
    <link rel="stylesheet" href="/assets/app.css?v=dev7" />
  </head>
  <body class="snatch-app domainPage candidate-detail-page">
    ${renderSnatchHeader()}
    <main id="main-content" class="domainPageMain" data-candidate-id="${escapeHtml(candidate.candidateId)}" data-domain="${escapeHtml(
    candidate.domain
  )}" data-status="${escapeHtml(visibleStatus)}" data-source="${escapeHtml(candidate.source)}" data-status-expires-at="${escapeHtml(
    candidate.statusExpiresAt || ""
  )}"${pageContext.intentId ? ` data-intent-id="${escapeHtml(pageContext.intentId)}"` : ""}${intentRecord ? ` data-intent-label="${escapeHtml(intentRecord.label)}"` : ""}>
      <nav aria-label="Breadcrumb" class="breadcrumbs candidate-breadcrumbs sr-only">
        <a href="/">Home</a> / <a href="/domains">Domain candidates</a> / <span aria-current="page">${escapeHtml(candidate.domain)}</span>
      </nav>
      <section class="productHeroStage">
        <div class="detailContent">
          ${intentContextHtml ? `<div class="productBreadcrumb">${intentContextHtml}</div>` : ""}
          <h1 class="productTitle${isLongDomain ? " is-long-domain" : ""}">${escapeHtml(candidate.domain)}</h1>
          <p class="productSubtitle">${escapeHtml(heroSubtitle)}</p>
          <p class="productCalibrated">${escapeHtml(calibratedLine)}</p>
          ${tradeoffBadgeHtml}
          ${summaryStripHtml}
        </div>
      </section>
      <section class="productEvidence">
        <div class="detailContent">
          ${decisionCardHtml}
          <div class="productWhyBlock">
            <h2 id="why-picked" class="productSectionTitle">Why we picked it</h2>
            <ul class="evidenceList evidenceList--report">${evidenceRowsHtml}</ul>
          </div>
          ${considerationsHtml}
          ${scoreBreakdownHtml}
          ${bestFitHtml}
          ${acquisitionHtml}
          <div class="productActionBlock">
            ${actionBlockHtml}
          </div>
          <div class="productAlternativesBlock">
            <h2 id="other-directions" class="productSectionTitle">Alternatives</h2>
            ${
              alternativesHtml || '<p class="candidate-empty">No related candidates.</p>'
            }
          </div>
        </div>
      </section>
    </main>
    <div class="candidate-mobile-bar" aria-hidden="true">
      <a class="candidate-mobile-bar-cta" href="${escapeHtml(acquireHref)}" ${stale ? 'aria-disabled="true"' : ""}>${escapeHtml(acquireCtaLabel)}</a>
    </div>
    <script id="decision-candidate-data" type="application/json">${safeCandidateJson}</script>
    <script type="application/ld+json">${safeJsonLd}</script>
    <script src="/assets/domain-candidate-page.js" defer></script>
    <script src="/assets/domain-candidate-webmcp.js" defer></script>
  </body>
</html>`;
}

function renderCanonicalDomainPage(candidate, pageContext = {}, options = {}) {
  candidate = hydrateCandidateForDetailPage(candidate);
  const pageMode = resolveRecordPageMode(options);
  const indexable = pageMode === "active-indexed" && options.indexable !== false;
  const lifecycle = resolveLifecyclePresentation(pageMode, candidate);
  const inactive = isInactiveProductPageMode(pageMode);
  const { port, isProduction } = options;
  const metadataOptions = { port, isProduction, allowLocalhostInMetadata: false };
  const slug = candidate.slug || candidate.domain.replace(/\./g, "-");
  const ogImage = toPublicMetadataUrl(`/domain-assets/${slug}.png`, metadataOptions);
  const metadataBaseUrl = toPublicMetadataUrl("/", metadataOptions).replace(/\/$/, "");
  const stale = inactive || isStatusStale(candidate);
  const record = resolveProductRecord(candidate, { ...options, indexable });
  const seo = buildSeoRenderData(record, pageMode, {
    indexable,
    stale,
    ogImage,
    metadataBaseUrl,
    metadataOptions,
  });
  const pageTitle = seo.title;
  const pageDescription = seo.description;
  const canonicalUrl = seo.canonicalUrl;
  const visibleStatus = stale && !inactive ? "pending-verification" : candidate.status;
  const scores = candidate.scores || {};
  const isAuction = candidate.source === "namesilo-auction" || candidate.acquisitionPath?.type === "auction";
  const heroSubtitle = lifecycle.heroSubtitle;
  const calibratedLine = lifecycle.calibratedLine;
  const summaryStripHtml = renderSummaryStrip(candidate, scores, isAuction, stale);
  const decisionCardHtml = renderDecisionCard(candidate, stale, scores);
  const considerationsHtml = renderConsiderationsBlock(candidate);
  const evidenceRowsHtml = buildBaseEvidenceRows(candidate, scores, isAuction)
    .map(
      (row) =>
        `<li class="evidenceItem"><span class="evidenceMark" aria-hidden="true"></span><div class="evidenceCopy"><strong class="evidenceTitle">${escapeHtml(row.title)}</strong><p class="evidenceDetail">${escapeHtml(row.detail)}</p></div></li>`
    )
    .join("");
  const scoreBreakdownHtml = renderCompactScoreBreakdown(scores);
  const acquisitionHtml = renderAcquisitionModule(candidate, isAuction, stale);
  const primaryPriceValue = isAuction
    ? formatUsd(candidate.acquisitionPath?.currentBid)
    : formatUsd(candidate.acquisitionPath?.registrationPrice);
  const acquireCtaLabel = lifecycle.acquireCtaLabel || buildAcquireCtaLabel(isAuction, primaryPriceValue, stale);
  const trustRowHtml = buildTrustRowHtml(candidate, isAuction, stale);
  const ctaDisclaimersHtml = renderCtaDisclaimers(isAuction, stale);
  const acquireHref = stale || lifecycle.ctaDisabled
    ? "#"
    : buildAcquirePath({
        domain: candidate.domain,
        candidateId: candidate.candidateId,
        source: "domain-detail",
      });
  const actionBlockHtml = stale || lifecycle.ctaDisabled
    ? `${trustRowHtml}
                <button type="button" id="refresh-candidate" class="productPrimaryCta productPrimaryCta--refresh" data-candidate-id="${escapeHtml(candidate.candidateId)}" ${lifecycle.ctaDisabled ? "disabled" : ""}>${escapeHtml(acquireCtaLabel)}</button>
                ${ctaDisclaimersHtml}
                <p class="productAcquireNote">${inactive ? "Last known status" : "Last checked"} ${escapeHtml(formatUtc(candidate.statusVerifiedAt))}</p>`
    : `${trustRowHtml}
                <a id="open-acquisition-path" href="${escapeHtml(acquireHref)}" class="productPrimaryCta candidate-action-primary">${escapeHtml(acquireCtaLabel)}</a>
                ${ctaDisclaimersHtml}
                <button type="button" id="refresh-candidate" class="productRefreshLink" data-candidate-id="${escapeHtml(candidate.candidateId)}">Refresh status</button>`;
  const alternativesHtml = lifecycle.showAlternatives
    ? `<div class="productAlternativesBlock"><h2 class="productSectionTitle">Alternatives</h2><p class="candidate-empty">Browse comparable domains in the active auction catalog.</p></div>`
    : "";
  const matchedIntents = buildDefaultMatchedIntents(candidate);
  const decisionCandidateData = {
    candidateId: candidate.candidateId,
    domain: candidate.domain,
    canonicalUrl,
    source: candidate.source,
    status: visibleStatus,
    statusVerifiedAt: candidate.statusVerifiedAt,
    statusExpiresAt: candidate.statusExpiresAt,
    acquisitionPath: {
      type: candidate.acquisitionPath?.type,
      provider: candidate.acquisitionPath?.provider,
      url: candidate.acquisitionPath?.actionUrl,
      currentBid: candidate.acquisitionPath?.currentBid,
    },
    scores: {
      brandability: scores.brandability,
      pronounceability: scores.pronounceability,
      categoryClarity: scores.categoryClarity,
      tldTrust: scores.tldTrust,
      overall: scores.overall,
    },
  };
  const jsonLd = seo.jsonLd;
  const safeCandidateJson = JSON.stringify(decisionCandidateData).replace(/<\/script/gi, "<\\/script");
  const safeJsonLd = JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script");
  const robotsContent = seo.robots;
  const isLongDomain = String(candidate.domain || "").length > 18;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(pageTitle)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="${robotsContent}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(candidate.domain)} | Snatch.auction" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link rel="stylesheet" href="/assets/app.css?v=dev7" />
  </head>
  <body class="snatch-app domainPage candidate-detail-page candidate-detail-page--canonical">
    ${renderSnatchHeader()}
    <main id="main-content" class="domainPageMain" data-candidate-id="${escapeHtml(candidate.candidateId)}" data-domain="${escapeHtml(
    candidate.domain
  )}" data-status="${escapeHtml(visibleStatus)}" data-source="${escapeHtml(candidate.source)}" data-page-mode="canonical">
      <nav aria-label="Breadcrumb" class="breadcrumbs candidate-breadcrumbs sr-only">
        <a href="/">Home</a> / <a href="/domains">Domain candidates</a> / <span aria-current="page">${escapeHtml(candidate.domain)}</span>
      </nav>
      <section class="productHeroStage">
        <div class="detailContent">
          <h1 class="productTitle${isLongDomain ? " is-long-domain" : ""}">${escapeHtml(candidate.domain)}</h1>
          <p class="productSubtitle">${escapeHtml(heroSubtitle)}</p>
          <p class="productCalibrated">${escapeHtml(calibratedLine)}</p>
          ${summaryStripHtml}
        </div>
      </section>
      <section class="productEvidence">
        <div class="detailContent">
          ${decisionCardHtml}
          <div class="productWhyBlock">
            <h2 id="why-picked" class="productSectionTitle">Domain signals</h2>
            <ul class="evidenceList evidenceList--report">${evidenceRowsHtml}</ul>
          </div>
          ${considerationsHtml}
          ${scoreBreakdownHtml}
          ${acquisitionHtml}
          <div class="productActionBlock">
            ${actionBlockHtml}
          </div>
          ${alternativesHtml}
        </div>
      </section>
    </main>
    <div class="candidate-mobile-bar" aria-hidden="true">
      <a class="candidate-mobile-bar-cta" href="${escapeHtml(acquireHref)}" ${stale || lifecycle.ctaDisabled ? 'aria-disabled="true"' : ""}>${escapeHtml(acquireCtaLabel)}</a>
    </div>
    <script id="decision-candidate-data" type="application/json">${safeCandidateJson}</script>
    <script type="application/ld+json">${safeJsonLd}</script>
    <script src="/assets/domain-candidate-page.js" defer></script>
    <script src="/assets/domain-candidate-webmcp.js" defer></script>
  </body>
</html>`;
}

function renderIntentOverlayPage(baseCandidate, sessionCandidate, pageContext = {}, options = {}) {
  const metadataOptions = { port: options.port, isProduction: options.isProduction, allowLocalhostInMetadata: false };
  const slug = baseCandidate.slug || baseCandidate.domain.replace(/\./g, "-");
  const ogImage = toPublicMetadataUrl(`/domain-assets/${slug}.png`, metadataOptions);
  const metadataBaseUrl = toPublicMetadataUrl("/", metadataOptions).replace(/\/$/, "");
  const stale = isStatusStale(baseCandidate);
  const record = resolveProductRecord(baseCandidate, options);
  const intentRecord = resolveIntentRecord(pageContext, sessionCandidate);
  const overlay = buildIntentOverlay(record, intentRecord, sessionCandidate, {
    rank: pageContext.rank ?? sessionCandidate.sessionRank ?? null,
    fitScore: pageContext.fitScore ?? sessionCandidate.scores?.overall ?? null,
  });
  const seo = buildSeoRenderData(record, "overlay", {
    stale,
    ogImage,
    metadataBaseUrl,
    metadataOptions,
  });

  const sessionHtml = renderSessionRecommendationPage(sessionCandidate, pageContext, {
    ...options,
    indexable: false,
  });

  let html = applySeoHeadToHtml(sessionHtml, seo).replace(
    '<body class="snatch-app domainPage candidate-detail-page">',
    '<body class="snatch-app domainPage candidate-detail-page candidate-detail-page--overlay">'
  );

  if (overlay.bannerHtml) {
    html = html.replace(
      /<section class="productHeroStage">\s*<div class="detailContent">/,
      `<section class="productHeroStage"><div class="detailContent">${overlay.bannerHtml}`
    );
  }

  return html;
}

module.exports = {
  buildScoreBackedEvidenceRows,
  buildHeroDecisionLine,
  buildHeroSubtitle,
  renderCompactScoreBreakdown,
  renderSummaryStrip,
  renderDecisionCard,
  buildTrustRowHtml,
  buildAlternativeRowHtml,
  buildAlternativeComparisonRowHtml,
  buildCandidateJsonLd,
  buildSchemaDescription,
  renderCandidatePageHtml,
  resolveConfidence,
  resolveIntentRecord,
  buildSyntheticIntentRecord,
  formatWithArticle,
  normalizeTaxonomyCategory,
  isWeakTokenMatch,
  buildTermEvidence,
  buildCalibratedRecommendation,
  buildTradeoffLabel,
  buildPageTitle,
  buildPageHeadingName,
  resolveIntentTitleLabel,
  hasDeskSignal,
  buildCanonicalPageTitle,
  buildCanonicalSchemaDescription,
  renderCanonicalDomainPage,
  renderIntentOverlayPage,
  renderSessionRecommendationPage,
};
