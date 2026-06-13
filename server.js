const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleNameSiloAuctions } = require("./api/namesilo-auctions");
const { handleDomainFetch } = require("./api/domain-fetch");
const { handleCandidates } = require("./api/candidates");
const { handleCandidateDetail } = require("./api/candidate-detail");
const { handleCandidateStatus } = require("./api/candidate-status");
const { handleCompareCandidates } = require("./api/compare-candidates");
const { handleRefineCandidates } = require("./api/refine-candidates");
const { handleShortlistCandidate } = require("./api/shortlist-candidate");
const { handleWatchAuction } = require("./api/watch-auction");
const { handleAcquisitionPath } = require("./api/acquisition-path");
const { handleOutAcquire } = require("./api/out-acquire");
const {
  handleDomainProductBySlug,
  handleDomainGraphBySlug,
  handleDomainFeedNdjson,
  handleDomainFeedJson,
  handleDomainListingsNdjson,
  handleDomainListingsJson,
  handleDomainGraphNdjson,
  handleDomainListingsDatasetJson,
  resolveSlugFromApiPath,
} = require("./api/domain-product");
const { findSessionCandidateBySlug } = require("./server/domain-fetch/candidate-service");
const {
  getIntent,
  parseIntentPageContext,
} = require("./server/domain-fetch/intent-session");
const { getMetadataBaseUrl } = require("./server/public-url");
const {
  injectHomeDiscovery,
  renderFeedLandingPage,
  resolveFeedLandingKey,
} = require("./server/renderers/data-feed-landing");
const { listPublishedCandidates } = require("./server/published-catalog");
const { resolveDomainPage } = require("./server/candidate-store/resolve-domain-page");
const { configureDefaultProductStore } = require("./server/candidate-store/store-paths");
const { buildRobotsTxt, resolveSitemapResponse } = require("./server/sitemap");
const { renderSnatchLogoAnchor } = require("./server/snatch-logo-markup");
const { renderCandidatePageHtml } = require("./server/candidate-detail-page");
const { resolveLocalProductAssetPath } = require("./server/product-asset");

const ROOT = path.resolve(__dirname);
const ENV_FILES = [".env.local", ".env"];
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.RAILWAY_ENVIRONMENT_NAME) ||
  Boolean(process.env.RAILWAY_PROJECT_ID);

function loadEnvFile(filename) {
  const filePath = path.join(ROOT, filename);
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  });
}

if (!IS_PRODUCTION) {
  ENV_FILES.forEach(loadEnvFile);
}
const PORT = Number(process.env.PORT || (IS_PRODUCTION ? 8080 : 4173));
configureDefaultProductStore();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSnatchHeader() {
  return `<header class="site-header">${renderSnatchLogoAnchor("/experiments/intent-fetch/")}</header>`;
}

function safePathname(inputPath) {
  try {
    return decodeURIComponent(inputPath);
  } catch {
    return inputPath;
  }
}

function getIntentFetchAssetVersion() {
  const assetPaths = [
    "assets/app.css",
    "assets/intent-fetch-react.css",
    "assets/intent-fetch-react.js",
  ];
  let latest = 0;
  for (const rel of assetPaths) {
    const assetPath = path.join(ROOT, rel);
    if (fs.existsSync(assetPath)) {
      latest = Math.max(latest, fs.statSync(assetPath).mtimeMs);
    }
  }
  return String(Math.floor(latest));
}

