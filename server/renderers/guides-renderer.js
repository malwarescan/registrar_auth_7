const fs = require("fs");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { DEFAULT_BATCH_PATH } = require("../candidate-store/index-now-batch");
const { GUIDES, SOURCES, PUBLISHED, MODIFIED, getGuide } = require("../guides/guide-content");
const { SITE_NAME, orgId, websiteId } = require("../site-identity");
const { renderPageDocument } = require("./site-layout");
const GUIDES_INDEX_TITLE = "Expired Domain Auction Guides: Backorders, Bidding and Due Diligence";
const GUIDES_INDEX_DESCRIPTION =
  "Decision guides for buying expired domains: how auctions and backorders work, what to check before bidding, how to set a fair maximum bid, and when a new domain is the better choice.";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonLdScript(payload) {
  return `<script type="application/ld+json">${JSON.stringify(payload).replace(/<\/script/gi, "<\\/script")}</script>`;
}

function formatUtcDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatPercent(part, total) {
  return `${((part / total) * 100).toFixed(1)}%`;
}

// Aggregates from the NameSilo auction snapshot shipped in data/index-now-batch.json.
// Bids are as observed at verification time, before the auctions closed.
function getAuctionSnapshotStats(batchPath = DEFAULT_BATCH_PATH) {
  let records;
  try {
    const parsed = JSON.parse(fs.readFileSync(batchPath, "utf8"));
    records = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
  } catch {
    return null;
  }
  const auctions = records.filter(
    (record) =>
      record &&
      Number.isFinite(Number(record.bidCount)) &&
      Number.isFinite(Number(record.currentBid)) &&
      record.auctionEndsAt &&
      record.statusVerifiedAt
  );
  if (!auctions.length) return null;

  const bids = auctions.map((record) => Number(record.bidCount));
  const prices = auctions.map((record) => Number(record.currentBid)).sort((a, b) => a - b);
  const endTimes = auctions.map((record) => record.auctionEndsAt).sort();
  const verifiedTimes = auctions.map((record) => record.statusVerifiedAt).sort();
  const providers = [...new Set(auctions.map((record) => record.provider).filter(Boolean))];
  const tlds = [...new Set(auctions.map((record) => record.tld).filter(Boolean))];
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const minPrice = prices[0];

  return {
    total: auctions.length,
    providers,
    tlds,
    zeroBids: bids.filter((count) => count === 0).length,
    withBids: bids.filter((count) => count > 0).length,
    maxBidCount: Math.max(...bids),
    atMinimumPrice: prices.filter((price) => price === minPrice).length,
    minPrice,
    medianPrice: median,
    maxPrice: prices[prices.length - 1],
    firstEnd: endTimes[0],
    lastEnd: endTimes[endTimes.length - 1],
    firstVerified: verifiedTimes[0],
    lastVerified: verifiedTimes[verifiedTimes.length - 1],
  };
}

function formatUsd(value) {
  return `$${Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 2)}`;
}

function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// How the sample was drawn, stated the same way wherever the data appears.
function describeSample(stats) {
  const provider = stats.providers.join(", ") || "registrar";
  const tld = stats.tlds.join(", ");
  const sampled =
    formatUtcDate(stats.firstVerified) === formatUtcDate(stats.lastVerified)
      ? formatLongDate(stats.firstVerified)
      : `${formatLongDate(stats.firstVerified)} to ${formatLongDate(stats.lastVerified)}`;
  const ends =
    formatUtcDate(stats.firstEnd) === formatUtcDate(stats.lastEnd)
      ? `ending on ${formatLongDate(stats.firstEnd)}`
      : `ending between ${formatLongDate(stats.firstEnd)} and ${formatLongDate(stats.lastEnd)}`;
  return `Sample: ${stats.total} ${escapeHtml(provider)} expired-domain auctions (${escapeHtml(tld)} only), recorded on ${escapeHtml(sampled)} for auctions ${escapeHtml(ends)}. These are the auctions we chose to publish pages for, picked by our own name scores, not a random sample of all ${escapeHtml(provider)} auctions. Figures are as recorded on that date, before the auctions closed; all of these auctions have since ended.`;
}

