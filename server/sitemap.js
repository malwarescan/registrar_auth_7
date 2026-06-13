const { listPublishedIntents } = require("./published-catalog");
const { listSitemapCandidates } = require("./candidate-store/durable-candidates");
const { toAbsolutePublicUrl } = require("./public-url");

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
  return ["/", "/experiments/intent-fetch/", "/methodology/"];
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

function buildSitemapIndex(options = {}) {
  const now = formatLastmod(new Date().toISOString());
  const entries = SITEMAP_INDEX_CHILDREN.map((pathname) => ({
    pathname: toAbsolutePublicUrl(pathname, options),
    lastmod: now,
  }));
  return buildSitemapIndexXml(entries);
}

function buildCoreSitemap(options = {}) {
  const entries = getCoreSitemapPaths().map((pathname) => ({
    pathname: toAbsolutePublicUrl(pathname, options),
    changefreq: "monthly",
    priority: pathname === "/" ? "0.8" : "0.8",
  }));
  return buildUrlsetXml(entries);
}

function buildIntentSitemap(options = {}) {
  const entries = listPublishedIntents()
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
  return buildUrlsetXml(entries);
}

function buildIndexedDomainSitemap(options = {}) {
  const metadataBaseUrl = options.metadataBaseUrl || toAbsolutePublicUrl("/", options).replace(/\/$/, "");
  const entries = listSitemapCandidates({ metadataBaseUrl })
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
  return buildUrlsetXml(entries);
}

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
