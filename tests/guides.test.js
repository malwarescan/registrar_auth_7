const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { GUIDES, listGuideSlugs } = require("../server/guides/guide-content");
const { buildAuctionStore } = require("../server/candidate-store/auction-snapshot");
const {
  renderGuidePage,
  renderGuidesIndexPage,
  resolveGuideRoute,
} = require("../server/renderers/guides-renderer");
const { getCoreSitemapPaths, buildCoreSitemap, buildSitemapIndex } = require("../server/sitemap");

const BASE = "https://urlsnatcher.com";
const ROOT = path.join(__dirname, "..");

// Returns every schema node on the page, flattening a single @graph.
function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((match) => {
    const parsed = JSON.parse(match[1]);
    return parsed["@graph"] || [parsed];
  });
}

test("eight guides with unique slugs and complete decision sections", () => {
  assert.equal(GUIDES.length, 8);
  assert.equal(new Set(listGuideSlugs()).size, 8);
  for (const guide of GUIDES) {
    assert.ok(guide.question.endsWith("?"), guide.slug);
    assert.ok(guide.answer.length >= 1 && guide.answer.length <= 3, guide.slug);
    assert.ok(guide.sections.some((section) => section.table), `${guide.slug} has a comparison table`);
    assert.ok(guide.checklist.length >= 3, guide.slug);
    assert.ok(guide.whenNot.length >= 2, guide.slug);
    assert.ok(guide.mistakes.length >= 3, guide.slug);
    assert.ok(guide.nextStep.length > 40, guide.slug);
    assert.ok(guide.faqs.length >= 3 && guide.faqs.length <= 5, guide.slug);
    assert.ok(guide.sources.length >= 1, guide.slug);
    assert.ok(guide.title.length <= 90, `${guide.slug} title length`);
  }
});

test("guide routes resolve only known slugs", () => {
  assert.deepEqual(resolveGuideRoute("/guides"), { type: "index" });
  assert.deepEqual(resolveGuideRoute("/guides/"), { type: "index" });
  assert.deepEqual(resolveGuideRoute("/guides/what-is-a-domain-backorder"), {
    type: "guide",
    slug: "what-is-a-domain-backorder",
  });
  assert.equal(resolveGuideRoute("/guides/not-a-guide"), null);
  assert.equal(resolveGuideRoute("/guides/../index.html"), null);
  assert.equal(resolveGuideRoute("/domains/x"), null);
});

