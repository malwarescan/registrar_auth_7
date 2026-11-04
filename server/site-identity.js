// Single source of truth for the public site identity.
//
// Every page title, og:site_name, logo label, JSON-LD Organization/WebSite node,
// llms.txt heading and static HTML page reads the brand from here. Renaming the
// site is a one-line change to SITE_NAME.
const { DEFAULT_PUBLIC_BASE_URL } = require("./public-url");

const SITE_NAME = "URL Snatcher";
// Who runs the site. Shown in the footer, on /about/ and as parentOrganization.
const OPERATOR_NAME = "NameSilo";
const OPERATOR_URL = "https://www.namesilo.com";
const OPERATOR_ID = "https://www.namesilo.com/#organization";
const SITE_URL = DEFAULT_PUBLIC_BASE_URL;
const SITE_DESCRIPTION =
  "Expired-domain auction finder and decision guides: search auctions by what you are building, check scores, and read how to bid.";
const LOGO_PATH = "/assets/site-logo.svg";

function orgId(baseUrl = SITE_URL) {
  return `${baseUrl}/#organization`;
}

function websiteId(baseUrl = SITE_URL) {
  return `${baseUrl}/#website`;
}

// NameSilo runs this site and the expired-domain auctions it lists. One node,
// one @id, used as parentOrganization, data source and Offer seller.
function namesiloId() {
  return OPERATOR_ID;
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
    parentOrganization: { "@id": OPERATOR_ID },
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

function buildNameSiloNode() {
  return {
    "@type": "Organization",
    "@id": OPERATOR_ID,
    name: OPERATOR_NAME,
    url: OPERATOR_URL,
    sameAs: ["https://en.wikipedia.org/wiki/NameSilo"],
  };
}

// Nodes every page's @graph starts with. NameSilo is always present because
// the site Organization references it as parentOrganization.
function buildSiteGraphNodes(baseUrl = SITE_URL) {
  return [buildOrganizationNode(baseUrl), buildWebSiteNode(baseUrl), buildNameSiloNode()];
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
  OPERATOR_NAME,
  OPERATOR_URL,
  OPERATOR_ID,
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
