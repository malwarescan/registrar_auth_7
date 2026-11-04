// Shared header, footer, head tags and document shell for server-rendered pages.
const { renderSnatchLogoAnchor } = require("../snatch-logo-markup");
const {
  SITE_NAME,
  buildSiteGraphNodes,
  escapeHtml,
} = require("../site-identity");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

const SITE_NAV = [
  { href: "/", label: "Home" },
  { href: "/experiments/intent-fetch/", label: "Domain finder" },
  { href: "/guides", label: "Guides" },
  { href: "/methodology/", label: "Methodology" },
  { href: "/data/", label: "Data" },
];

const SITE_CHROME_STYLES = `
      .site-header.site-chrome { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; height: auto; min-height: 0; width: auto; max-width: 960px; margin: 0 auto; padding: 16px 20px; box-sizing: border-box; }
      .site-chrome .site-logo { color: #07101f; width: 120px; max-width: 120px; }
      .site-chrome .site-logo .snatchLogoMark { width: 100%; height: auto; display: block; }
      .site-nav ul { display: flex; flex-wrap: wrap; gap: 6px 18px; list-style: none; margin: 0; padding: 0; font: 600 14px/1.4 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .site-nav a { color: #374151; text-decoration: none; }
      .site-nav a:hover, .site-nav a[aria-current="page"] { color: #0044ff; }
      .site-footer { max-width: 960px; margin: 0 auto; padding: 20px 20px 40px; border-top: 1px solid #e5e7eb; font: 13px/1.6 Inter, -apple-system, sans-serif; color: #6b7280; }
      .site-footer a { color: inherit; }`;

function isCurrent(href, currentPath) {
  if (!currentPath) return false;
  const norm = (value) => String(value).replace(/\/+$/, "") || "/";
  return norm(href) === norm(currentPath);
}

function renderSiteNav(currentPath) {
  const items = SITE_NAV.map((item) =>
    `<li><a href="${escapeHtml(item.href)}"${isCurrent(item.href, currentPath) ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a></li>`
  ).join("");
  return `<nav class="site-nav" aria-label="Site"><ul>${items}</ul></nav>`;
}

function renderSiteHeader(currentPath = null) {
  return `<header class="site-header site-chrome">${renderSnatchLogoAnchor("/")}${renderSiteNav(currentPath)}</header>`;
}

function renderSiteFooter() {
  const links = SITE_NAV.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join(" · ");
  return `<footer class="site-footer"><p>${links}</p><p>${escapeHtml(SITE_NAME)}. Auction listings come from public NameSilo expired-domain auctions. Scores are directional signals, not guarantees.</p></footer>`;
}

function jsonLdScript(payload) {
  return `<script type="application/ld+json">${JSON.stringify(payload).replace(/<\/script/gi, "<\\/script")}</script>`;
}

// Wraps page-specific nodes in one @graph that always carries the site
// Organization and WebSite entities.
function buildPageGraph(baseUrl, nodes = [], options = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [...buildSiteGraphNodes(baseUrl, options), ...nodes],
  };
}

function renderSiteHeadTags(baseUrl = DEFAULT_PUBLIC_BASE_URL, options = {}) {
  const tags = [`<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`];
  if (options.includeGraph !== false) {
    tags.push(jsonLdScript(buildPageGraph(baseUrl, options.nodes || [], options)));
  }
  return tags.join("\n    ");
}

function renderPageDocument({
  title,
  description,
  canonical,
  robots = "index,follow",
  ogType = "website",
  baseUrl = DEFAULT_PUBLIC_BASE_URL,
  nodes = [],
  graphOptions = {},
  extraHead = "",
  styles = "",
  body,
  currentPath = null,
  bodyClass = "snatch-app",
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(`${baseUrl}/assets/domain-og-default.png`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${renderSiteHeadTags(baseUrl, { nodes, ...graphOptions })}
    <link rel="stylesheet" href="/assets/app.css?v=dev7" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
    ${extraHead}
    <style>
      body { background: #f8f7f4; color: #111827; margin: 0; }
      ${SITE_CHROME_STYLES}
      ${styles}
    </style>
  </head>
  <body class="${escapeHtml(bodyClass)}">
    ${renderSiteHeader(currentPath)}
${body}
    ${renderSiteFooter()}
  </body>
</html>`;
}

module.exports = {
  SITE_NAV,
  SITE_CHROME_STYLES,
  renderSiteNav,
  renderSiteHeader,
  renderSiteFooter,
  renderSiteHeadTags,
  buildPageGraph,
  jsonLdScript,
  renderPageDocument,
};
