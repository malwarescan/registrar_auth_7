#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const { configureDefaultProductStore } = require(path.join(ROOT, "server", "candidate-store", "store-paths"));
const { listDurableCandidates, listSitemapCandidates, countDurableCandidates } = require(path.join(
  ROOT,
  "server",
  "candidate-store",
  "durable-candidates"
));
const { resolveSeoTier, SEO_TIER } = require(path.join(ROOT, "server", "candidate-store", "seo-tier"));
const {
  buildSitemapIndex,
  SITEMAP_INDEX_CHILDREN,
  resolveSitemapResponse,
  buildRobotsTxt,
} = require(path.join(ROOT, "server", "sitemap"));
const { getMetadataBaseUrl } = require(path.join(ROOT, "server", "public-url"));

const args = process.argv.slice(2);
const baseUrl = args.find((a) => a.startsWith("--base-url="))?.split("=")[1] || "http://localhost:4173";
const sampleSize = Number(args.find((a) => a.startsWith("--sample="))?.split("=")[1] || 10);
const checkAllUrls = !args.includes("--sample-only");
const productionReport = args.includes("--production") || args.includes("--production-report");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputArg = args.find((a) => a.startsWith("--output="));
const outputPath =
  outputArg?.split("=")[1] ||
  path.join(
    ROOT,
    "data",
    "reports",
    productionReport
      ? `production-sitemap-readiness-${timestamp}.json`
      : `sitemap-strategy-verify-${timestamp}.json`
  );

configureDefaultProductStore();

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error(`timeout: ${url}`)));
  });
}

function pickRandom(items, count) {
  const copy = [...items];
  const out = [];
  while (out.length < count && copy.length) {
    const index = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(index, 1)[0]);
  }
  return out;
}

