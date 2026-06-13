#!/usr/bin/env node
/**
 * Live crawler audit for urlsnatcher.com — Googlebot + LLM/programmatic clients.
 * Usage: node scripts/audit-live-crawlers.js [--base-url=https://urlsnatcher.com]
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_BASE = "https://urlsnatcher.com";
const baseUrl = (
  process.argv.find((a) => a.startsWith("--base-url="))?.split("=")[1] || DEFAULT_BASE
).replace(/\/+$/, "");

const USER_AGENTS = {
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)",
  claudebot: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)",
  curl: "curl/8.0",
  browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
};

const findings = [];
const passes = [];

function pass(section, detail) {
  passes.push({ section, detail });
}

function fail(section, detail, severity = "error") {
  findings.push({ section, detail, severity });
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method || "GET",
        headers: {
          "User-Agent": options.userAgent || USER_AGENTS.curl,
          Accept: options.accept || "*/*",
          ...(options.headers || {}),
        },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`timeout: ${url}`)));
    req.end();
  });
}

function parseMeta(html, name) {
  return html.match(new RegExp(`meta name="${name}" content="([^"]+)"`, "i"))?.[1] || null;
}

function parseCanonical(html) {
  return html.match(/link rel="canonical" href="([^"]+)"/i)?.[1] || null;
}

function countPattern(html, pattern) {
  return (html.match(pattern) || []).length;
}

function parseJsonLdTypes(html) {
  const types = new Set();
  for (const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1]);
      const nodes = parsed["@graph"] || (parsed["@type"] ? [parsed] : []);
      for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
        if (node?.["@type"]) types.add(node["@type"]);
      }
      if (parsed["@type"]) types.add(parsed["@type"]);
      if (parsed.hasPart) {
        for (const part of parsed.hasPart) {
          if (part?.["@type"]) types.add(part["@type"]);
        }
      }
    } catch {
      /* skip */
    }
  }
  return [...types];
}

function parseAlternateLinks(html) {
  const links = [];
  for (const m of html.matchAll(/<link rel="alternate"([^>]+)>/gi)) {
    const tag = m[0];
    links.push({
      type: tag.match(/type="([^"]+)"/)?.[1] || null,
      href: tag.match(/href="([^"]+)"/)?.[1] || null,
      title: tag.match(/title="([^"]+)"/)?.[1] || null,
    });
  }
  return links;
}

