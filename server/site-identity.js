// Single source of truth for the public site identity.
//
// Every page title, og:site_name, logo label, JSON-LD Organization/WebSite node,
// llms.txt heading and static HTML page reads the brand from here. Renaming the
// site is a one-line change to SITE_NAME.
const { DEFAULT_PUBLIC_BASE_URL } = require("./public-url");

const SITE_NAME = "Snatch.auction";
const SITE_URL = DEFAULT_PUBLIC_BASE_URL;
const SITE_DESCRIPTION =
  "Expired-domain auction finder and decision guides: search auctions by what you are building, check scores, and read how to bid.";
const LOGO_PATH = "/assets/snatch-logo.svg";

function orgId(baseUrl = SITE_URL) {
  return `${baseUrl}/#organization`;
}

function websiteId(baseUrl = SITE_URL) {
  return `${baseUrl}/#website`;
}

// NameSilo is the registrar whose public expired-domain auctions the listings
// come from. It is described only as the data source / marketplace.
function namesiloId(baseUrl = SITE_URL) {
  return `${baseUrl}/#provider-namesilo`;
}

function buildOrganizationNode(baseUrl = SITE_URL) {
  return {
    "@type": "Organization",
    "@id": orgId(baseUrl),
    name: SITE_NAME,
    url: `${baseUrl}/`,
    logo: {
      "@type": "ImageObject",
      "@id": `${baseUrl}/#logo`,
      url: `${baseUrl}${LOGO_PATH}`,
      contentUrl: `${baseUrl}${LOGO_PATH}`,
      caption: SITE_NAME,
    },
    image: { "@id": `${baseUrl}/#logo` },
  };
}

function buildWebSiteNode(baseUrl = SITE_URL) {
  return {
    "@type": "WebSite",
    "@id": websiteId(baseUrl),
    url: `${baseUrl}/`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": orgId(baseUrl) },
  };
}

function buildNameSiloNode(baseUrl = SITE_URL) {
  return {
    "@type": "Organization",
    "@id": namesiloId(baseUrl),
    name: "NameSilo",
    url: "https://www.namesilo.com",
    description: "Domain registrar that runs the expired-domain auctions listed on this site.",
    sameAs: [
      "https://www.wikidata.org/wiki/Q96394806",
      "https://en.wikipedia.org/wiki/NameSilo",
      "https://www.linkedin.com/company/namesilo",
      "https://x.com/namesilo",
    ],
  };
}

// Nodes every page's @graph starts with.
function buildSiteGraphNodes(baseUrl = SITE_URL, options = {}) {
  const nodes = [buildOrganizationNode(baseUrl), buildWebSiteNode(baseUrl)];
  if (options.includeNameSilo) nodes.push(buildNameSiloNode(baseUrl));
  return nodes;
}

function publisherRef(baseUrl = SITE_URL) {
  return { "@id": orgId(baseUrl) };
}

function pageTitle(title) {
  return `${title} | ${SITE_NAME}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Replaces {{SITE_NAME}} tokens in static HTML/text files.
function applySiteTokens(text) {
  return String(text).replace(/\{\{SITE_NAME\}\}/g, SITE_NAME);
}

module.exports = {
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  LOGO_PATH,
  orgId,
  websiteId,
  namesiloId,
  buildOrganizationNode,
  buildWebSiteNode,
  buildNameSiloNode,
  buildSiteGraphNodes,
  publisherRef,
  pageTitle,
  applySiteTokens,
  escapeHtml,
};