function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function slugFromLoc(loc) {
  return loc.match(/\/domains\/([^/?#]+)/)?.[1] || null;
}

function inspectPage(body, metadataBase, slug) {
  const robots = body.match(/meta name="robots" content="([^"]+)"/)?.[1] || null;
  const canonical = body.match(/link rel="canonical" href="([^"]+)"/)?.[1] || null;
  const hasProduct = /"@type"\s*:\s*"Product"/.test(body);
  const hasOffer = /"@type"\s*:\s*"Offer"/.test(body);
  const expectedCanonical = `${metadataBase}/domains/${slug}`;
  return {
    robots,
    canonical,
    hasProductJsonLd: hasProduct,
    hasOfferJsonLd: hasOffer,
    canonicalBare: canonical === expectedCanonical && !canonical?.includes("?"),
    indexFollow: robots?.startsWith("index,follow") || false,
  };
}

async function mapPool(items, concurrency, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

(async () => {
  const failures = [];
  const records = listDurableCandidates();
  const tierCounts = { [SEO_TIER.INDEX_NOW]: 0, [SEO_TIER.HOLD_NOINDEX]: 0, [SEO_TIER.ARCHIVE]: 0 };

  for (const record of records) {
    const tier = resolveSeoTier(record);
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  }

  const sitemapRecords = listSitemapCandidates();
  const sitemapSlugs = new Set(sitemapRecords.map((record) => record.slug));
  const leaks = records.filter((record) => resolveSeoTier(record) !== SEO_TIER.INDEX_NOW && sitemapSlugs.has(record.slug));
  if (leaks.length) failures.push(`${leaks.length} non-index-now records in sitemap candidates`);
  if (tierCounts[SEO_TIER.INDEX_NOW] !== sitemapRecords.length) {
    failures.push(
      `index-now count ${tierCounts[SEO_TIER.INDEX_NOW]} != listSitemapCandidates ${sitemapRecords.length}`
    );
  }

  const metadataBase = getMetadataBaseUrl({ isProduction: true });
  const codeChecks = {
    sitemapIndexChildren: SITEMAP_INDEX_CHILDREN,
    archiveSitemapImplemented: Boolean(resolveSitemapResponse("/sitemap-domains-archive.xml")),
    builtIndexIsSitemapIndex: buildSitemapIndex({ isProduction: true }).includes("<sitemapindex"),
    robotsReferencesIndex: buildRobotsTxt({ isProduction: true }).includes("/sitemap.xml"),
    tierCounts,
    sitemapCandidateCount: sitemapRecords.length,
    holdOrArchiveInSitemap: leaks.length,
  };

  if (codeChecks.archiveSitemapImplemented) failures.push("archive sitemap should not be implemented yet");

  const live = { baseUrl, reachable: false, urlChecks: [], sampleChecks: [] };
  let domainXml = "";
  let domainLocs = [];

  try {
    const [index, domains, robots] = await Promise.all([
      get(`${baseUrl}/sitemap.xml`),
      get(`${baseUrl}/sitemap-domains-indexed.xml`),
      get(`${baseUrl}/robots.txt`),
    ]);
    live.reachable = true;
    domainXml = domains.body;
    domainLocs = parseSitemapLocs(domainXml);

    if (!index.body.includes("<sitemapindex")) failures.push("live /sitemap.xml is not a sitemap index");
    if (domainLocs.length !== sitemapRecords.length) {
      failures.push(`live domain sitemap ${domainLocs.length} != code ${sitemapRecords.length}`);
    }
    if (domainXml.includes("intent_id") || domainLocs.some((loc) => loc.includes("?"))) {
      failures.push("domain sitemap contains overlay or query URLs");
    }
    if (!domainXml.includes("<lastmod>")) failures.push("domain sitemap missing lastmod tags");

    const urlsToCheck = checkAllUrls ? domainLocs : pickRandom(domainLocs, Math.min(sampleSize, domainLocs.length));
    const detailedSample = pickRandom(domainLocs, Math.min(sampleSize, domainLocs.length));

    live.urlChecks = await mapPool(urlsToCheck, 8, async (pageUrl) => {
      const normalizedSlug = slugFromLoc(pageUrl);
      const localPageUrl = normalizedSlug ? `${baseUrl}/domains/${normalizedSlug}` : pageUrl;
      const graphUrl = normalizedSlug ? `${baseUrl}/api/domains/${normalizedSlug}/graph.json` : null;
      const page = await get(localPageUrl);
      const graph = graphUrl ? await get(graphUrl) : { status: 0, body: "" };
      const issues = [];
      if (page.status !== 200) issues.push(`HTTP ${page.status}`);
      const inspection = inspectPage(page.body, metadataBase, normalizedSlug);
      if (!inspection.indexFollow) issues.push(`robots=${inspection.robots || "missing"}`);
      if (!inspection.canonicalBare) issues.push(`canonical=${inspection.canonical || "missing"}`);
      if (!inspection.hasProductJsonLd) issues.push("missing Product JSON-LD");
      if (!inspection.hasOfferJsonLd) issues.push("missing Offer JSON-LD");
      if (graph.status !== 200) issues.push(`graph HTTP ${graph.status}`);
      else {
        try {
          const payload = JSON.parse(graph.body);
          const types = new Set((payload["@graph"] || []).map((node) => node["@type"]));
          if (!types.has("Product") || !types.has("Offer")) issues.push("graph missing Product/Offer");
        } catch {
          issues.push("graph invalid JSON");
        }
      }
      if (issues.length) failures.push(`${normalizedSlug || pageUrl}: ${issues.join(", ")}`);
      return { url: localPageUrl, slug: normalizedSlug, status: page.status, issues };
    });

    live.sampleChecks = await mapPool(detailedSample, 4, async (pageUrl) => {
      const slug = slugFromLoc(pageUrl);
      const page = await get(`${baseUrl}/domains/${slug}`);
      const graph = await get(`${baseUrl}/api/domains/${slug}/graph.json`);
      return {
        slug,
        pageUrl: `${baseUrl}/domains/${slug}`,
        graphUrl: `${baseUrl}/api/domains/${slug}/graph.json`,
        ...inspectPage(page.body, metadataBase, slug),
        pageStatus: page.status,
        graphStatus: graph.status,
      };
    });

    live.domainUrlCount = domainLocs.length;
    live.robotsSitemapLine = robots.body.trim().split("\n").find((line) => line.startsWith("Sitemap:"));
  } catch (error) {
    live.error = error instanceof Error ? error.message : String(error);
    failures.push(`live check failed: ${live.error}`);
  }

  const pass = failures.length === 0;
  const report = productionReport
    ? {
        generatedAt: new Date().toISOString(),
        pass,
        totalDurableRecords: countDurableCandidates(),
        indexNowCount: tierCounts[SEO_TIER.INDEX_NOW],
        holdNoindexCount: tierCounts[SEO_TIER.HOLD_NOINDEX],
        archiveCount: tierCounts[SEO_TIER.ARCHIVE],
        sitemapUrlCount: live.domainUrlCount ?? sitemapRecords.length,
        sampleCheckedUrls: live.sampleChecks,
        urlChecksSummary: {
          checked: live.urlChecks?.length || 0,
          failed: live.urlChecks?.filter((entry) => entry.issues?.length).length || 0,
        },
        failures,
        codeChecks,
        live: {
          baseUrl,
          reachable: live.reachable,
          robotsSitemapLine: live.robotsSitemapLine,
        },
      }
    : {
        generatedAt: new Date().toISOString(),
        purpose: "Verify sitemap + SEO tier implementation against source and live output",
        pass,
        codeChecks,
        live,
        failures,
      };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  process.stdout.write(`Sitemap verification ${pass ? "PASS" : "FAIL"}\n`);
  process.stdout.write(`  records: ${countDurableCandidates()}\n`);
  process.stdout.write(`  tiers: index-now=${tierCounts[SEO_TIER.INDEX_NOW]} hold-noindex=${tierCounts[SEO_TIER.HOLD_NOINDEX]} archive=${tierCounts[SEO_TIER.ARCHIVE]}\n`);
  process.stdout.write(`  sitemap URLs: ${live.domainUrlCount ?? sitemapRecords.length}\n`);
  if (live.urlChecks?.length) {
    process.stdout.write(`  URL checks: ${live.urlChecks.length} checked, ${live.urlChecks.filter((e) => e.issues?.length).length} failed\n`);
  }
  if (failures.length) {
    process.stdout.write("  failures:\n");
    for (const failure of failures.slice(0, 10)) process.stdout.write(`    - ${failure}\n`);
  }
  process.stdout.write(`  report: ${outputPath}\n`);

  process.exit(pass ? 0 : 1);
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
