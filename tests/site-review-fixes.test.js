const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLifecycleState, resolveEffectiveStatus, resolveProductPageMode } = require("../server/candidate-store/product-lifecycle");
const { evaluateQuality } = require("../server/domain-fetch/evaluate-quality");
const { buildCategoryGuesses } = require("../server/candidate-store/product-intelligence");
const { resolveUrlVariant } = require("../server/url-variants");
const { SITE_NAME, buildSiteGraphNodes, OPERATOR_ID } = require("../server/site-identity");
const { buildSeoRenderData } = require("../server/renderers/seo-renderer");
const { renderMethodologyPage, renderAboutPage } = require("../server/renderers/site-pages");

const BASE = "https://urlsnatcher.com";

function endedRecord() {
  return {
    slug: "deskflow-com",
    domain: "deskflow.com",
    tld: ".com",
    status: "auction-active",
    seoTier: "index-now",
    indexable: true,
    canonicalUrl: `${BASE}/domains/deskflow-com`,
    auctionEndsAt: "2026-06-13T08:00:00.000Z",
    currentBid: 1,
    acquisitionPath: { type: "auction", provider: "NameSilo", actionUrl: "https://www.namesilo.com/auctions/deskflow.com", auctionEndsAt: "2026-06-13T08:00:00.000Z", priceCurrency: "USD", currentBid: 1 },
    categoryGuesses: ["Support software"],
  };
}

test("an auction past its end time is ended, noindex and has no InStock offer", () => {
  const record = endedRecord();
  assert.equal(resolveLifecycleState(record), "ended");
  assert.equal(resolveEffectiveStatus(record), "auction-ended");
  assert.equal(resolveProductPageMode(record), "ended");
  const seo = buildSeoRenderData(record, "ended", { metadataBaseUrl: BASE });
  assert.match(seo.robots, /^noindex/);
  assert.match(seo.title, /Ended/);
  assert.doesNotMatch(JSON.stringify(seo.jsonLd), /InStock/);
  assert.equal(resolveLifecycleState(record, Date.parse("2026-06-12T00:00:00Z")), "active");
});

test("random-string names are flagged, score low and get no category", () => {
  for (const root of ["09kybuo0c", "23aqyfe2", "1wdoazaxc", "85ovuku0c"]) {
    const quality = evaluateQuality(root);
    assert.ok(quality.qualityFlags.includes("random-string"), root);
    assert.ok(quality.pronounceability <= 25, root);
    assert.deepEqual(buildCategoryGuesses(root), [], root);
  }
  for (const root of ["anudesk", "legalai", "99sumo", "abc88slot", "qatar"]) {
    assert.equal(evaluateQuality(root).qualityFlags.includes("random-string"), false, root);
  }
  assert.ok(buildCategoryGuesses("anudesk").includes("Support software"));
});

test("URL variants redirect to the canonical form; prototypes are gone", () => {
  assert.deepEqual(resolveUrlVariant("/index.html"), { type: "redirect", location: "/" });
  assert.deepEqual(resolveUrlVariant("/methodology"), { type: "redirect", location: "/methodology/" });
  assert.deepEqual(resolveUrlVariant("/guides/"), { type: "redirect", location: "/guides" });
  assert.deepEqual(resolveUrlVariant("/experiments/intent-fetch"), { type: "redirect", location: "/experiments/intent-fetch/" });
  assert.deepEqual(resolveUrlVariant("/naming-strategy.html"), { type: "gone" });
  assert.deepEqual(resolveUrlVariant("/experiments/explain-domain/"), { type: "gone" });
  assert.equal(resolveUrlVariant("/guides"), null);
});

test("site entity is one Organization and WebSite with NameSilo as parent", () => {
  const [org, site, namesilo] = buildSiteGraphNodes(BASE);
  assert.equal(org["@id"], `${BASE}/#organization`);
  assert.equal(org.name, SITE_NAME);
  assert.deepEqual(org.parentOrganization, { "@id": OPERATOR_ID });
  assert.ok(org.logo.url.endsWith("/assets/site-logo.svg"));
  assert.equal(site["@id"], `${BASE}/#website`);
  assert.equal(namesilo["@id"], "https://www.namesilo.com/#organization");
  assert.equal(namesilo.name, "NameSilo");
});

test("methodology and about pages are server-rendered with schema and disclosure", () => {
  const methodology = renderMethodologyPage(BASE);
  assert.match(methodology, /"@type":"TechArticle"/);
  assert.match(methodology, /Pronounceability/);
  assert.match(methodology, /<link rel="canonical" href="https:\/\/urlsnatcher\.com\/methodology\/" \/>/);
  const about = renderAboutPage(BASE);
  assert.ok(about.includes(`${SITE_NAME} is run by`));
  assert.match(about, /"@type":"AboutPage"/);
});
