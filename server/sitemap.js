const { listPublishedIntents } = require("./published-catalog");
const { listSitemapCandidates } = require("./candidate-store/durable-candidates");
const { toAbsolutePublicUrl } = require("./public-url");
const { listGuideSlugs, getGuide, MODIFIED: GUIDES_MODIFIED } = require("./guides/guide-content");

// Loaded lazily: the hub renderer pulls in the store modules.
function listIndexableHubEntries() {
  return require("./renderers/auction-hubs").listIndexableHubEntries();
}

// Date each core page's content last changed (YYYY-MM-DD).
const CORE_PAGE_LASTMOD = {
  "/": "2026-11-05",
  "/experiments/intent-fetch/": "2026-11-05",
  "/methodology/": "2026-11-05",
  "/about/": "2026-11-05",
  "/data/": "2026-11-05",
  "/data/domain-listings": "2026-11-05",
  "/data/domain-feed": "2026-11-05",
  "/data/domain-graph": "2026-11-05",
  "/guides": GUIDES_MODIFIED,
};

const SITEMAP_INDEX_CHILDREN = [
  "/sitemap-core.xml",
  "/sitemap-intents.xml",
  "/sitemap-domains-indexed.xml",
];

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastmod(isoValue) {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function resolveDomainLastmod(record) {
  return formatLastmod(
    record?.statusVerifiedAt || record?.updatedAt || record?.publishedAt || record?.createdAt
  );
}

function getCoreSitemapPaths() {
  return [
    "/",
    "/experiments/intent-fetch/",
    "/methodology/",
    "/about/",
    "/data/",
    "/data/domain-listings",
    "/data/domain-feed",
    "/data/domain-graph",
    "/guides",
    ...listGuideSlugs().map((slug) => `/guides/${slug}`),
    // Auction hubs: /auctions always, sub-hubs only while they list enough
    // running auctions to be worth indexing.
    ...listIndexableHubEntries().map((entry) => entry.pathname),
  ];
}

function getIntentSitemapPaths() {
  return listPublishedIntents()
    .map((intent) => {
      const slug = String(intent.slug || intent.intentSlug || "").trim();
      return slug ? `/intents/${slug}` : null;
    })
    .filter(Boolean)
    .filter((pathname) => !pathname.includes("?"));
}

function getIndexedDomainSitemapPaths(options = {}) {
  return listSitemapCandidates(options)
    .map((record) => (record.slug ? `/domains/${record.slug}` : null))
    .filter(Boolean)
    .filter((pathname) => !pathname.includes("?"));
}

function buildStableSitemapPaths(options = {}) {
  return [...new Set([
    ...getCoreSitemapPaths(),
    ...getIntentSitemapPaths(),
    ...getIndexedDomainSitemapPaths(options),
  ])];
}

function buildUrlsetXml(entries) {
  const urls = entries
    .map(({ pathname, lastmod, changefreq, priority }) => {
      const loc = escapeXml(pathname);
      const lastmodTag = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      const changefreqTag = changefreq ? `<changefreq>${escapeXml(changefreq)}</changefreq>` : "";
      const priorityTag = priority ? `<priority>${escapeXml(priority)}</priority>` : "";
      return `<url><loc>${loc}</loc>${lastmodTag}${changefreqTag}${priorityTag}</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function buildSitemapIndexXml(entries) {
  const nodes = entries
    .map(({ pathname, lastmod }) => {
      const loc = escapeXml(pathname);
      const lastmodTag = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `<sitemap><loc>${loc}</loc>${lastmodTag}</sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${nodes}
</sitemapindex>`;
}

// Search Console reports an error for a child sitemap with no URLs, so the
// index only lists children that currently have entries.
function buildSitemapIndex(options = {}) {
  const now = formatLastmod(new Date().toISOString());
  const entries = SITEMAP_INDEX_CHILDREN
    .filter((pathname) => CHILD_ENTRY_BUILDERS[pathname](options).length > 0)
    .map((pathname) => ({
      pathname: toAbsolutePublicUrl(pathname, options),
      lastmod: now,
    }));
  return buildSitemapIndexXml(entries);
}

function guideLastmod(pathname) {
  const guide = getGuide(pathname.slice("/guides/".length));
  return (guide && guide.modified) || GUIDES_MODIFIED;
}

function buildCoreSitemapEntries(options = {}) {
  // Hub lastmod is when the auction data was fetched.
  const hubLastmod = new Map(listIndexableHubEntries().map((entry) => [entry.pathname, formatLastmod(entry.lastmod)]));
  return getCoreSitemapPaths().map((pathname) => ({
    pathname: toAbsolutePublicUrl(pathname, options),
    lastmod: hubLastmod.has(pathname)
      ? hubLastmod.get(pathname)
      : CORE_PAGE_LASTMOD[pathname] || (pathname.startsWith("/guides/") ? guideLastmod(pathname) : null),
    changefreq: hubLastmod.has(pathname) ? "daily" : "monthly",
  }));
}

function buildCoreSitemap(options = {}) {
  return buildUrlsetXml(buildCoreSitemapEntries(options));
}

function buildIntentSitemapEntries(options = {}) {
  return listPublishedIntents()
    .map((intent) => {
      const slug = String(intent.slug || intent.intentSlug || "").trim();
      if (!slug) return null;
      return {
        pathname: toAbsolutePublicUrl(`/intents/${slug}`, options),
        lastmod: formatLastmod(intent.publishedAt || intent.updatedAt || intent.fetchedAt),
        changefreq: "weekly",
        priority: "0.75",
      };
    })
    .filter(Boolean);
}

function buildIntentSitemap(options = {}) {
  return buildUrlsetXml(buildIntentSitemapEntries(options));
}

function buildIndexedDomainSitemapEntries(options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || toAbsolutePublicUrl("/", options).replace(/\/$/, "");
  return listSitemapCandidates({ metadataBaseUrl })
    .map((record) => {
      if (!record.slug) return null;
      const pathname = `/domains/${record.slug}`;
      if (pathname.includes("?") || String(record.canonicalUrl || "").includes("?")) return null;
      return {
        pathname: toAbsolutePublicUrl(pathname, options),
        lastmod: resolveDomainLastmod(record),
        changefreq: "weekly",
        priority: "0.7",
      };
    })
    .filter(Boolean);
}

function buildIndexedDomainSitemap(options = {}) {
  return buildUrlsetXml(buildIndexedDomainSitemapEntries(options));
}

const CHILD_ENTRY_BUILDERS = {
  "/sitemap-core.xml": buildCoreSitemapEntries,
  "/sitemap-intents.xml": buildIntentSitemapEntries,
  "/sitemap-domains-indexed.xml": buildIndexedDomainSitemapEntries,
};

function buildSitemapXml(options = {}) {
  return buildSitemapIndex(options);
}

function buildRobotsTxt(options = {}) {
  const sitemapUrl = toAbsolutePublicUrl("/sitemap.xml", options);
  return `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`;
}

function resolveSitemapResponse(pathname, options = {}) {
  switch (pathname) {
    case "/sitemap.xml":
      return buildSitemapIndex(options);
    case "/sitemap-core.xml":
      return buildCoreSitemap(options);
    case "/sitemap-intents.xml":
      return buildIntentSitemap(options);
    case "/sitemap-domains-indexed.xml":
      return buildIndexedDomainSitemap(options);
    default:
      return null;
  }
}

module.exports = {
  SITEMAP_INDEX_CHILDREN,
  getCoreSitemapPaths,
  getIntentSitemapPaths,
  getIndexedDomainSitemapPaths,
  buildStableSitemapPaths,
  buildSitemapIndex,
  buildCoreSitemap,
  buildIntentSitemap,
  buildIndexedDomainSitemap,
  buildSitemapXml,
  buildRobotsTxt,
  resolveSitemapResponse,
  resolveDomainLastmod,
  formatLastmod,
};
