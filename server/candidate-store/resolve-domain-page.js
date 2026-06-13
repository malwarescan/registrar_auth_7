const {
  getDurableCandidateBySlug,
  productRecordToCandidate,
  normalizeSlug,
} = require("./durable-candidates");
const {
  resolveProductPageMode,
  shouldReturnGone,
} = require("./product-lifecycle");

function resolveDomainPage(slug, pageContext = {}, findSessionCandidateBySlug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  const durable = getDurableCandidateBySlug(normalized);
  const session = typeof findSessionCandidateBySlug === "function" ? findSessionCandidateBySlug(normalized) : null;
  const hasIntentOverlay = Boolean(pageContext.intentId);

  if (durable) {
    const baseCandidate = productRecordToCandidate(durable);

    if (hasIntentOverlay) {
      return {
        mode: "overlay",
        candidate: baseCandidate,
        record: durable,
        sessionCandidate: session || baseCandidate,
        indexable: false,
        canonicalSlug: normalized,
        httpStatus: 200,
      };
    }

    const mode = resolveProductPageMode(durable, pageContext);
    return {
      mode,
      candidate: baseCandidate,
      record: durable,
      indexable: mode === "active-indexed",
      httpStatus: shouldReturnGone(durable) ? 410 : 200,
    };
  }

  if (session) {
    return {
      mode: "session",
      candidate: session,
      indexable: false,
      httpStatus: 200,
    };
  }

  return null;
}

module.exports = {
  resolveDomainPage,
};
