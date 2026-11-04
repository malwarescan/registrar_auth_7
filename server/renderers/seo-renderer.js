const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { normalizePageMode } = require("../candidate-store/product-lifecycle");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { SITE_NAME, OPERATOR_ID } = require("../site-identity");

const ROBOTS_SUFFIX = "max-image-preview:large,max-snippet:-1,max-video-preview:-1";

function resolveTld(record) {
  return record?.tld || ".com";
}

function formatEndDate(isoValue) {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function buildSeoTitle(record, mode) {
  if (mode === "session") return null;
  const tld = resolveTld(record);
  if (["ended", "archived"].includes(normalizePageMode(mode))) return `${record.domain} — Ended ${tld} Auction | ${SITE_NAME}`;
  return `${record.domain} — ${tld} Auction Domain | ${SITE_NAME}`;
}

function buildSeoDescription(record, mode) {
  const tld = resolveTld(record);
  const normalized = normalizePageMode(mode);
  if (normalized === "sold") {
    return `${record.domain} is a ${tld} auction domain that has sold. ${SITE_NAME} keeps the record with the final known auction status.`;
  }
  if (normalized === "ended" || normalized === "unavailable") {
    const ended = formatEndDate(record.auctionEndsAt ?? record.acquisitionPath?.auctionEndsAt);
    return `The NameSilo auction for ${record.domain} ended${ended ? ` on ${ended}` : ""}. ${SITE_NAME} keeps the last recorded bid, end date and name-quality scores for reference.`;
  }
  return `${record.domain} is a ${tld} auction domain available through NameSilo, with the recorded bid, end time and ${SITE_NAME} name-quality scores.`;
}

function buildCanonicalUrl(record, mode, options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
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
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const graphPayload = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graphPayload?.["@graph"]) {
    return { "@context": "https://schema.org", "@graph": [] };
  }

  const graph = graphPayload["@graph"].filter((node) => {
    if (!node?.["@type"]) return false;
    if (SEO_GRAPH_TYPES.has(node["@type"])) {
      if (node["@type"] === "Organization") {
        // Keep the site Organization and the NameSilo node the Offer.seller references.
        const id = String(node["@id"] || "");
        return id.includes("/#organization") || id === OPERATOR_ID;
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
    twitterTitle: `${record.domain} | ${SITE_NAME}`,
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