function renderBidCountSection(stats) {
  return `<section class="guide-section guide-data">
        <h2>What our auction data shows</h2>
        <p>${describeSample(stats)}</p>
        <table>
          <thead><tr><th>Bid activity at the time we recorded it</th><th>Auctions</th></tr></thead>
          <tbody>
            <tr><td>No bids yet</td><td>${stats.zeroBids} of ${stats.total} (${formatPercent(stats.zeroBids, stats.total)})</td></tr>
            <tr><td>At least one bid</td><td>${stats.withBids} of ${stats.total} (${formatPercent(stats.withBids, stats.total)})</td></tr>
            <tr><td>Most bids on a single auction</td><td>${stats.maxBidCount}</td></tr>
          </tbody>
        </table>
        <p>So a domain with no bids hours before its auction ends is in the large majority, not an outlier. A zero bid count says that few people have looked, not that something is wrong with the name; your own checks have to answer that.</p>
      </section>`;
}

function renderOpeningBidSection(stats) {
  return `<section class="guide-section guide-data">
        <h2>What opening bids looked like in our sample</h2>
        <p>On ${escapeHtml(formatLongDate(stats.firstVerified))} we recorded the bids on ${stats.total} ${escapeHtml(stats.providers.join(", ") || "registrar")} ${escapeHtml(stats.tlds.join(", "))} auctions that our scores had picked for publishing (not a random draw; the sample is described in full in the <a href="/guides/should-i-bid-on-a-domain-with-low-bid-count">low bid count guide</a>). ${stats.zeroBids} of them had no bids at that point, so these amounts are almost all opening bids, not prices anyone agreed to pay. Every one of these auctions has since closed.</p>
        <table>
          <thead><tr><th>Recorded bid</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Lowest (seen on ${stats.atMinimumPrice} auctions)</td><td>${escapeHtml(formatUsd(stats.minPrice))}</td></tr>
            <tr><td>Median</td><td>${escapeHtml(formatUsd(stats.medianPrice))}</td></tr>
            <tr><td>Highest</td><td>${escapeHtml(formatUsd(stats.maxPrice))}</td></tr>
          </tbody>
        </table>
        <p>An opening bid is the floor the auction starts from, not an estimate of value, so it cannot anchor your maximum. Work out your number with the method above and treat the opening bid only as the least you would pay. </p>
      </section>`;
}

function renderSnapshotSection(stats, kind = "bid-count") {
  if (!stats) return "";
  return kind === "opening-bids" ? renderOpeningBidSection(stats) : renderBidCountSection(stats);
}

function renderTable(table) {
  const head = table.headers.map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join("");
  const rows = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="guide-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderList(items, ordered = false) {
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
}

function renderSection(section) {
  const parts = [`<h2>${escapeHtml(section.heading)}</h2>`];
  const paragraphs = section.paragraphs || [];
  // Lead-in paragraphs precede ordered steps; otherwise notes follow the table.
  if (section.ordered) {
    paragraphs.forEach((text) => parts.push(`<p>${escapeHtml(text)}</p>`));
    parts.push(renderList(section.ordered, true));
  }
  if (section.list) parts.push(renderList(section.list));
  if (section.table) parts.push(renderTable(section.table));
  if (!section.ordered) paragraphs.forEach((text) => parts.push(`<p>${escapeHtml(text)}</p>`));
  return `<section class="guide-section">${parts.join("\n")}</section>`;
}

function guideUrl(baseUrl, slug) {
  return `${baseUrl}/guides/${slug}`;
}

function buildBreadcrumbSchema(baseUrl, items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildFaqSchema(faqs) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

function articleId(baseUrl, slug) {
  return `${guideUrl(baseUrl, slug)}#article`;
}

function buildArticleSchema(baseUrl, guide) {
  const url = guideUrl(baseUrl, guide.slug);
  return {
    "@type": "Article",
    "@id": articleId(baseUrl, guide.slug),
    headline: guide.question,
    description: guide.description,
    url,
    image: `${baseUrl}/assets/domain-og-default.png`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url, isPartOf: { "@id": websiteId(baseUrl) } },
    isPartOf: { "@id": `${baseUrl}/guides#collection` },
    about: { "@type": "Thing", name: "Expired domain auction", sameAs: "https://en.wikipedia.org/wiki/Domain_drop_catching" },
    datePublished: PUBLISHED,
    dateModified: MODIFIED,
    author: { "@id": orgId(baseUrl) },
    publisher: { "@id": orgId(baseUrl) },
    inLanguage: "en",
  };
}

