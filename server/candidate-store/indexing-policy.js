// Which auction pages may be indexed.
//
// NameSilo's expired-domain auctions run for only a few days, so every page is
// short-lived. Following Google's and Bing's guidance on large sets of
// expiring URLs, only a small, high-quality set is indexable at any time; every
// other auction page is served noindex,follow, and a page drops out of the
// sitemap and turns noindex as soon as its auction ends. The lasting value of
// the site lives in the hub pages (/auctions) and the guides.
const { resolveLifecycleState } = require("./product-lifecycle");
const { BLOCKING_QUALITY_FLAGS, MIN_OVERALL_SCORE, SEO_TIER } = require("./seo-tier");
const { checkBrandSafety } = require("./brand-safety");

const MAX_INDEXED_AUCTIONS = 150;
const STRONG_SCORE = 70;
const MIN_PRONOUNCEABILITY = 70;
const INDEXABLE_TLDS = new Set([".com", ".net", ".org", ".co", ".io", ".ai", ".app", ".dev"]);
// Any of these means the name is hard to say, spell or trust.
const DISQUALIFYING_FLAGS = new Set([...BLOCKING_QUALITY_FLAGS, "hard-to-pronounce", "confusing-spelling", "repeated-characters", "gibberish"]);

function labelOf(record) {
  const domain = String(record?.domain || "");
  const tld = record?.tld || `.${domain.split(".").pop()}`;
  return domain.endsWith(tld) ? domain.slice(0, -tld.length) : domain.split(".")[0];
}

// Returns null when the record may be indexed, otherwise the reason it may not.
function indexRejection(record, now = Date.now()) {
  if (!record?.domain) return "missing domain";
  if (resolveLifecycleState(record, now) !== "active") return "auction not running";
  const safety = checkBrandSafety(record.domain);
  if (!safety.safe) return `brand safety: ${safety.category}`;
  const flag = (record.qualityFlags || []).find((value) => DISQUALIFYING_FLAGS.has(value));
  if (flag) return `quality flag: ${flag}`;
  if (!INDEXABLE_TLDS.has(record.tld)) return `extension ${record.tld} not in the indexable set`;
  const label = labelOf(record);
  if (!/^[a-z]{4,15}$/.test(label)) return "name must be 4-15 letters, no digits or hyphens";
  const words = record.baseSignals?.words || [];
  if (!words.length) return "name is not made of common words";
  const bids = Number(record.bidCount) || 0;
  if (words.length > 2 && bids < 1) return "three-word names need at least one bid";
  const scores = record.baseScores || {};
  if ((scores.pronounceability ?? 0) < MIN_PRONOUNCEABILITY) return "pronounceability too low";
  if ((scores.overall ?? 0) < MIN_OVERALL_SCORE) return "overall score too low";
  if (bids < 1 && (scores.overall ?? 0) < STRONG_SCORE) return "no bids and score below the strong threshold";
  return null;
}

// Higher is better: auctions with bids first, then score, then fewer and
// shorter words.
function indexRank(record) {
  const bids = Number(record.bidCount) || 0;
  const words = record.baseSignals?.words?.length || 3;
  return (bids > 0 ? 1000 + Math.min(bids, 100) * 5 : 0) + (record.baseScores?.overall ?? 0) * 2 - words * 3 - labelOf(record).length * 0.1;
}

// Picks the indexable set from a list of records: eligible ones, best first,
// capped at `max`.
function selectIndexedSlugs(records, options = {}) {
  const now = options.now ?? Date.now();
  const max = Number.isFinite(options.max) ? options.max : MAX_INDEXED_AUCTIONS;
  return new Set(
    records
      .filter((record) => record?.slug && indexRejection(record, now) === null)
      .sort((a, b) => indexRank(b) - indexRank(a) || a.slug.localeCompare(b.slug))
      .slice(0, max)
      .map((record) => record.slug)
  );
}

// Sets seoTier/indexable/published on every record in place.
function applyIndexingPolicy(records, options = {}) {
  const selected = selectIndexedSlugs(records, options);
  const publishedAt = options.publishedAt || new Date(options.now ?? Date.now()).toISOString();
  for (const record of records) {
    const indexed = selected.has(record.slug);
    record.seoTier = indexed ? SEO_TIER.INDEX_NOW : record.seoTier === SEO_TIER.ARCHIVE ? SEO_TIER.ARCHIVE : SEO_TIER.HOLD_NOINDEX;
    record.indexable = indexed;
    record.published = indexed;
    record.publishedAt = indexed ? record.publishedAt || publishedAt : null;
  }
  return selected;
}

module.exports = {
  MAX_INDEXED_AUCTIONS,
  STRONG_SCORE,
  MIN_PRONOUNCEABILITY,
  INDEXABLE_TLDS,
  indexRejection,
  indexRank,
  selectIndexedSlugs,
  applyIndexingPolicy,
};
