const {
  getDurableCandidateBySlug,
  productRecordToCandidate,
  normalizeSlug,
} = require("./durable-candidates");
const {
  resolveProductPageMode,
  shouldReturnGone,
} = require("./product-lifecycle");
const { validateSitemapEligibility } = require("./sitemap-freshness");

// Robots and sitemap come from the same rule: a page is indexable only when
// the record would also be listed in the domain sitemap.
function resolveIndexedMode(record, mode, options = {}) {
  if (mode !== "active-indexed") return mode;
  const rejection = validateSitemapEligibility(record, options.now ?? Date.now(), {
    metadataBaseUrl: options.metadataBaseUrl,
  });
  return rejection ? "active-noindex" : mode;
}

function resolveDomainPage(slug, pageContext = {}, findSessionCandidateBySlug, options = {}) {
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

    const mode = resolveIndexedMode(durable, resolveProductPageMode(durable, pageContext), options);
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
  resolveIndexedMode,
  resolveDomainPage,
};
