const {
  getCandidate,
  findCandidateBySlug,
  openAcquisitionPath,
} = require("../server/domain-fetch/candidate-service");
const {
  appendNameSiloTrackingParams,
  getIntent,
  logAcquisitionClick,
  resolveIntentApplicationCategory,
  resolveIntentBuyerType,
} = require("../server/domain-fetch/intent-session");

async function handleOutAcquire(req, res, requestUrl, { apiKey }) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const domain = String(requestUrl.searchParams.get("domain") || "").trim().toLowerCase();
  const intentId = String(requestUrl.searchParams.get("intent_id") || "").trim();
  const candidateId = String(requestUrl.searchParams.get("candidate_id") || "").trim();
  const source = String(requestUrl.searchParams.get("source") || "unknown").trim();
  const rankRaw = requestUrl.searchParams.get("rank");
  const fitRaw = requestUrl.searchParams.get("fit");
  const rank = rankRaw != null && rankRaw !== "" ? Number(rankRaw) : null;
  const fitScore = fitRaw != null && fitRaw !== "" ? Number(fitRaw) : null;

  let candidate = candidateId ? getCandidate(candidateId) : null;
  if (!candidate && domain) {
    candidate = findCandidateBySlug(domain.replace(/\./g, "-"));
  }
  if (!candidate) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Candidate not found");
    return;
  }

  let handoff;
  try {
    handoff = await openAcquisitionPath({
      candidateId: candidate.candidateId,
      apiKey,
    });
  } catch (error) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Acquisition handoff failed");
    return;
  }

  const intentRecord = getIntent(intentId);
  const slug = candidate.slug || candidate.domain.replace(/\./g, "-");
  const sourcePage = source === "domain-detail" ? `/domains/${slug}` : source;

  if (!handoff.actionUrl) {
    const fallback = `/domains/${slug}${intentId ? `?intent_id=${encodeURIComponent(intentId)}&refresh=required` : ""}`;
    res.writeHead(302, { Location: fallback });
    res.end();
    return;
  }

  const destinationUrl = appendNameSiloTrackingParams(handoff.actionUrl, {
    intentRecord,
    candidate,
    rank,
    fitScore,
  });

  logAcquisitionClick({
    domain: candidate.domain,
    intent_id: intentId || null,
    intent_slug: intentRecord?.intentSlug || requestUrl.searchParams.get("intent") || null,
    intent: intentRecord?.label || null,
    buyerType: intentRecord ? resolveIntentBuyerType(intentRecord) : null,
    category: intentRecord ? resolveIntentApplicationCategory(intentRecord, candidate) : null,
    rank: Number.isFinite(rank) ? rank : null,
    fit_score: Number.isFinite(fitScore) ? fitScore : null,
    source_page: sourcePage,
    destination: "namesilo_checkout",
    candidate_id: candidate.candidateId,
  });

  res.writeHead(302, { Location: destinationUrl });
  res.end();
}

module.exports = {
  handleOutAcquire,
};
