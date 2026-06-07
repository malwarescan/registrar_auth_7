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
const { listPublicCandidates, findCandidateBySlug, isStatusStale } = require("./server/domain-fetch/candidate-service");

const ROOT = path.resolve(__dirname);
const ENV_FILES = [".env.local", ".env"];

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

ENV_FILES.forEach(loadEnvFile);
const PORT = Number(process.env.PORT || 4173);

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

function formatUtc(isoValue) {
  if (!isoValue) return "Not available";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

function buildCandidateJsonLd(candidate, canonicalUrl, ogImage, stale) {
  const graph = [
    {
      "@type": "Organization",
      "@id": "https://snatch.auction/#organization",
      name: "Snatch.auction",
      url: "https://snatch.auction/",
      logo: { "@type": "ImageObject", url: "https://snatch.auction/assets/logo.png" },
    },
    {
      "@type": "WebSite",
      "@id": "https://snatch.auction/#website",
      url: "https://snatch.auction/",
      name: "Snatch.auction",
      publisher: { "@id": "https://snatch.auction/#organization" },
    },
    {
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: `${candidate.domain} Domain Decision Candidate`,
      isPartOf: { "@id": "https://snatch.auction/#website" },
      about: { "@id": `${canonicalUrl}#product` },
      dateModified: candidate.statusVerifiedAt,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://snatch.auction/" },
        { "@type": "ListItem", position: 2, name: "Domain candidates", item: "https://snatch.auction/domains" },
        { "@type": "ListItem", position: 3, name: candidate.domain, item: canonicalUrl },
      ],
    },
    {
      "@type": "Product",
      "@id": `${canonicalUrl}#product`,
      name: candidate.domain,
      description: `A domain candidate for ${candidate.primaryIntent || candidate.category}.`,
      image: [ogImage],
      sku: candidate.candidateId,
      category: "Domain name",
      brand: { "@type": "Brand", name: candidate.domain },
    },
  ];

  const hasLivePrice =
    !stale &&
    candidate.status === "available" &&
    typeof candidate.acquisitionPath?.registrationPrice === "number" &&
    candidate.acquisitionPath?.priceCurrency;
  if (hasLivePrice) {
    graph[4].offers = {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      url: candidate.acquisitionPath?.actionUrl,
      priceCurrency: candidate.acquisitionPath.priceCurrency,
      price: candidate.acquisitionPath.registrationPrice,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "NameSilo" },
      validThrough: candidate.statusExpiresAt,
    };
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function renderCandidatePageHtml(candidate) {
  const slug = candidate.slug || candidate.domain.replace(/\./g, "-");
  const canonicalUrl = candidate.canonicalUrl || `https://snatch.auction/domains/${slug}`;
  const ogImage = `https://snatch.auction/domain-assets/${slug}.png`;
  const stale = isStatusStale(candidate);
  const visibleStatus = stale ? "pending-verification" : candidate.status;
  const statusLabel =
    visibleStatus === "available"
      ? "Available"
      : visibleStatus === "auction-active"
      ? "Auction active"
      : visibleStatus === "pending-verification"
      ? "Refresh required"
      : visibleStatus;
  const description = `Evaluate ${candidate.domain} as a domain for ${candidate.primaryIntent || candidate.category}. Review fit, risks, alternatives, and the verified NameSilo acquisition path.`;
  const buyerFit = (candidate.buyerFit || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const tradeoffs = (candidate.tradeoffs || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const related = (candidate.relatedCandidates || candidate.alternatives || [])
    .map(
      (item) => `<li><a href="${escapeHtml(item.url || `/domains/${String(item.domain || "").replace(/\./g, "-")}`)}">${escapeHtml(item.domain)}</a>
      <span>${escapeHtml(item.matchReason || "Related candidate")} · ${escapeHtml(item.status || "status unknown")} · ${
        Number.isFinite(item.fitScore) ? `${item.fitScore} fit` : "fit unknown"
      }</span></li>`
    )
    .join("");
  const scores = candidate.scores || {};
  const decisionCandidateData = {
    schemaVersion: candidate.schemaVersion,
    candidateId: candidate.candidateId,
    candidateType: candidate.candidateType,
    domain: candidate.domain,
    canonicalUrl,
    source: candidate.source,
    status: visibleStatus,
    statusVerifiedAt: candidate.statusVerifiedAt,
    statusExpiresAt: candidate.statusExpiresAt,
    category: candidate.category,
    whySurfaced: candidate.whySurfaced,
    buyerFit: candidate.buyerFit,
    catch: candidate.catch,
    acquisitionPath: {
      type: candidate.acquisitionPath?.type,
      provider: candidate.acquisitionPath?.provider,
      priceType: candidate.acquisitionPath?.priceType,
      requiresConfirmation: true,
    },
    scores: {
      semanticFit: scores.semanticFit,
      buyerFit: scores.buyerFit,
      brandability: scores.brandability,
      pronounceability: scores.pronounceability,
      categoryClarity: scores.categoryClarity,
      tldTrust: scores.tldTrust,
      acquisitionFriction: scores.acquisitionFriction,
      riskAdjusted: scores.riskAdjusted,
      overall: scores.overall,
    },
    confidence: candidate.confidence,
    availableActions: candidate.availableActions,
    nextAction: candidate.nextAction,
  };
  const jsonLd = buildCandidateJsonLd(candidate, canonicalUrl, ogImage, stale);
  const safeCandidateJson = JSON.stringify(decisionCandidateData).replace(/<\/script/gi, "<\\/script");
  const safeJsonLd = JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script");
  const alternateApiHref = `/api/candidates/${encodeURIComponent(candidate.candidateId)}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(candidate.domain)} ${statusLabel === "Available" ? "Available to Register" : "Domain Candidate"} | ${
    escapeHtml(candidate.category)
  } | Snatch.auction</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escapeHtml(candidate.domain)} | Domain Decision Candidate" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(candidate.domain)} | Snatch.auction" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link rel="alternate" type="application/json" href="${escapeHtml(alternateApiHref)}" title="Decision Candidate JSON" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-feed.ndjson" title="Domain Candidate Feed" />
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body class="app-shell">
    <header class="candidate-nav" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#fff;">
      <a href="/" class="brand">Snatch.auction</a>
      <nav aria-label="Primary navigation" style="display:flex;gap:12px;font-size:14px;">
        <a href="/experiments/intent-fetch/">Intent Fetch</a>
        <a href="/experiments/auction-radar/">Radar</a>
        <a href="/methodology/">Methodology</a>
      </nav>
    </header>
    <main id="main-content" class="container candidate-page" data-candidate-id="${escapeHtml(candidate.candidateId)}" data-domain="${escapeHtml(
    candidate.domain
  )}" data-status="${escapeHtml(visibleStatus)}" data-source="${escapeHtml(candidate.source)}" data-status-expires-at="${escapeHtml(
    candidate.statusExpiresAt || ""
  )}" style="padding-top:20px;">
      <nav aria-label="Breadcrumb" class="breadcrumbs" style="font-size:13px;color:#64748b;margin-bottom:10px;">
        <a href="/">Home</a> / <a href="/domains">Domain candidates</a> / <span aria-current="page">${escapeHtml(candidate.domain)}</span>
      </nav>
      <article class="candidate card" style="padding:16px;">
        <header class="candidate-hero">
          <p class="candidate-kicker" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Domain Decision Candidate</p>
          <h1 style="margin:0 0 6px;">${escapeHtml(candidate.domain)}</h1>
          <p class="candidate-category" style="margin:0 0 10px;color:#334155;">${escapeHtml(candidate.primaryIntent || candidate.category)}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="badge">${escapeHtml(statusLabel)}</span>
            <span class="badge">${escapeHtml(candidate.publicSourceLabel || candidate.source)}</span>
            <span class="badge blue">Overall ${Number.isFinite(scores.overall) ? scores.overall : "N/A"}</span>
            <span class="badge">${Math.round((candidate.confidence || 0) * 100)}% confidence</span>
          </div>
          <p class="candidate-summary" style="margin:0 0 10px;">${escapeHtml(candidate.whySurfaced)}</p>
          <dl class="candidate-facts" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            <div><dt style="font-size:12px;color:#64748b;">Acquisition path</dt><dd>${escapeHtml(candidate.acquisitionPath?.type || "verify")}</dd></div>
            <div><dt style="font-size:12px;color:#64748b;">Price type</dt><dd>${escapeHtml(candidate.acquisitionPath?.priceType || "undisclosed")}</dd></div>
            <div><dt style="font-size:12px;color:#64748b;">Verified</dt><dd><time datetime="${escapeHtml(
              candidate.statusVerifiedAt
            )}">${escapeHtml(formatUtc(candidate.statusVerifiedAt))}</time></dd></div>
            <div><dt style="font-size:12px;color:#64748b;">Expires</dt><dd><time datetime="${escapeHtml(
              candidate.statusExpiresAt || ""
            )}">${escapeHtml(formatUtc(candidate.statusExpiresAt))}</time></dd></div>
          </dl>
        </header>

        <section aria-labelledby="why-surfaced"><h2 id="why-surfaced">Why this domain surfaced</h2><p>${escapeHtml(candidate.whySurfaced)}</p></section>
        <section aria-labelledby="buyer-fit"><h2 id="buyer-fit">Buyer fit</h2><ul class="chip-row">${buyerFit || "<li>No buyer-fit labels.</li>"}</ul></section>
        <section class="candidate-fit-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">
          <div><h2>Best if</h2><p>${escapeHtml(candidate.bestIf || "")}</p></div>
          <div><h2>Less ideal if</h2><p>${escapeHtml(candidate.lessIdealIf || "")}</p></div>
        </section>
        <section aria-labelledby="acquisition">
          <h2 id="acquisition">Acquisition path</h2>
          <dl class="candidate-details" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
            <div><dt>Provider</dt><dd>${escapeHtml(candidate.acquisitionPath?.provider || "NameSilo")}</dd></div>
            <div><dt>Status</dt><dd>${escapeHtml(statusLabel)}</dd></div>
            <div><dt>Price type</dt><dd>${escapeHtml(candidate.acquisitionPath?.priceType || "undisclosed")}</dd></div>
            <div><dt>Registration price</dt><dd>${typeof candidate.acquisitionPath?.registrationPrice === "number" ? `$${candidate.acquisitionPath.registrationPrice}` : "Not published"}</dd></div>
          </dl>
          <p class="status-warning">${stale ? "Status expired. Refresh required before acquisition." : "Status is fresh but must be revalidated before irreversible action."}</p>
        </section>
        <section aria-labelledby="scores">
          <h2 id="scores">Decision signals</h2>
          <dl class="score-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
            <div><dt>Semantic fit</dt><dd>${scores.semanticFit ?? "N/A"}</dd></div>
            <div><dt>Buyer fit</dt><dd>${scores.buyerFit ?? "N/A"}</dd></div>
            <div><dt>Brandability</dt><dd>${scores.brandability ?? "N/A"}</dd></div>
            <div><dt>Pronounceability</dt><dd>${scores.pronounceability ?? "N/A"}</dd></div>
            <div><dt>Category clarity</dt><dd>${scores.categoryClarity ?? "N/A"}</dd></div>
            <div><dt>TLD trust</dt><dd>${scores.tldTrust ?? "N/A"}</dd></div>
            <div><dt>Acquisition friction</dt><dd>${scores.acquisitionFriction ?? "N/A"}</dd></div>
            <div><dt>Risk adjusted</dt><dd>${scores.riskAdjusted ?? "N/A"}</dd></div>
          </dl>
          <p class="methodology-note">Scores are directional signals, not guarantees. <a href="/methodology/">Review methodology</a>.</p>
        </section>
        <section aria-labelledby="tradeoffs"><h2 id="tradeoffs">Catch and tradeoffs</h2><p>${escapeHtml(candidate.catch || "")}</p><ul>${tradeoffs || "<li>No tradeoffs listed.</li>"}</ul></section>
        <section aria-labelledby="related-candidates"><h2 id="related-candidates">Related candidates</h2><ul class="related-candidate-list">${related || "<li>No related candidates.</li>"}</ul></section>
        <section class="candidate-verification" aria-labelledby="verification">
          <h2 id="verification">Freshness and verification</h2>
          <p>Status verified at <time datetime="${escapeHtml(candidate.statusVerifiedAt)}">${escapeHtml(formatUtc(candidate.statusVerifiedAt))}</time>.</p>
          <p>${stale ? "Current status has expired; refresh required before action." : "Refresh is required before final registration or bidding handoff."}</p>
        </section>
        <section class="candidate-actions" aria-label="Candidate actions" style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="shortlist-candidate" data-candidate-id="${escapeHtml(candidate.candidateId)}">Add to shortlist</button>
          <button type="button" id="compare-candidate" data-candidate-id="${escapeHtml(candidate.candidateId)}">Compare</button>
          <button type="button" id="refresh-candidate" data-candidate-id="${escapeHtml(candidate.candidateId)}">Refresh status</button>
          <a id="open-acquisition-path" href="${stale ? "#" : escapeHtml(candidate.acquisitionPath?.actionUrl || "#")}" ${
    stale ? 'aria-disabled="true"' : ""
  } target="_blank" rel="noopener noreferrer">Continue to acquisition</a>
        </section>
      </article>
    </main>
    <script id="decision-candidate-data" type="application/json">${safeCandidateJson}</script>
    <script type="application/ld+json">${safeJsonLd}</script>
    <script src="/assets/domain-candidate-page.js" defer></script>
    <script src="/assets/domain-candidate-webmcp.js" defer></script>
  </body>
</html>`;
}

function safePathname(inputPath) {
  try {
    return decodeURIComponent(inputPath);
  } catch {
    return inputPath;
  }
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
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 500, { error: "Failed to read static file." });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
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

  if (req.method === "GET" && pathname === "/domains") {
    const items = listPublicCandidates()
      .slice(0, 120)
      .map((candidate) => `<li><a href="/domains/${candidate.domain.replace(/\./g, "-")}">${escapeHtml(candidate.domain)}</a></li>`)
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Domain candidates | Snatch.auction</title><link rel="stylesheet" href="/assets/app.css"/></head><body class="app-shell"><main class="container" style="padding-top:24px;"><h1>Domain candidates</h1><ul>${items || "<li>No public candidates yet.</li>"}</ul></main></body></html>`);
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-feed.json") {
    const feed = listPublicCandidates().map((candidate) => ({
      candidateId: candidate.candidateId,
      domain: candidate.domain,
      canonicalUrl: candidate.canonicalUrl || `https://snatch.auction/domains/${candidate.domain.replace(/\./g, "-")}`,
      source: candidate.source,
      status: candidate.status,
      statusVerifiedAt: candidate.statusVerifiedAt,
      category: candidate.category,
      buyerFit: candidate.buyerFit,
      acquisitionType: candidate.acquisitionPath?.type,
      currentBid: candidate.acquisitionPath?.currentBid,
      registrationPrice: candidate.acquisitionPath?.registrationPrice,
      priceType: candidate.acquisitionPath?.priceType,
      overall: candidate.scores?.overall,
      riskFlags: candidate.riskFlags,
      nextAction: candidate.nextAction,
    }));
    sendJson(res, 200, { feed });
    return;
  }

  if (req.method === "GET" && pathname === "/api/domain-feed.ndjson") {
    const feed = listPublicCandidates();
    res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
    for (const candidate of feed) {
      res.write(
        `${JSON.stringify({
          candidateId: candidate.candidateId,
          domain: candidate.domain,
          canonicalUrl: candidate.canonicalUrl || `https://snatch.auction/domains/${candidate.domain.replace(/\./g, "-")}`,
          source: candidate.source,
          status: candidate.status,
          statusVerifiedAt: candidate.statusVerifiedAt,
          category: candidate.category,
          buyerFit: candidate.buyerFit,
          acquisitionType: candidate.acquisitionPath?.type,
          priceType: candidate.acquisitionPath?.priceType,
          overall: candidate.scores?.overall,
          riskFlags: candidate.riskFlags,
          nextAction: candidate.nextAction,
        })}\n`
      );
    }
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/sitemap.xml") {
    const domains = listPublicCandidates().map((candidate) => `/domains/${candidate.domain.replace(/\./g, "-")}`);
    const urls = ["/", "/experiments/intent-fetch/", "/experiments/auction-radar/", "/experiments/explain-domain/", "/methodology/", ...domains];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `<url><loc>http://localhost:${PORT}${url}</loc><changefreq>hourly</changefreq><priority>${url.startsWith("/domains/") ? "0.7" : "0.8"}</priority></url>`
  )
  .join("\n")}
</urlset>`;
    res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(xml);
    return;
  }

  if (req.method === "GET" && pathname === "/robots.txt") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`User-agent: *\nAllow: /\nSitemap: http://localhost:${PORT}/sitemap.xml\n`);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/domains/")) {
    const slug = pathname.replace("/domains/", "");
    const candidate = findCandidateBySlug(slug);
    if (!candidate) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Domain candidate not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderCandidatePageHtml(candidate));
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, requestUrl);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, () => {
  process.stdout.write(`Domain Fetch Lab server running on http://localhost:${PORT}\n`);
});
