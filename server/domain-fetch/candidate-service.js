const crypto = require("crypto");
const { interpretBrief, buildStrategy } = require("./interpret-brief");
const { fetchNameSiloAuctions } = require("./fetch-namesilo-auctions");
const { checkRegisterAvailability } = require("./check-namesilo-availability");
const { generateCandidatesForPass } = require("./generate-candidates");
const { evaluateQuality } = require("./evaluate-quality");
const { scoreCandidate, isEligibleCandidate } = require("./score-candidate");
const { normalizeAuctionCandidate } = require("./normalize-auction");
const { normalizeRegistrationCandidate } = require("./normalize-registration");
const { buildExplanation, buildTradeoffs } = require("./build-explanation");
const { compareDomainCandidates } = require("./compare-candidates");
const { applyRefinement } = require("./refine-candidates");
const {
  buildCandidateMatchedIntents,
  createIntentRecord,
  attachIntentSessionResults,
} = require("./intent-session");
const { logDemandSignalFromFetch } = require("../demand-signals");

const workspaces = new Map();
const candidatesById = new Map();
const shortlistBySession = new Map();
const watchlistBySession = new Map();
// Session-only inventory from the latest Intent Fetch runs. Not SEO/public catalog.
let sessionCandidates = [];
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://snatch.auction";

function toPublicSourceLabel(source) {
  if (source === "namesilo-auction") return "Live NameSilo Auction";
  if (source === "namesilo-available") return "Custom generated · Available at NameSilo";
  if (source === "namesilo-premium") return "NameSilo Premium Listing";
  return "Domain Candidate";
}