const PAGE_STYLES = `
      body { background: #f8f7f4; color: #111827; }
      .guide-main { max-width: 820px; margin: 0 auto; padding: 24px 20px 48px; font: 16px/1.65 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .guide-crumbs { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
      .guide-crumbs a, .guide-main a { color: #0044ff; }
      .guide-main h1 { margin: 0 0 16px; font-size: 2rem; line-height: 1.2; }
      .guide-answer { font-size: 1.08rem; color: #1f2937; }
      .guide-meta { font-size: 13px; color: #6b7280; }
      .guide-section { margin: 32px 0; }
      .guide-section h2 { margin: 0 0 12px; font-size: 1.35rem; }
      .guide-table { overflow-x: auto; }
      .guide-main table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
      .guide-main th, .guide-main td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
      .guide-main th { background: #f3f4f6; }
      .guide-next { background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid #0044ff; border-radius: 8px; padding: 12px 16px; }
      .guide-faq h3 { font-size: 1.05rem; margin: 18px 0 4px; }
      .guide-list { list-style: none; padding: 0; }
      .guide-list li { margin: 0 0 16px; }
      .guide-sources { font-size: 14px; }
      .guides-nav { max-width: 820px; margin: 0 auto; padding: 16px 20px 40px; border-top: 1px solid #e5e7eb; font: 14px/1.6 Inter, -apple-system, sans-serif; }
      .guides-nav ul { padding-left: 18px; }
      .guides-nav a { color: #0044ff; }`;

function renderGuidesNav(currentSlug = null) {
  const links = GUIDES.map((guide) =>
    guide.slug === currentSlug
      ? `<li aria-current="page">${escapeHtml(guide.question)}</li>`
      : `<li><a href="/guides/${escapeHtml(guide.slug)}">${escapeHtml(guide.question)}</a></li>`
  ).join("");
  return `<footer class="guides-nav">
      <nav aria-label="Expired domain guides">
        <strong><a href="/guides">Expired domain guides</a></strong>
        <ul>${links}</ul>
        <p><a href="/experiments/intent-fetch/">Domain finder</a> · <a href="/methodology/">Methodology</a> · <a href="/data/">Data</a></p>
      </nav>
    </footer>`;
}

function renderDocument({ title, description, canonical, schemas, body, currentSlug, ogType = "article", baseUrl }) {
  return renderPageDocument({
    title,
    description,
    canonical,
    robots: "index,follow",
    ogType,
    baseUrl,
    nodes: schemas,
    styles: PAGE_STYLES,
    body: `    <main class="guide-main">
${body}
    </main>
    ${renderGuidesNav(currentSlug)}`,
    currentPath: "/guides",
    bodyClass: "snatch-app guides-page",
  });
}

