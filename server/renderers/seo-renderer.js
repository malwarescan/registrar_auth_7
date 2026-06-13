const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { normalizePageMode } = require("../candidate-store/product-lifecycle");

const ROBOTS_SUFFIX = "max-image-preview:large,max-snippet:-1,max-video-preview:-1";

function resolveTld(record) {
  return record?.tld || ".com";
}

function buildSeoTitle(record, mode) {
  if (mode === "session") return null;
  const tld = resolveTld(record);
  return `${record.domain} — ${tld} Auction Domain | Snatch.auction`;
}

function buildSeoDescription(record, mode) {
  const tld = resolveTld(record);
  const normalized = normalizePageMode(mode);
  if (normalized === "sold") {
    return `${record.domain} is a ${tld} auction domain that has sold. Snatch retains the product record with final known auction status.`;
  }
  if (normalized === "ended" || normalized === "unavailable") {
    return `${record.domain} is a ${tld} auction domain listing that is no longer active on NameSilo. Review final status and comparable domains on Snatch.auction.`;
  }
  return `${record.domain} is a ${tld} auction domain available through NameSilo, with current bid data, auction timing, and Snatch domain quality signals.`;
}

function buildCanonicalUrl(record, mode, options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || "https://snatch.auction";
  return record.canonicalUrl || `${metadataBaseUrl}/domains/${record.slug}`;
}

function buildRobots(record, mode) {
  const normalized = normalizePageMode(mode);
  if (normalized === "active-indexed") return `index,follow,${ROBOTS_SUFFIX}`;
  if (normalized === "invalid") return `noindex,${ROBOTS_SUFFIX}`;
  return `noindex,follow,${ROBOTS_SUFFIX}`;
}

const SEO_GRAPH_TYPES = new Set(["Organization", "WebSite", "WebPage", "BreadcrumbList", "Product", "Offer"]);

function isInactiveSeoMode(mode) {
  const normalized = normalizePageMode(mode);
  return ["ended", "sold", "unavailable", "invalid", "archived"].includes(normalized);
}

function buildSeoJsonLd(record, mode, options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || "https://snatch.auction";
  const graphPayload = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graphPayload?.["@graph"]) {
    return { "@context": "https://schema.org", "@graph": [] };
  }

  const graph = graphPayload["@graph"].filter((node) => {
    if (!node?.["@type"]) return false;
    if (SEO_GRAPH_TYPES.has(node["@type"])) {
      if (node["@type"] === "Organization") {
        return String(node["@id"] || "").includes("/#organization");
      }
      return true;
    }
    return false;
  });

  if (options.ogImage) {
    const product = graph.find((node) => node["@type"] === "Product");
    if (product) product.image = [options.ogImage];
  }

  if (isInactiveSeoMode(mode)) {
    const productIndex = graph.findIndex((node) => node["@type"] === "Product");
    if (productIndex >= 0) delete graph[productIndex].offers;
    const offerIndex = graph.findIndex((node) => node["@type"] === "Offer");
    if (offerIndex >= 0) graph.splice(offerIndex, 1);
  }

  const webpage = graph.find((node) => node["@type"] === "WebPage");
  if (webpage) {
    webpage.description = buildSeoDescription(record, mode);
    webpage.name = `${record.domain} — ${resolveTld(record)} Auction Domain`;
    webpage.dateModified = record.statusVerifiedAt || undefined;
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function resolveSeoMode(pageMode, indexable = false) {
  const normalized = normalizePageMode(pageMode);
  if (normalized === "overlay") return "overlay";
  if (normalized === "active-indexed" || indexable) return "active-indexed";
  return normalized;
}

function buildSeoRenderData(record, pageMode, options = {}) {
  const mode = resolveSeoMode(pageMode, options.indexable);
  if (mode === "session" || !record) return null;

  const stale = options.stale || isInactiveSeoMode(mode);
  return {
    title: buildSeoTitle(record, mode),
    description: buildSeoDescription(record, mode),
    canonicalUrl: buildCanonicalUrl(record, mode, options),
    robots: buildRobots(record, mode),
    jsonLd: buildSeoJsonLd(record, mode, { ...options, stale }),
    twitterTitle: `${record.domain} | Snatch.auction`,
  };
}

module.exports = {
  buildSeoTitle,
  buildSeoDescription,
  buildCanonicalUrl,
  buildRobots,
  buildSeoJsonLd,
  buildSeoRenderData,
  resolveSeoMode,
};