test("each guide page renders H1 question, direct answer, canonical and schema", () => {
  for (const guide of GUIDES) {
    const html = renderGuidePage(guide.slug, BASE);
    assert.ok(html, guide.slug);
    const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)[1];
    assert.equal(h1, guide.question.replace(/'/g, "&#39;"));
    assert.match(html, new RegExp(`<link rel="canonical" href="${BASE}/guides/${guide.slug}" />`));
    assert.match(html, /<meta name="robots" content="index,follow" \/>/);
    assert.match(html, /<meta name="description" content="[^"]{80,}" \/>/);
    assert.match(html, /class="guide-answer"/);
    for (const heading of ["Decision checklist", "When not to do it", "Common mistakes", "Next step", "Frequently asked questions"]) {
      assert.ok(html.includes(`<h2>${heading}</h2>`), `${guide.slug} ${heading}`);
    }
    assert.match(html, /<table>/);

    const types = jsonLdBlocks(html).map((block) => block["@type"]);
    assert.deepEqual(types.sort(), ["Article", "BreadcrumbList", "FAQPage", "Organization", "Organization", "WebSite"]);
    const article = jsonLdBlocks(html).find((block) => block["@type"] === "Article");
    assert.equal(article["@id"], `${BASE}/guides/${guide.slug}#article`);
    assert.deepEqual(article.publisher, { "@id": `${BASE}/#organization` });
    const faq = jsonLdBlocks(html).find((block) => block["@type"] === "FAQPage");
    assert.equal(faq.mainEntity.length, guide.faqs.length);
    const crumbs = jsonLdBlocks(html).find((block) => block["@type"] === "BreadcrumbList");
    assert.equal(crumbs.itemListElement[2].item, `${BASE}/guides/${guide.slug}`);
    assert.doesNotMatch(html, /localhost/);
  }
});

test("guides index links every guide and has breadcrumb schema", () => {
  const html = renderGuidesIndexPage(BASE);
  assert.match(html, /<link rel="canonical" href="https:\/\/urlsnatcher\.com\/guides" \/>/);
  for (const slug of listGuideSlugs()) {
    assert.ok(html.includes(`href="/guides/${slug}"`), slug);
  }
  const types = jsonLdBlocks(html).map((block) => block["@type"]);
  assert.ok(types.includes("CollectionPage"));
  assert.ok(types.includes("BreadcrumbList"));
});

test("guides are listed in the core sitemap, which the index lists", () => {
  const paths = getCoreSitemapPaths();
  assert.ok(paths.includes("/guides"));
  const xml = buildCoreSitemap({ port: 4173, isProduction: true });
  assert.match(xml, /<loc>https:\/\/urlsnatcher\.com\/guides<\/loc>/);
  for (const slug of listGuideSlugs()) {
    assert.ok(paths.includes(`/guides/${slug}`), slug);
    assert.ok(xml.includes(`<loc>https://urlsnatcher.com/guides/${slug}</loc>`), slug);
  }
  assert.match(buildSitemapIndex({ port: 4173, isProduction: true }), /sitemap-core\.xml/);
});

test("auction data stats are computed from NameSilo auction data", () => {
  const raw = [
    { domain: "alphaone.com", openingBid: 1, currentBid: 1, bidsQuantity: 0, auctionEndsOnUtc: "2026-06-13 08:00:00" },
    { domain: "betatwo.com", openingBid: 1, currentBid: 1, bidsQuantity: 0, auctionEndsOnUtc: "2026-06-13 08:00:00" },
    { domain: "gammathree.com", openingBid: 2, currentBid: 9, bidsQuantity: 3, auctionEndsOnUtc: "2026-06-14 08:00:00" },
  ];
  const { meta } = buildAuctionStore(raw, { fetchedAt: "2026-06-13T05:00:00Z", now: Date.parse("2026-06-13T06:00:00Z") });
  const stats = meta.stats;
  assert.equal(stats.total, 3);
  assert.equal(stats.zeroBids, 2);
  assert.equal(stats.withBids, 1);
  assert.equal(stats.maxBidCount, 3);
  assert.equal(stats.atMinimumOpening, 2);
  assert.equal(stats.openingMedian, 1);
  assert.equal(stats.bidPriceMax, 9);
  assert.equal(stats.lastEnd, "2026-06-14T08:00:00.000Z");

  const html = renderGuidePage("should-i-bid-on-a-domain-with-low-bid-count", BASE, { auctionData: meta });
  assert.match(html, /What our auction data shows/);
  assert.match(html, /2 of 3 \(66\.7%\)/);
  assert.match(html, /13 June 2026 at 05:00 UTC/);
  assert.match(html, /have since ended/);
  const opening = renderGuidePage("how-to-estimate-a-fair-bid-for-an-expired-domain", BASE, { auctionData: meta });
  assert.match(opening, /Opening bid, lowest/);
  const noData = renderGuidePage("should-i-bid-on-a-domain-with-low-bid-count", BASE, { auctionData: null });
  assert.doesNotMatch(noData, /What our auction data shows/);
});

test("homepage has a descriptive title, meta description and guide links", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.doesNotMatch(title, /Domain Fetch Lab/);
  assert.match(title, /Expired Domain Auctions/);
  assert.match(html, /<meta name="description" content="[^"]{80,}" \/>/);
  assert.match(html, /href="\/guides"/);
  // The homepage is a real landing page, not a redirect stub.
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
  assert.doesNotMatch(html, /location\.replace/);
  assert.match(html, /<h1>/);
  assert.match(html, /href="\/experiments\/intent-fetch\/"/);
  const intentFetch = fs.readFileSync(path.join(ROOT, "experiments", "intent-fetch", "index.html"), "utf8");
  assert.match(intentFetch, /href="\/guides"/);
});