function toPublicNamingLane(lane) {
  const map = {
    "clear-category-compounds": "Clear category compound",
    "local-brandables": "Local brandable",
    "action-convenience": "Action and convenience",
    "premium-concise": "Premium concise compound",
    "invented-pronounceable": "Invented pronounceable",
    "exact-local-intent": "Exact local-intent",
  };
  return map[lane] || "Category-aligned lane";
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function extractDomainRoot(domain) {
  return String(domain || "")
    .toLowerCase()
    .replace(/\.[a-z0-9-]+$/, "");
}

function hasMeaningfulMatch(root, token) {
  const normalizedToken = String(token || "").toLowerCase().trim();
  if (!normalizedToken) return false;
  if (root === normalizedToken) return true;

  // Prevent accidental short-token substring hits ("ai" in "savingjaiden").
  if (normalizedToken.length <= 2) {
    return (
      root.startsWith(normalizedToken) ||
      root.endsWith(normalizedToken) ||
      root.includes(`-${normalizedToken}`) ||
      root.includes(`${normalizedToken}-`)
    );
  }

  return (
    root.startsWith(normalizedToken) ||
    root.endsWith(normalizedToken) ||
    root.includes(`-${normalizedToken}`) ||
    root.includes(`${normalizedToken}-`)
  );
}

function findMatchedTerms(domain, intentModel) {
  const root = extractDomainRoot(domain);
  const required = intentModel.requiredConcepts.filter((term) => hasMeaningfulMatch(root, term));
  const adjacent = intentModel.adjacentConcepts.filter((term) => hasMeaningfulMatch(root, term));
  return [...new Set([...required, ...adjacent])];
}

function enrichCandidate(candidate, intentModel, matchedTerms) {
  candidate.matchedTerms = matchedTerms;
  candidate.matchedConceptGroups = matchedTerms.map((term) =>
    intentModel.requiredConcepts.includes(term) ? "required-concept" : "adjacent-concept"
  );
  candidate.whySurfaced = buildExplanation({
    intentModel,
    matchedTerms,
    source: candidate.source,
    generationLane: candidate.generationLane,
  });
  candidate.tradeoffs = buildTradeoffs(candidate);
  candidate.slug = candidate.domain.replace(/\./g, "-");
  candidate.canonicalUrl = `${PUBLIC_BASE_URL}/domains/${candidate.slug}`;
  candidate.publicSourceLabel = toPublicSourceLabel(candidate.source);
  candidate.namingLaneLabel = toPublicNamingLane(candidate.namingLane);
  if (candidate.acquisitionPath?.type === "auction") {
    candidate.currentBid = candidate.acquisitionPath.currentBid;
    candidate.bidCount = candidate.acquisitionPath.bidCount;
  }
  if (candidate.acquisitionPath?.type === "register") {
    candidate.registrationPrice = candidate.acquisitionPath.registrationPrice;
    candidate.renewalPrice = candidate.acquisitionPath.renewalPrice;
  }
  return candidate;
}

function setAlternatives(candidates) {
  candidates.forEach((candidate, index) => {
    candidate.sessionRank = index + 1;
  });
  const compact = candidates.map((c) => ({
    candidateId: c.candidateId,
    domain: c.domain,
    url: `/domains/${c.domain.replace(/\./g, "-")}`,
    status: c.status,
    rank: c.sessionRank,
    fitScore: c.scores?.overall || 0,
    scores: c.scores,
    registrationPrice: c.registrationPrice ?? c.acquisitionPath?.registrationPrice,
    currentBid: c.currentBid ?? c.acquisitionPath?.currentBid,
    matchReason:
      c.namingLaneLabel || c.namingLane || "Semantically related alternative",
  }));
  candidates.forEach((candidate) => {
    candidate.alternatives = compact
      .filter((item) => item.candidateId !== candidate.candidateId)
      .slice(0, 5);
    candidate.relatedCandidates = candidate.alternatives;
  });
}

async function fetchDomainCandidates({ brief, constraints = {}, limit = 10, fetchFn = fetch, apiKey }) {
  const requestId = createId("fetch");
  const fetchedAt = new Date().toISOString();
  const interpretedIntent = interpretBrief(brief, constraints);
  const strategy = buildStrategy(brief, interpretedIntent);
  const sourceSummary = {
    auctionRecordsScanned: 0,
    qualifiedAuctions: 0,
    generatedNames: 0,
    availabilityChecked: 0,
    availableDomains: 0,
    qualifiedAvailable: 0,
    generationPasses: 0,
    errors: [],
  };
  const diagnostics = {
    generatedDomains: [],
    syntaxRejections: [],
    qualityRejections: [],
    unavailableDomains: [],
  };

  let auctionCandidates = [];
  try {
    const auctions =
      constraints.includeAuctions === false
        ? []
        : await fetchNameSiloAuctions({
            apiKey,
            fetchFn,
            pageSize: Number(constraints.auctionPageSize) || 300,
          });
    sourceSummary.auctionRecordsScanned = auctions.length;
    auctionCandidates = auctions.map((auction) => {
      const quality = evaluateQuality(auction.root);
      const matchedTerms = findMatchedTerms(auction.domain, interpretedIntent);
      const requiredHits = matchedTerms.filter((t) => interpretedIntent.requiredConcepts.includes(t));
      const adjacentHits = matchedTerms.filter((t) => interpretedIntent.adjacentConcepts.includes(t));
      const scores = scoreCandidate({
        root: auction.root,
        tld: auction.tld,
        requiredHits,
        adjacentHits,
        quality,
        acquisitionSignal: auction.currentBid && auction.currentBid < 250 ? 82 : 68,
        acquisitionFriction: auction.currentBid && auction.currentBid > 500 ? 50 : 74,
      });
      const candidate = normalizeAuctionCandidate({
        auction,
        intentModel: interpretedIntent,
        scores,
        qualityFlags: quality.qualityFlags,
        whySurfaced: "",
        eligible: false,
        matchedTerms,
      });
      candidate.eligibleDecisionCandidate = isEligibleCandidate(candidate);
      if (!candidate.eligibleDecisionCandidate) candidate.scores.overall = 0;
      return enrichCandidate(candidate, interpretedIntent, matchedTerms);
    });
  } catch (error) {
    sourceSummary.errors.push({ source: "auctions", message: error instanceof Error ? error.message : "Auction fetch failed." });
  }

  const qualifiedAuctions = auctionCandidates.filter((candidate) => candidate.eligibleDecisionCandidate).sort((a, b) => b.scores.overall - a.scores.overall);
  sourceSummary.qualifiedAuctions = qualifiedAuctions.length;

  const registrationCandidates = [];
  const qualifiedRegistration = [];
  const seenDomains = new Set();

  if (qualifiedAuctions.length < 3) {
    for (let pass = 1; pass <= 3; pass += 1) {
      sourceSummary.generationPasses = pass;
      const generated = generateCandidatesForPass({
        intentModel: interpretedIntent,
        constraints,
        pass,
        seenDomains,
      });
      diagnostics.generatedDomains.push(...generated.generated);
      diagnostics.syntaxRejections.push(...generated.syntaxRejected);
      sourceSummary.generatedNames += generated.generated.length;
      if (!generated.generated.length) continue;

      try {
        const availability = await checkRegisterAvailability({
          apiKey,
          domains: generated.generated.map((item) => item.domain),
          fetchFn,
        });
        sourceSummary.availabilityChecked += availability.checked;
        sourceSummary.availableDomains += availability.availableDomains.length;
        const availableSet = new Set(availability.availableDomains);

        for (const item of generated.generated) {
          if (!availableSet.has(item.domain)) {
            diagnostics.unavailableDomains.push({ ...item, availabilityChecked: true, available: false });
            continue;
          }
          const quality = evaluateQuality(item.root);
          const matchedTerms = findMatchedTerms(item.domain, interpretedIntent);
          const requiredHits = matchedTerms.filter((t) => interpretedIntent.requiredConcepts.includes(t));
          const adjacentHits = matchedTerms.filter((t) => interpretedIntent.adjacentConcepts.includes(t));
          const scores = scoreCandidate({
            root: item.root,
            tld: item.tld,
            requiredHits,
            adjacentHits,
            quality,
            acquisitionSignal: 92,
            acquisitionFriction: 90,
          });
          const candidate = normalizeRegistrationCandidate({
            generated: item,
            intentModel: interpretedIntent,
            scores,
            qualityFlags: quality.qualityFlags,
            whySurfaced: "",
            eligible: false,
            matchedTerms,
            pricing: availability.availabilityByDomain?.get(item.domain) || {},
          });
          candidate.eligibleDecisionCandidate = isEligibleCandidate(candidate);
          if (!candidate.eligibleDecisionCandidate) {
            candidate.scores.overall = 0;
            diagnostics.qualityRejections.push({
              domain: item.domain,
              generationPass: pass,
              generationLane: item.generationLane,
              qualityFlags: quality.qualityFlags,
            });
          } else {
            qualifiedRegistration.push(candidate);
          }
          registrationCandidates.push(enrichCandidate(candidate, interpretedIntent, matchedTerms));
        }
      } catch (error) {
        sourceSummary.errors.push({
          source: "availability",
          message: error instanceof Error ? error.message : "Availability check failed.",
        });
      }

      if (qualifiedRegistration.length >= 5) break;
    }
  }

  sourceSummary.qualifiedAvailable = qualifiedRegistration.length;

  const decisionCandidates = [...qualifiedAuctions.slice(0, 3), ...qualifiedRegistration.slice(0, 7)]
    .sort((a, b) => b.scores.overall - a.scores.overall)
    .slice(0, Math.max(1, Number(limit) || 10));

  setAlternatives(decisionCandidates);
  const intentRecord = createIntentRecord({
    brief,
    interpretedIntent,
    strategy,
    fetchedAt,
    requestId,
  });
  attachIntentSessionResults(intentRecord, {
    candidateCount: decisionCandidates.length,
    decisionCandidates,
  });
  decisionCandidates.forEach((candidate) => {
    candidate.matchedIntents = buildCandidateMatchedIntents(candidate, intentRecord);
    candidate.intentId = intentRecord.intentId;
    candidate.intentLabel = intentRecord.label;
    candidatesById.set(candidate.candidateId, candidate);
  });
  sessionCandidates = decisionCandidates.slice(0, 50);

  auctionCandidates
    .filter((candidate) => candidate.source === "namesilo-auction" && candidate.acquisitionPath?.actionUrl)
    .forEach((candidate) => {
      try {
        const { upsertDurableCandidate } = require("../candidate-store/durable-candidates");
        upsertDurableCandidate(candidate);
      } catch {
        // Durable persistence should not block intent fetch.
      }
    });

  logDemandSignalFromFetch({
    intentRecord,
    decisionCandidates,
    fetchedAt,
    sessionId: requestId,
  });

  const workspace = {
    requestId,
    intentId: intentRecord.intentId,
    intentSlug: intentRecord.intentSlug,
    intentCategory: intentRecord.intentCategory,
    buyerProfile: intentRecord.buyerProfile,
    brief,
    constraints,
    fetchedAt,
    interpretedIntent,
    strategy,
    auctionCandidates,
    registrationCandidates,
    decisionCandidates,
    sourceSummary,
    diagnostics,
  };
  workspaces.set(requestId, workspace);

  return {
    requestId,
    intent_id: intentRecord.intentId,
    intent_slug: intentRecord.intentSlug,
    intent_category: intentRecord.intentCategory,
    buyer_profile: intentRecord.buyerProfile,
    brief,
    fetchedAt,
    interpretedIntent,
    strategy,
    sourceSummary,
    candidateCount: decisionCandidates.length,
    candidates: decisionCandidates,
    auctionCandidates,
    registrationCandidates,
    decisionCandidates,
    diagnostics,
  };
}

function getWorkspace(requestId) {
  return workspaces.get(String(requestId || ""));
}

function getCandidate(candidateId) {
  return candidatesById.get(String(candidateId || ""));
}

function isStatusStale(candidate, now = Date.now()) {
  const expiresAt = candidate?.statusExpiresAt ? new Date(candidate.statusExpiresAt).getTime() : 0;
  return !expiresAt || Number.isNaN(expiresAt) || now > expiresAt;
}

async function refreshCandidateStatus({ candidateId, apiKey, fetchFn = fetch }) {
  const candidate = getCandidate(candidateId);
  if (!candidate) throw new Error("candidate not found");

  const nowIso = new Date().toISOString();
  if (candidate.source === "namesilo-available") {
    const result = await checkRegisterAvailability({
      apiKey,
      domains: [candidate.domain],
      fetchFn,
    });
    const isAvailable = result.availableDomains.includes(candidate.domain);
    candidate.status = isAvailable ? "available" : "pending-verification";
    candidate.statusVerifiedAt = nowIso;
    candidate.statusExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    candidate.acquisitionPath = {
      ...candidate.acquisitionPath,
      type: "register",
      requiresConfirmation: true,
      actionUrl: isAvailable ? candidate.acquisitionPath?.actionUrl : null,
    };
  } else if (candidate.source === "namesilo-auction") {
    const auctions = await fetchNameSiloAuctions({ apiKey, fetchFn, pageSize: 200 });
    const hit = auctions.find((entry) => entry.domain === candidate.domain);
    if (hit) {
      candidate.status = "auction-active";
      candidate.statusVerifiedAt = nowIso;
      candidate.statusExpiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      candidate.acquisitionPath = {
        ...candidate.acquisitionPath,
        currentBid: hit.currentBid,
        bidCount: hit.bidCount,
        auctionEndsAt: hit.auctionEndsAt,
        auctionEndsIn: hit.auctionEndsIn,
        actionUrl: hit.auctionUrl,
      };
    } else {
      candidate.status = "pending-verification";
      candidate.statusVerifiedAt = nowIso;
      candidate.statusExpiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    }
  } else {
    candidate.status = "pending-verification";
    candidate.statusVerifiedAt = nowIso;
    candidate.statusExpiresAt = new Date(Date.now() + 60 * 1000).toISOString();
  }

  candidatesById.set(candidate.candidateId, candidate);
  return candidate;
}

function compareCandidates({ candidateIds = [], priority = "best-overall" }) {
  const selected = candidateIds.map((id) => getCandidate(id)).filter(Boolean);
  return compareDomainCandidates(selected, priority);
}

async function refineCandidates({ requestId, constraints = {}, limit = 10, fetchFn = fetch, apiKey }) {
  const workspace = getWorkspace(requestId);
  if (!workspace) throw new Error("requestId not found");

  const mergedConstraints = {
    ...(workspace.constraints || {}),
    ...constraints,
    preferredTlds: Array.isArray(constraints.onlyTlds) && constraints.onlyTlds.length ? constraints.onlyTlds : workspace.constraints?.preferredTlds,
    avoidHyphens: constraints.excludeHyphens ?? workspace.constraints?.avoidHyphens,
    shortNames: constraints.shorterNames ?? workspace.constraints?.shortNames,
  };

  const refreshed = await fetchDomainCandidates({
    brief: workspace.brief,
    constraints: mergedConstraints,
    limit,
    fetchFn,
    apiKey,
  });

  const refined = applyRefinement(refreshed.candidates, constraints);
  return {
    ...refreshed,
    candidates: refined,
    candidateCount: refined.length,
  };
}

function addShortlist({ sessionId = "anonymous", candidateId }) {
  const candidate = getCandidate(candidateId);
  if (!candidate) throw new Error("candidate not found");
  const set = shortlistBySession.get(sessionId) || new Set();
  set.add(candidateId);
  shortlistBySession.set(sessionId, set);
  return {
    sessionId,
    candidateId,
    shortlistCount: set.size,
    status: "shortlisted",
  };
}

function addWatchAuction({ sessionId = "anonymous", candidateId }) {
  const candidate = getCandidate(candidateId);
  if (!candidate) throw new Error("candidate not found");
  if (candidate.source !== "namesilo-auction") throw new Error("candidate is not an auction");
  const set = watchlistBySession.get(sessionId) || new Set();
  set.add(candidateId);
  watchlistBySession.set(sessionId, set);
  return {
    sessionId,
    candidateId,
    watchCount: set.size,
    status: "watching",
    auction: {
      currentBid: candidate.acquisitionPath?.currentBid,
      bidCount: candidate.acquisitionPath?.bidCount,
      auctionEndsAt: candidate.acquisitionPath?.auctionEndsAt,
    },
  };
}

async function openAcquisitionPath({ candidateId, apiKey, fetchFn = fetch }) {
  let candidate = getCandidate(candidateId);
  if (!candidate) throw new Error("candidate not found");
  candidate = await refreshCandidateStatus({ candidateId, apiKey, fetchFn });
  const isActionable = candidate.status === "available" || candidate.status === "auction-active" || candidate.status === "buy-now" || candidate.status === "make-offer";
  return {
    candidateId,
    action:
      candidate.acquisitionPath?.type === "register"
        ? "open-registration"
        : candidate.acquisitionPath?.type === "auction"
        ? "open-auction"
        : candidate.acquisitionPath?.type === "make-offer"
        ? "open-offer-path"
        : "verify",
    actionUrl: isActionable ? candidate.acquisitionPath?.actionUrl : null,
    status: candidate.status,
    currentBid: candidate.acquisitionPath?.currentBid,
    registrationPrice: candidate.acquisitionPath?.registrationPrice,
    renewalPrice: candidate.acquisitionPath?.renewalPrice,
    priceType: candidate.acquisitionPath?.priceType,
    requiresUserConfirmation: true,
    statusVerifiedAt: candidate.statusVerifiedAt,
  };
}

function listSessionCandidates() {
  return sessionCandidates;
}

/** @deprecated Session inventory — not durable SEO catalog. Use listPublishedCandidates(). */
function listPublicCandidates() {
  return listSessionCandidates();
}

function findSessionCandidateBySlug(slug) {
  const normalized = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!normalized) return null;

  for (const candidate of candidatesById.values()) {
    if (candidate.domain.replace(/\./g, "-") === normalized) return candidate;
  }

  return sessionCandidates.find((candidate) => candidate.domain.replace(/\./g, "-") === normalized) || null;
}

function findCandidateBySlug(slug) {
  return findSessionCandidateBySlug(slug);
}

module.exports = {
  fetchDomainCandidates,
  getWorkspace,
  getCandidate,
  compareCandidates,
  refineCandidates,
  addShortlist,
  addWatchAuction,
  refreshCandidateStatus,
  openAcquisitionPath,
  listSessionCandidates,
  listPublicCandidates,
  findSessionCandidateBySlug,
  findCandidateBySlug,
  isStatusStale,
};