function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function header(res, name) {
  const key = Object.keys(res.headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? res.headers[key] : null;
}

async function auditRobotsAndLlms() {
  const robots = await fetchUrl(`${baseUrl}/robots.txt`, { userAgent: USER_AGENTS.googlebot });
  if (robots.status !== 200) fail("robots.txt", `HTTP ${robots.status}`);
  else pass("robots.txt", "HTTP 200");

  if (!/Allow:\s*\//.test(robots.body)) fail("robots.txt", "Missing Allow: /");
  else pass("robots.txt", "Allows all crawlers");

  const sitemapLine = robots.body.split("\n").find((l) => l.startsWith("Sitemap:"));
  if (!sitemapLine?.includes(`${baseUrl}/sitemap.xml`)) {
    fail("robots.txt", `Sitemap line wrong or missing: ${sitemapLine || "none"}`);
  } else pass("robots.txt", `Sitemap: ${baseUrl}/sitemap.xml`);

  const llms = await fetchUrl(`${baseUrl}/llms.txt`, { userAgent: USER_AGENTS.gptbot });
  if (llms.status !== 200) fail("llms.txt", `HTTP ${llms.status}`);
  else pass("llms.txt", "HTTP 200");

  const llmsChecks = [
    ["/api/domain-listings.ndjson", "listings NDJSON"],
    ["/api/domain-feed.ndjson", "catalog NDJSON"],
    ["/api/domain-graph.ndjson", "graph NDJSON"],
    ["/data/domain-listings", "listings landing"],
    ["/sitemap.xml", "sitemap reference"],
    ["Do **not** submit NDJSON", "NDJSON sitemap warning"],
  ];
  for (const [needle, label] of llmsChecks) {
    if (llms.body.includes(needle)) pass("llms.txt", `Documents ${label}`);
    else fail("llms.txt", `Missing documentation for ${label}`, "warn");
  }
}

async function auditSitemaps() {
  const index = await fetchUrl(`${baseUrl}/sitemap.xml`, { userAgent: USER_AGENTS.googlebot });
  if (index.status !== 200) fail("sitemap", `/sitemap.xml HTTP ${index.status}`);
  if (!index.body.includes("<sitemapindex")) fail("sitemap", "/sitemap.xml is not a sitemap index");

  const children = parseSitemapLocs(index.body);
  const expected = [
    `${baseUrl}/sitemap-core.xml`,
    `${baseUrl}/sitemap-intents.xml`,
    `${baseUrl}/sitemap-domains-indexed.xml`,
  ];
  for (const child of expected) {
    if (children.includes(child)) pass("sitemap", `Index references ${child.replace(baseUrl, "")}`);
    else fail("sitemap", `Index missing child ${child}`);
  }

  if (children.some((c) => c.includes(".ndjson") || c.includes(".json"))) {
    fail("sitemap", "Index contains feed URLs (should be XML only)");
  } else pass("sitemap", "No feed URLs in sitemap index");

  for (const childPath of ["/sitemap-core.xml", "/sitemap-intents.xml", "/sitemap-domains-indexed.xml"]) {
    const res = await fetchUrl(`${baseUrl}${childPath}`, { userAgent: USER_AGENTS.googlebot });
    const ct = header(res, "content-type") || "";
    if (res.status !== 200) fail("sitemap", `${childPath} HTTP ${res.status}`);
    if (!ct.includes("xml")) fail("sitemap", `${childPath} Content-Type not XML: ${ct}`, "warn");

    const locs = parseSitemapLocs(res.body);
    if (childPath === "/sitemap-core.xml") {
      const coreExpected = ["/", "/data/domain-listings", "/data/domain-feed", "/data/domain-graph"];
      for (const p of coreExpected) {
        if (locs.some((l) => l.includes(p))) pass("sitemap", `Core sitemap includes ${p}`);
        else fail("sitemap", `Core sitemap missing ${p}`, "warn");
      }
    }
    if (childPath === "/sitemap-domains-indexed.xml") {
      if (locs.length === 0) {
        fail("sitemap", "Domain sitemap EMPTY — Google will not discover product URLs", "error");
      } else if (locs.length < 400) {
        fail("sitemap", `Domain sitemap only ${locs.length} URLs (expected ~500)`, "warn");
      } else {
        pass("sitemap", `Domain sitemap has ${locs.length} URLs`);
      }
      if (locs.some((l) => l.includes("?"))) fail("sitemap", "Domain sitemap contains query URLs");
      if (!res.body.includes("<lastmod>")) fail("sitemap", "Domain sitemap missing lastmod", "warn");
    }
    if (childPath === "/sitemap-intents.xml" && locs.length === 0) {
      fail("sitemap", "Intent sitemap empty (no intent pages indexed yet)", "info");
    }
  }
}

async function auditHtmlPage(pagePath, options = {}) {
  const ua = options.userAgent || USER_AGENTS.googlebot;
  const res = await fetchUrl(`${baseUrl}${pagePath}`, { userAgent: ua });
  const section = options.section || `page${pagePath}`;
  const result = { path: pagePath, status: res.status, ua: options.uaLabel || "default" };

  if (res.status !== 200) {
    fail(section, `${pagePath} HTTP ${res.status}`);
    return result;
  }

  const robots = parseMeta(res.body, "robots");
  const canonical = parseCanonical(res.body);
  const types = parseJsonLdTypes(res.body);
  const alternates = parseAlternateLinks(res.body);

  result.robots = robots;
  result.canonical = canonical;
  result.jsonLdTypes = types;
  result.alternateCount = alternates.length;

  if (options.expectIndex && robots && !robots.startsWith("index,follow")) {
    fail(section, `${pagePath} robots=${robots} (expected index,follow)`);
  }
  if (options.expectNoindex && robots && !robots.includes("noindex")) {
    fail(section, `${pagePath} should be noindex, got ${robots}`, "warn");
  }
  if (options.expectCanonical && canonical && !canonical.startsWith(baseUrl)) {
    fail(section, `${pagePath} canonical off-domain: ${canonical}`);
  }
  if (options.expectCanonical && canonical?.includes("snatch.auction")) {
    fail(section, `${pagePath} stale snatch.auction canonical: ${canonical}`);
  }
  if (options.expectDataset && !types.includes("Dataset")) {
    fail(section, `${pagePath} missing Dataset JSON-LD`);
  }
  if (options.expectDataFeed && !types.includes("DataFeed")) {
    fail(section, `${pagePath} missing DataFeed JSON-LD`);
  }
  if (options.expectProduct && !types.includes("Product")) {
    fail(section, `${pagePath} missing Product JSON-LD`);
  }
  if (options.expectOffer && !types.includes("Offer")) {
    fail(section, `${pagePath} missing Offer JSON-LD`);
  }
  if (options.minAlternates && alternates.length < options.minAlternates) {
    fail(section, `${pagePath} only ${alternates.length} alternate links (expected ≥${options.minAlternates})`, "warn");
  }
  if (options.expectFeedAlternate && !alternates.some((a) => a.type?.includes("ndjson"))) {
    fail(section, `${pagePath} missing NDJSON alternate discovery link`, "warn");
  }

  if (!findings.some((f) => f.section === section && f.detail.startsWith(pagePath))) {
    pass(section, `${pagePath} OK (${types.join(", ") || "no JSON-LD"})`);
  }

  return { ...result, alternates, body: res.body };
}

async function auditFeedEndpoints() {
  const feeds = [
    { path: "/api/domain-listings.ndjson?view=raw", expectLines: 0, label: "listings indexed (raw)" },
    { path: "/api/domain-listings.ndjson?view=raw&scope=active", expectLines: 400, label: "listings active (raw)" },
    { path: "/api/domain-feed.ndjson?view=raw", expectLines: 400, label: "catalog feed (raw)" },
    { path: "/api/domain-graph.ndjson?view=raw", expectLines: 400, label: "graph feed (raw)" },
    { path: "/api/domain-listings.json?limit=5", expectJson: true, label: "listings JSON" },
    { path: "/api/domain-listings.dataset.json", expectJson: true, label: "dataset metadata" },
  ];

  for (const feed of feeds) {
    const res = await fetchUrl(`${baseUrl}${feed.path}`, { userAgent: USER_AGENTS.curl });
    const ct = header(res, "content-type") || "";
    const cd = header(res, "content-disposition") || "";
    const xf = header(res, "x-feed-format") || "";

    if (res.status !== 200) {
      fail("feeds", `${feed.label} HTTP ${res.status}`);
      continue;
    }

    const lines = res.body.trim() ? res.body.trim().split("\n").length : 0;
    if (feed.expectLines !== undefined) {
      if (feed.expectLines > 0 && lines < feed.expectLines) {
        fail("feeds", `${feed.label}: only ${lines} lines (expected ≥${feed.expectLines})`);
      } else if (feed.expectLines === 0 && lines === 0) {
        fail("feeds", `${feed.label}: empty (indexed scope / sitemap-aligned)`, "error");
      } else {
        pass("feeds", `${feed.label}: ${lines} lines`);
      }
    }

    if (feed.path.includes("ndjson") && feed.path.includes("view=raw")) {
      if (!ct.includes("ndjson")) fail("feeds", `${feed.label} Content-Type should be application/x-ndjson, got ${ct}`, "warn");
      if (!cd.includes("inline")) fail("feeds", `${feed.label} missing Content-Disposition: inline`, "warn");
    }

    if (feed.expectJson) {
      try {
        JSON.parse(res.body);
        pass("feeds", `${feed.label}: valid JSON`);
      } catch {
        fail("feeds", `${feed.label}: invalid JSON`);
      }
    }

    if (feed.path.includes("ndjson") && !feed.path.includes("scope=active")) {
      const firstLine = res.body.trim().split("\n")[0];
      if (firstLine?.includes("snatch.auction")) {
        fail("feeds", `${feed.label}: stale snatch.auction URLs in output`);
      }
    }
  }

  const browserRes = await fetchUrl(`${baseUrl}/api/domain-listings.ndjson`, {
    userAgent: USER_AGENTS.browser,
    accept: "text/html,application/xhtml+xml",
  });
  if (browserRes.body.includes("<!DOCTYPE html") || browserRes.body.includes("<html")) {
    pass("feeds", "Browser Accept: text/html gets HTML preview");
  } else {
    fail("feeds", "Browser navigation did not get HTML preview page", "warn");
  }

  const apiRes = await fetchUrl(`${baseUrl}/api/domain-listings.ndjson?scope=active`, {
    userAgent: USER_AGENTS.curl,
  });
  const apiCt = header(apiRes, "content-type") || "";
  if (apiCt.includes("text/plain") || apiCt.includes("ndjson")) {
    pass("feeds", "API client gets raw feed bytes");
  } else {
    fail("feeds", `API client unexpected Content-Type: ${apiCt}`, "warn");
  }
}

async function auditDomainProduct() {
  const feedRes = await fetchUrl(`${baseUrl}/api/domain-feed.ndjson?view=raw&limit=1`, {
    userAgent: USER_AGENTS.curl,
  });
  let slug = null;
  try {
    const first = JSON.parse(feedRes.body.trim().split("\n")[0]);
    slug = first.slug;
  } catch {
    fail("domain-page", "Could not pick sample slug from catalog feed");
    return;
  }

  const page = await auditHtmlPage(`/domains/${slug}`, {
    section: "domain-page",
    userAgent: USER_AGENTS.googlebot,
    uaLabel: "Googlebot",
    expectIndex: true,
    expectCanonical: true,
    expectProduct: true,
    expectOffer: true,
    expectFeedAlternate: true,
    minAlternates: 1,
  });

  const graphRes = await fetchUrl(`${baseUrl}/api/domains/${slug}/graph.json`, {
    userAgent: USER_AGENTS.gptbot,
  });
  if (graphRes.status !== 200) {
    fail("domain-page", `/api/domains/${slug}/graph.json HTTP ${graphRes.status}`);
  } else {
    try {
      const graph = JSON.parse(graphRes.body);
      const types = new Set((graph["@graph"] || []).map((n) => n["@type"]));
      if (types.has("Product") && types.has("Offer")) {
        pass("domain-page", `Per-domain graph OK for ${slug} (${types.size} node types)`);
      } else {
        fail("domain-page", `Graph for ${slug} missing Product/Offer types`);
      }
    } catch {
      fail("domain-page", `Graph for ${slug} invalid JSON`);
    }
  }

  const assetRes = await fetchUrl(`${baseUrl}/domain-assets/${slug}.png`, {
    userAgent: USER_AGENTS.googlebot,
    method: "GET",
  });
  const ogMatch = page.body.match(/property="og:image" content="([^"]+)"/);
  const ogUrl = ogMatch?.[1];
  if (assetRes.status !== 200) {
    fail("domain-page", `Product asset route HTTP ${assetRes.status} for /domain-assets/${slug}.png`);
  } else {
    pass("domain-page", `Product asset route returns 200 for ${slug}`);
  }
  if (ogUrl) {
    const ogRes = await fetchUrl(ogUrl, { userAgent: USER_AGENTS.googlebot });
    if (ogRes.status !== 200) fail("domain-page", `og:image URL HTTP ${ogRes.status}: ${ogUrl}`, "warn");
    else pass("domain-page", `og:image returns 200`);
  }

  return slug;
}

async function auditDiscoveryCrossLinks() {
  const home = await fetchUrl(`${baseUrl}/`, { userAgent: USER_AGENTS.gptbot });
  const homeTypes = parseJsonLdTypes(home.body);
  const homeAlternates = parseAlternateLinks(home.body);

  if (homeTypes.includes("Dataset")) pass("discovery", "Homepage has Dataset JSON-LD");
  else fail("discovery", "Homepage missing Dataset JSON-LD");

  const feedAlts = homeAlternates.filter((a) => a.type?.includes("ndjson"));
  if (feedAlts.length >= 3) pass("discovery", `Homepage has ${feedAlts.length} NDJSON alternate links`);
  else fail("discovery", `Homepage only ${feedAlts.length} NDJSON alternate links (expected ≥3)`, "warn");

  for (const p of ["/data/domain-listings", "/data/domain-feed", "/data/domain-graph"]) {
    const res = await fetchUrl(`${baseUrl}${p}`, { userAgent: USER_AGENTS.claudebot });
    const hasCount = /<strong>\d+<\/strong> records/.test(res.body);
    const hasPolicy = /Update policy:/.test(res.body);
    const hasExample = /Example record/.test(res.body);
    const types = parseJsonLdTypes(res.body);

    if (!hasCount) fail("discovery", `${p} missing record count`);
    if (!hasPolicy) fail("discovery", `${p} missing update policy`);
    if (!hasExample) fail("discovery", `${p} missing example record`);
    if (!types.includes("Dataset")) fail("discovery", `${p} missing Dataset schema`);
    if (!types.includes("DataFeed")) fail("discovery", `${p} missing DataFeed schema`);

    if (hasCount && hasPolicy && hasExample && types.includes("Dataset") && types.includes("DataFeed")) {
      pass("discovery", `${p} landing page complete`);
    }
  }
}

async function auditBlockedSurfaces() {
  const noindexPages = ["/domains"];
  for (const p of noindexPages) {
    await auditHtmlPage(p, {
      section: "noindex-guard",
      expectNoindex: true,
      userAgent: USER_AGENTS.googlebot,
    });
  }

  const wrongSitemapCandidates = [
    "/api/domain-listings.ndjson",
    "/data/domain-listings",
    "/llms.txt",
  ];
  for (const p of wrongSitemapCandidates) {
    const index = await fetchUrl(`${baseUrl}/sitemap.xml`, { userAgent: USER_AGENTS.googlebot });
    if (parseSitemapLocs(index.body).some((l) => l.includes(p))) {
      fail("noindex-guard", `${p} incorrectly listed in sitemap index`);
    }
  }
  pass("noindex-guard", "Feed URLs not in sitemap index");
}

async function auditUaParity() {
  const paths = ["/", "/data/domain-listings", "/llms.txt"];
  for (const p of paths) {
    const [google, gpt] = await Promise.all([
      fetchUrl(`${baseUrl}${p}`, { userAgent: USER_AGENTS.googlebot }),
      fetchUrl(`${baseUrl}${p}`, { userAgent: USER_AGENTS.gptbot }),
    ]);
    if (google.status !== gpt.status) {
      fail("ua-parity", `${p} Googlebot=${google.status} GPTBot=${gpt.status}`, "warn");
    } else {
      pass("ua-parity", `${p} same status for Googlebot/GPTBot (${google.status})`);
    }
  }
}

(async () => {
  const started = Date.now();
  process.stdout.write(`\nLive crawler audit: ${baseUrl}\n`);
  process.stdout.write(`${"=".repeat(60)}\n\n`);

  await auditRobotsAndLlms();
  await auditSitemaps();
  await auditDiscoveryCrossLinks();

  const staticPages = [
    { path: "/", expectDataset: true, minAlternates: 3, section: "googlebot-pages" },
    { path: "/methodology/", expectIndex: true, section: "googlebot-pages" },
    { path: "/experiments/intent-fetch/", expectIndex: true, section: "googlebot-pages" },
  ];
  for (const p of staticPages) {
    await auditHtmlPage(p.path, { ...p, userAgent: USER_AGENTS.googlebot, uaLabel: "Googlebot", expectCanonical: true });
  }

  await auditFeedEndpoints();
  const sampleSlug = await auditDomainProduct();
  await auditBlockedSurfaces();
  await auditUaParity();

  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const infos = findings.filter((f) => f.severity === "info");

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    durationMs: Date.now() - started,
    sampleDomainSlug: sampleSlug,
    summary: {
      pass: errors.length === 0,
      passes: passes.length,
      errors: errors.length,
      warnings: warns.length,
      info: infos.length,
    },
    passes,
    findings,
  };

  const outDir = path.join(ROOT, "data", "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `live-crawler-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  process.stdout.write(`GOOGLEBOT + LLM CRAWLER AUDIT\n`);
  process.stdout.write(`${"=".repeat(60)}\n`);
  process.stdout.write(`Passes:   ${passes.length}\n`);
  process.stdout.write(`Errors:   ${errors.length}\n`);
  process.stdout.write(`Warnings: ${warns.length}\n`);
  process.stdout.write(`Info:     ${infos.length}\n`);
  if (sampleSlug) process.stdout.write(`Sample:   /domains/${sampleSlug}\n`);
  process.stdout.write(`\n`);

  if (errors.length) {
    process.stdout.write("ERRORS (fix before GSC submit):\n");
    for (const f of errors) process.stdout.write(`  ✗ [${f.section}] ${f.detail}\n`);
    process.stdout.write("\n");
  }
  if (warns.length) {
    process.stdout.write("WARNINGS:\n");
    for (const f of warns) process.stdout.write(`  ⚠ [${f.section}] ${f.detail}\n`);
    process.stdout.write("\n");
  }
  if (infos.length) {
    process.stdout.write("INFO:\n");
    for (const f of infos) process.stdout.write(`  · [${f.section}] ${f.detail}\n`);
    process.stdout.write("\n");
  }

  process.stdout.write(`Full report: ${outPath}\n\n`);
  process.exit(errors.length ? 1 : 0);
})().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
