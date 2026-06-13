const BLOCKING_INVALID_FLAGS = new Set(["gibberish", "spam"]);

function resolveSeoTier(record) {
  return require("./seo-tier").resolveSeoTier(record);
}

function isIndexNowTier(record) {
  return require("./seo-tier").isIndexNowTier(record);
}

function resolveLifecycleState(record) {
  if (!record?.domain) return "invalid";
  if (record.invalid === true || record.gone === true) return "invalid";
  if ((record.qualityFlags || []).some((flag) => BLOCKING_INVALID_FLAGS.has(flag))) return "invalid";

  const explicit = record.lifecycleState;
  if (explicit === "sold" || record.status === "auction-sold") return "sold";
  if (explicit === "unavailable") return "unavailable";
  if (record.status === "auction-ended" || record.status === "archived") return "ended";
  if (record.status === "auction-active") return "active";
  if (explicit === "active") return "active";
  if (explicit === "ended") return "ended";
  return "unavailable";
}

function resolveProductPageMode(record, pageContext = {}) {
  if (pageContext.intentId) return "overlay";

  const lifecycle = resolveLifecycleState(record);
  if (lifecycle === "invalid") return "invalid";
  if (lifecycle === "unavailable") return "unavailable";
  if (lifecycle === "sold") return "sold";
  if (lifecycle === "ended") return "ended";
  if (isIndexNowTier(record)) return "active-indexed";
  return "active-noindex";
}

function normalizePageMode(pageMode) {
  if (pageMode === "canonical") return "active-indexed";
  if (pageMode === "product" || pageMode === "preview") return "active-noindex";
  if (pageMode === "archived") return "ended";
  return pageMode;
}

function isActiveLifecycle(record) {
  return resolveLifecycleState(record) === "active";
}

function isIndexableActiveRecord(record) {
  return isIndexNowTier(record);
}

function applyLifecycleState(record, existing = null) {
  const lifecycle = resolveLifecycleState(record);
  if (lifecycle === "active") {
    record.lifecycleState = "active";
    if (!record.seoTier) {
      const { SEO_TIER } = require("./seo-tier");
      record.seoTier = existing?.seoTier || (existing?.indexable === true ? SEO_TIER.INDEX_NOW : SEO_TIER.HOLD_NOINDEX);
    }
    return record;
  }
  if (existing?.lifecycleState === "sold" || existing?.lifecycleState === "unavailable") {
    record.lifecycleState = existing.lifecycleState;
    const { SEO_TIER } = require("./seo-tier");
    record.seoTier = SEO_TIER.ARCHIVE;
    record.indexable = false;
    return record;
  }
  record.lifecycleState = lifecycle;
  const { SEO_TIER } = require("./seo-tier");
  record.seoTier = SEO_TIER.ARCHIVE;
  record.indexable = false;
  return record;
}

function shouldReturnGone(record) {
  return Boolean(record?.gone === true);
}

module.exports = {
  resolveLifecycleState,
  resolveProductPageMode,
  normalizePageMode,
  isActiveLifecycle,
  isIndexableActiveRecord,
  applyLifecycleState,
  shouldReturnGone,
};