function patchHtmlAssetVersions(html) {
  const version = getIntentFetchAssetVersion();
  return html.replace(
    /(\/(?:assets\/(?:app\.css|intent-fetch-react\.css|intent-fetch-react\.js)))(?:\?v=[^"']*)?/g,
    `$1?v=${version}`
  );
}

function staticResponseHeaders(ext) {
  const headers = { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" };
  if (!IS_PRODUCTION && [".html", ".css", ".js"].includes(ext)) {
    headers["Cache-Control"] = "no-store, must-revalidate";
  }
  return headers;
}
function resolveStaticPath(pathname) {
  const clean = safePathname(pathname).replace(/\/+$/, "") || "/";
  const candidate = clean === "/" ? "/index.html" : clean;
  let filePath = path.join(ROOT, candidate);
  if (clean.endsWith("/")) filePath = path.join(ROOT, clean, "index.html");
  return filePath;
}

function serveStatic(req, res, requestUrl) {
  let filePath = resolveStaticPath(requestUrl.pathname);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden path." });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    // For folder routes without trailing slash, attempt /route/index.html
    const folderIndexPath = path.join(ROOT, safePathname(requestUrl.pathname), "index.html");
    if (folderIndexPath.startsWith(ROOT) && fs.existsSync(folderIndexPath)) {
      filePath = folderIndexPath;
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 500, { error: "Failed to read static file." });
      return;
    }
    const headers = staticResponseHeaders(ext);
    if (ext === ".html") {
      const html = patchHtmlAssetVersions(content.toString("utf8"));
      res.writeHead(200, headers);
      res.end(html);
      return;
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

const SITEMAP_PATHS = new Set([
  "/sitemap.xml",
  "/sitemap-core.xml",
  "/sitemap-intents.xml",
  "/sitemap-domains-indexed.xml",
]);

function sendSitemapResponse(req, res, pathname, options = {}) {
  const xml = resolveSitemapResponse(pathname, options);
  if (!xml) return false;

  const headers = {
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": "inline",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  };

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return true;
  }

  if (req.method === "GET") {
    res.writeHead(200, headers);
    res.end(xml);
    return true;
  }

  return false;
}

function sendRobotsTxt(req, res, options = {}) {
  const body = buildRobotsTxt(options);
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  };

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  res.writeHead(200, headers);
  res.end(body);
}

function sendProductAssetResponse(req, res, slug) {
  const normalized = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!normalized) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const filePath = resolveLocalProductAssetPath(normalized);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const headers = {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=86400",
  };

  if (req.method === "HEAD") {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const requestUrl = new URL(req.url || "/", `http://${host}`);
  const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "GET" && pathname === "/api/namesilo-auctions") {
    await handleNameSiloAuctions(req, res, requestUrl);
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "snatch-auction",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/domain-fetch") {
    await handleDomainFetch(req, res, requestUrl);
    return;
  }

  if (req.method === "GET" && pathname === "/api/candidates") {
    handleCandidates(req, res);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/candidates/")) {
    const candidateId = pathname.replace("/api/candidates/", "");
    if (candidateId.endsWith("/status")) {
      const cleanId = candidateId.replace(/\/status$/, "");
      await handleCandidateStatus(req, res, cleanId, { apiKey: process.env.NAMESILO_API_KEY });
    } else {
      await handleCandidateDetail(req, res, candidateId, { apiKey: process.env.NAMESILO_API_KEY });
    }
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/candidates/") && pathname.endsWith("/status")) {
    const candidateId = pathname.replace("/api/candidates/", "").replace(/\/status$/, "");
    await handleCandidateStatus(req, res, candidateId, { apiKey: process.env.NAMESILO_API_KEY });
    return;
  }

  if (req.method === "POST" && pathname === "/api/compare-candidates") {
    await handleCompareCandidates(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/refine-candidates") {
    await handleRefineCandidates(req, res, { apiKey: process.env.NAMESILO_API_KEY });
    return;
  }

  if (req.method === "POST" && pathname === "/api/shortlist-candidate") {
    await handleShortlistCandidate(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/watch-auction") {
    await handleWatchAuction(req, res);
    return;
  }

  if (req.method === "POST" && pathname === "/api/acquisition-path") {
    await handleAcquisitionPath(req, res, { apiKey: process.env.NAMESILO_API_KEY });
    return;
  }

  if (req.method === "GET" && pathname === "/out/acquire") {
    await handleOutAcquire(req, res, requestUrl, { apiKey: process.env.NAMESILO_API_KEY });
    return;
  }

  if (req.method === "GET" && pathname === "/domains") {
    const published = listPublishedCandidates();
    const items = published
      .slice(0, 120)
      .map((entry) => {
        const slug = entry.slug || String(entry.domain || "").replace(/\./g, "-");
        const domain = entry.domain || slug.replace(/-/g, ".");
        return `<li><a href="/domains/${escapeHtml(slug)}">${escapeHtml(domain)}</a></li>`;
      })
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,follow"/><title>Domain candidates | Snatch</title><link rel="stylesheet" href="/assets/app.css?v=dev5"/></head><body class="snatch-app">${renderSnatchHeader()}<main class="domainPageMain"><div class="snatchRail" style="padding-top:24px;"><h1>Domain candidates</h1><ul>${items || "<li>No published domain candidates yet.</li>"}</ul></div></main></body></html>`);
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-feed.json") {
    handleDomainFeedJson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
      query: Object.fromEntries(requestUrl.searchParams.entries()),
      isProduction: IS_PRODUCTION,
      allowFullFeed: process.env.ALLOW_FULL_FEED === "true",
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-feed.ndjson") {
    handleDomainFeedNdjson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
      query: Object.fromEntries(requestUrl.searchParams.entries()),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-listings.json") {
    handleDomainListingsJson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
      query: Object.fromEntries(requestUrl.searchParams.entries()),
      isProduction: IS_PRODUCTION,
      allowFullFeed: process.env.ALLOW_FULL_FEED === "true",
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-listings.ndjson") {
    handleDomainListingsNdjson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
      query: Object.fromEntries(requestUrl.searchParams.entries()),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-listings.dataset.json") {
    handleDomainListingsDatasetJson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-graph.ndjson") {
    handleDomainGraphNdjson(req, res, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
      query: Object.fromEntries(requestUrl.searchParams.entries()),
    });
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/domains/") && pathname.endsWith("/graph.json")) {
    const slug = resolveSlugFromApiPath(pathname, "/api/domains/");
    handleDomainGraphBySlug(req, res, slug, {
      metadataBaseUrl: getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION }),
    });
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/domains/")) {
    const slug = resolveSlugFromApiPath(pathname, "/api/domains/");
    handleDomainProductBySlug(req, res, slug);
    return;
  }

  if (SITEMAP_PATHS.has(pathname) && (req.method === "GET" || req.method === "HEAD")) {
    if (
      sendSitemapResponse(req, res, pathname, {
        port: PORT,
        isProduction: IS_PRODUCTION,
      })
    ) {
      return;
    }
  }

  if (pathname === "/robots.txt" && (req.method === "GET" || req.method === "HEAD")) {
    sendRobotsTxt(req, res, { port: PORT, isProduction: IS_PRODUCTION });
    return;
  }

  const feedLandingKey = resolveFeedLandingKey(pathname);
  if (req.method === "GET" && feedLandingKey) {
    const metadataBaseUrl = getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION });
    const html = renderFeedLandingPage(feedLandingKey, metadataBaseUrl);
    if (html) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline" });
      res.end(html);
      return;
    }
  }

  if (req.method === "GET" && (pathname === "/experiments/intent-fetch" || pathname === "/")) {
    const metadataBaseUrl = getMetadataBaseUrl({ port: PORT, isProduction: IS_PRODUCTION });
    const filePath =
      pathname === "/"
        ? path.join(ROOT, "index.html")
        : path.join(ROOT, "experiments", "intent-fetch", "index.html");
    if (fs.existsSync(filePath)) {
      const html = injectHomeDiscovery(patchHtmlAssetVersions(fs.readFileSync(filePath, "utf8")), metadataBaseUrl);
      res.writeHead(200, staticResponseHeaders(".html"));
      res.end(html);
      return;
    }
  }

  if ((req.method === "GET" || req.method === "HEAD") && pathname.startsWith("/domain-assets/") && pathname.endsWith(".png")) {
    const slug = pathname.slice("/domain-assets/".length, -".png".length);
    sendProductAssetResponse(req, res, slug);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/domains/")) {
    const slug = pathname.replace("/domains/", "");
    const pageContext = parseIntentPageContext(requestUrl.searchParams);
    if (!pageContext.intentSlug && pageContext.intentId) {
      const intentRecord = getIntent(pageContext.intentId);
      if (intentRecord) pageContext.intentSlug = intentRecord.intentSlug;
    }
    const resolved = resolveDomainPage(slug, pageContext, findSessionCandidateBySlug);
    if (!resolved) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Domain candidate not found");
      return;
    }
    if (resolved.httpStatus === 410) {
      res.writeHead(410, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Domain product record removed");
      return;
    }
    const renderOptions = {
      indexable: resolved.indexable,
      port: PORT,
      isProduction: IS_PRODUCTION,
      pageMode: resolved.mode,
      record: resolved.record || null,
    };
    if (resolved.mode === "overlay") {
      renderOptions.baseCandidate = resolved.candidate;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderCandidatePageHtml(resolved.sessionCandidate, pageContext, renderOptions));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderCandidatePageHtml(resolved.candidate, pageContext, renderOptions));
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, requestUrl);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, "0.0.0.0", () => {
  const assetVersion = getIntentFetchAssetVersion();
  process.stdout.write(
    `Domain Fetch Lab server running on http://localhost:${PORT}\n` +
      `Intent Fetch assets version: ${assetVersion} (auto cache-bust in dev)\n`
  );
});
