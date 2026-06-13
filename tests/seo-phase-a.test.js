const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildSitemapIndex,
  buildCoreSitemap,
  buildStableSitemapPaths,
  buildRobotsTxt,
} = require("../server/sitemap");
const { getPublicBaseUrl, getMetadataBaseUrl, toAbsolutePublicUrl, toPublicMetadataUrl } = require("../server/public-url");
const { buildDemandSignalFromFetch } = require("../server/demand-signals");
const { isPublishedCandidate } = require("../server/published-catalog");

test("sitemap excludes volatile session candidate slugs", () => {
  const paths = buildStableSitemapPaths();
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/experiments/intent-fetch/"));
  assert.ok(paths.includes("/methodology/"));
  assert.equal(paths.some((entry) => entry.startsWith("/domains/workflowfounder-com")), false);
});

test("robots and sitemap use PUBLIC_BASE_URL when configured", () => {
  const previous = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = "https://snatch.auction";
  try {
    assert.equal(getPublicBaseUrl(), "https://snatch.auction");
    assert.match(buildRobotsTxt(), /Sitemap: https:\/\/snatch\.auction\/sitemap\.xml/);
    assert.match(buildSitemapIndex(), /sitemap-core\.xml/);
    assert.match(buildCoreSitemap(), /<loc>https:\/\/snatch\.auction\/methodology\/<\/loc>/);
    assert.doesNotMatch(buildCoreSitemap(), /localhost/);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previous;
  }
});

test("toPublicMetadataUrl never uses localhost without explicit opt-in", () => {
  const previousPublicBase = process.env.PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  process.env.NODE_ENV = "development";
  try {
    assert.equal(toPublicMetadataUrl("/domain-assets/test.png", { port: 4173, isProduction: false }), "https://snatch.auction/domain-assets/test.png");
    assert.equal(getMetadataBaseUrl({ port: 4173, isProduction: false }), "https://snatch.auction");
  } finally {
    if (previousPublicBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicBase;
  }
});

test("toAbsolutePublicUrl falls back to localhost in non-production dev", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPublicBase = process.env.PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  process.env.NODE_ENV = "development";
  try {
    assert.equal(toAbsolutePublicUrl("/sitemap.xml", { port: 4173, isProduction: false }), "http://localhost:4173/sitemap.xml");
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousPublicBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousPublicBase;
  }
});

test("demand signal builder captures fetch metadata", () => {
  const signal = buildDemandSignalFromFetch({
    intentRecord: {
      intentId: "if_abcd",
      intentSlug: "founder-workflow",
      brief: "Founder workflow",
      label: "Founder workflow",
      intentCategory: "founder-workflow",
      requestId: "fetch_123",
    },
    decisionCandidates: [{ domain: "workflowfounder.com" }, { domain: "founderflow.io" }],
    fetchedAt: "2026-06-11T12:00:00.000Z",
  });

  assert.equal(signal.intentSlug, "founder-workflow");
  assert.equal(signal.rawBrief, "Founder workflow");
  assert.equal(signal.candidateCount, 2);
  assert.deepEqual(signal.topCandidateDomains, ["workflowfounder.com", "founderflow.io"]);
  assert.equal(signal.source, "intent-fetch");
});

test("appendDemandSignal writes JSONL without throwing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snatch-signals-"));
  const tempFile = path.join(tempDir, "intent-signals.jsonl");
  const { appendDemandSignal } = require("../server/demand-signals");

  appendDemandSignal({ timestamp: "2026-06-11T12:00:00.000Z", intentSlug: "test-intent" }, tempFile);
  const lines = fs.readFileSync(tempFile, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /test-intent/);
});

test("published catalog starts empty for manual promotion only", () => {
  assert.equal(isPublishedCandidate("workflowfounder-com"), false);
});
