// Non-canonical URL variants: 301 to the one canonical form, or 410 for
// prototype pages that have been removed.
const { listGuideSlugs } = require("./guides/guide-content");

const REDIRECTS = {
  "/index.html": "/",
  "/guides/": "/guides",
  "/guides/index.html": "/guides",
  "/methodology": "/methodology/",
  "/methodology/index.html": "/methodology/",
  "/about": "/about/",
  "/data": "/data/",
  "/experiments": "/experiments/intent-fetch/",
  "/experiments/": "/experiments/intent-fetch/",
  "/experiments/index.html": "/experiments/intent-fetch/",
  "/experiments/intent-fetch": "/experiments/intent-fetch/",
  "/experiments/intent-fetch/index.html": "/experiments/intent-fetch/",
  "/data/domain-listings/": "/data/domain-listings",
  "/auctions/": "/auctions",
  "/auctions/index.html": "/auctions",
  // The old /domains list (a noindex stub) is replaced by the auction hub.
  "/domains": "/auctions",
  "/domains/": "/auctions",
  "/data/domain-feed/": "/data/domain-feed",
  "/data/domain-graph/": "/data/domain-graph",
};

const GONE = new Set([
  "/naming-strategy.html",
  "/extension-hierarchy.html",
  "/naming-constraints.html",
  "/experiments/explain-domain",
  "/experiments/explain-domain/",
  "/experiments/explain-domain/index.html",
  "/experiments/auction-radar",
  "/experiments/auction-radar/",
  "/experiments/auction-radar/index.html",
]);

function resolveUrlVariant(rawPathname) {
  const pathname = String(rawPathname || "/");
  if (GONE.has(pathname)) return { type: "gone" };
  if (REDIRECTS[pathname]) return { type: "redirect", location: REDIRECTS[pathname] };
  const guide = pathname.match(/^\/guides\/([a-z0-9-]+)\/$/);
  if (guide && listGuideSlugs().includes(guide[1])) return { type: "redirect", location: `/guides/${guide[1]}` };
  const hub = pathname.match(/^\/auctions\/([a-z-]+)\/$/);
  if (hub) return { type: "redirect", location: `/auctions/${hub[1]}` };
  const domain = pathname.match(/^\/domains\/([a-z0-9-]+)\/$/);
  if (domain) return { type: "redirect", location: `/domains/${domain[1]}` };
  return null;
}

module.exports = { resolveUrlVariant, REDIRECTS, GONE };