function renderGuidePage(slug, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL, options = {}) {
  const guide = getGuide(slug);
  if (!guide) return null;
  const baseUrl = metadataBaseUrl;
  const canonical = guideUrl(baseUrl, guide.slug);
  const stats = guide.dataSection ? getAuctionSnapshotStats(options.batchPath) : null;
  const dataKind = guide.dataSection === "opening-bids" ? "opening-bids" : "bid-count";

  const schemas = [
    buildArticleSchema(baseUrl, guide),
    buildFaqSchema(guide.faqs),
    buildBreadcrumbSchema(baseUrl, [
      { name: "Home", url: `${baseUrl}/` },
      { name: "Guides", url: `${baseUrl}/guides` },
      { name: guide.question, url: canonical },
    ]),
  ];

  const related = guide.related
    .map(getGuide)
    .filter(Boolean)
    .map((item) => `<li><a href="/guides/${escapeHtml(item.slug)}">${escapeHtml(item.question)}</a></li>`)
    .join("");

  const sources = guide.sources
    .map((key) => SOURCES[key])
    .filter(Boolean)
    .map((source) => `<li><a href="${escapeHtml(source.url)}" rel="nofollow noopener">${escapeHtml(source.label)}</a></li>`)
    .join("");

  const body = `      <p class="guide-crumbs"><a href="/">Home</a> › <a href="/guides">Guides</a></p>
      <article>
        <h1>${escapeHtml(guide.question)}</h1>
        ${guide.answer.map((text, index) => `<p class="${index === 0 ? "guide-answer" : ""}">${escapeHtml(text)}</p>`).join("\n        ")}
        <p class="guide-meta">Updated ${escapeHtml(MODIFIED)}.</p>
        ${guide.sections.map(renderSection).join("\n        ")}
        ${stats ? renderSnapshotSection(stats, dataKind) : ""}
        <section class="guide-section">
          <h2>Decision checklist</h2>
          ${renderList(guide.checklist)}
        </section>
        <section class="guide-section">
          <h2>When not to do it</h2>
          ${renderList(guide.whenNot)}
        </section>
        <section class="guide-section">
          <h2>Common mistakes</h2>
          ${renderList(guide.mistakes)}
        </section>
        <section class="guide-section">
          <h2>Next step</h2>
          <p class="guide-next">${escapeHtml(guide.nextStep)}</p>
        </section>
        <section class="guide-section guide-faq">
          <h2>Frequently asked questions</h2>
          ${guide.faqs.map((faq) => `<h3>${escapeHtml(faq.q)}</h3>\n          <p>${escapeHtml(faq.a)}</p>`).join("\n          ")}
        </section>
        <section class="guide-section">
          <h2>Related guides</h2>
          <ul>${related}</ul>
        </section>
        <section class="guide-section guide-sources">
          <h2>Sources</h2>
          <ul>${sources}</ul>
        </section>
      </article>`;

  return renderDocument({
    title: `${guide.title} | ${SITE_NAME}`,
    description: guide.description,
    canonical,
    schemas,
    body,
    currentSlug: guide.slug,
    ogType: "article",
    baseUrl,
  });
}

function renderGuidesIndexPage(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const baseUrl = metadataBaseUrl;
  const canonical = `${baseUrl}/guides`;
  const schemas = [
    {
      "@type": "CollectionPage",
      "@id": `${canonical}#collection`,
      name: GUIDES_INDEX_TITLE,
      description: GUIDES_INDEX_DESCRIPTION,
      url: canonical,
      isPartOf: { "@id": websiteId(baseUrl) },
      publisher: { "@id": orgId(baseUrl) },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: GUIDES.map((guide, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: guideUrl(baseUrl, guide.slug),
          item: { "@id": articleId(baseUrl, guide.slug), "@type": "Article", headline: guide.question, url: guideUrl(baseUrl, guide.slug) },
        })),
      },
    },
    buildBreadcrumbSchema(baseUrl, [
      { name: "Home", url: `${baseUrl}/` },
      { name: "Guides", url: canonical },
    ]),
  ];

  const items = GUIDES.map(
    (guide) => `<li><a href="/guides/${escapeHtml(guide.slug)}"><strong>${escapeHtml(guide.question)}</strong></a><br />${escapeHtml(guide.answer[0])}</li>`
  ).join("\n          ");

  const body = `      <p class="guide-crumbs"><a href="/">Home</a> › Guides</p>
      <h1>Expired domain auction guides</h1>
      <p class="guide-answer">Short decision guides for buying expired domains: how registrar auctions and backorders work, what to check before you bid, how to set a maximum bid, and when a brand-new domain is the better choice. Each guide answers one question directly, then gives a checklist, the cases where you should not do it, and a concrete next step.</p>
      <section class="guide-section">
        <ul class="guide-list">
          ${items}
        </ul>
      </section>`;

  return renderDocument({
    title: `${GUIDES_INDEX_TITLE} | ${SITE_NAME}`,
    description: GUIDES_INDEX_DESCRIPTION,
    canonical,
    schemas,
    body,
    currentSlug: null,
    ogType: "website",
    baseUrl,
  });
}

// Returns { type: "index" } or { type: "guide", slug } for guide routes, else null.
function resolveGuideRoute(pathname) {
  const clean = String(pathname || "").replace(/\/+$/, "");
  if (clean === "/guides") return { type: "index" };
  const match = clean.match(/^\/guides\/([a-z0-9-]+)$/);
  if (match && getGuide(match[1])) return { type: "guide", slug: match[1] };
  return null;
}

module.exports = {
  getAuctionSnapshotStats,
  renderGuidePage,
  renderGuidesIndexPage,
  resolveGuideRoute,
};
