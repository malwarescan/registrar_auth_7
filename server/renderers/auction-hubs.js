// Hub pages for the current batch of NameSilo expired-domain auctions.
//
// Individual auctions last a few days, so their pages come and go. These hubs
// keep stable URLs whose content is rebuilt from whatever data is loaded:
// /auctions is always indexable; a sub-hub is indexable only while it lists at
// least MIN_HUB_ITEMS running auctions, and is noindex (and out of the
// sitemap) otherwise.
const { listDurableCandidates } = require("../candidate-store/durable-candidates");
const { resolveLifecycleState, hasAuctionEnded } = require("../candidate-store/product-lifecycle");
const { indexRank, indexRejection } = require("../candidate-store/indexing-policy");
const { isIndexNowTier } = require("../candidate-store/seo-tier");
const { getAuctionDataMeta } = require("../candidate-store/auction-snapshot");
const { describeAuctionData, formatLongDate } = require("./auction-data-label");
const { SITE_NAME, orgId, websiteId, escapeHtml } = require("../site-identity");
const { renderPageDocument } = require("./site-layout");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

const MIN_HUB_ITEMS = 5;
const HUB_LIST_LIMIT = 100;
const CLEAN_FLAGS = new Set(["random-string", "gibberish", "hard-to-pronounce", "confusing-spelling", "repeated-characters", "excessive-length"]);

function isClean(record) {
  return !(record.qualityFlags || []).some((flag) => CLEAN_FLAGS.has(flag));
}

function byBids(a, b) {
  return (b.bidCount || 0) - (a.bidCount || 0) || (b.currentBid || 0) - (a.currentBid || 0) || a.domain.localeCompare(b.domain);
}

function byRank(a, b) {
  return indexRank(b) - indexRank(a) || a.domain.localeCompare(b.domain);
}

const SUB_HUBS = {
  "with-bids": {
    slug: "with-bids",
    title: "Expired Domain Auctions With Bids This Week",
    shortTitle: "Auctions with bids",
    h1: "Expired domain auctions that already have bids",
    intro:
      "Most expired-domain auctions close without a single bid, so the few that attract bidders stand out. These are the running NameSilo auctions with at least one bid, most-bid first.",
    filter: (record) => (record.bidCount || 0) > 0,
    sort: byBids,
  },
  "dot-com": {
    slug: "dot-com",
    title: "Expiring .com Domain Auctions: Clean Names Ending Soon",
    shortTitle: ".com auctions",
    h1: "Expiring .com domain auctions",
    intro:
      "Running NameSilo auctions for .com names that are easy to say and spell: no digits mixed into letters, no random strings, no hyphen chains. Best-scoring first, with any bids pushed to the top.",
    filter: (record) => record.tld === ".com" && isClean(record),
    sort: byRank,
  },
  "word-names": {
    slug: "word-names",
    title: "Expiring Domains Made of Real Words",
    shortTitle: "Real-word names",
    h1: "Expiring domains made of real words",
    intro:
      "Running NameSilo auctions whose names split cleanly into one to three common English words, such as a noun plus a noun. These are the names a listener can spell after hearing them once.",
    filter: (record) => (record.baseSignals?.words?.length || 0) > 0 && isClean(record),
    sort: byRank,
  },
};

function hubPath(slug) {
  return slug ? `/auctions/${slug}` : "/auctions";
}

function listRunningAuctions(now = Date.now()) {
  return listDurableCandidates().filter((record) => record?.domain && resolveLifecycleState(record, now) === "active");
}

function listHubRecords(slug, now = Date.now(), running = listRunningAuctions(now)) {
  const hub = SUB_HUBS[slug];
  if (!hub) return [];
  return running.filter(hub.filter).sort(hub.sort);
}

function isHubIndexable(slug, now = Date.now()) {
  if (!slug) return true;
  return listHubRecords(slug, now).length >= MIN_HUB_ITEMS;
}

// Hub paths for the sitemap, with lastmod = when the data was fetched.
function listIndexableHubEntries(now = Date.now()) {
  const meta = getAuctionDataMeta();
  const running = listRunningAuctions(now);
  const lastmod = meta?.fetchedAt || null;
  const entries = [{ pathname: hubPath(""), lastmod }];
  for (const slug of Object.keys(SUB_HUBS)) {
    if (listHubRecords(slug, now, running).length >= MIN_HUB_ITEMS) entries.push({ pathname: hubPath(slug), lastmod });
  }
  return entries;
}

function resolveAuctionHubRoute(pathname) {
  if (pathname === "/auctions") return { slug: "" };
  const match = String(pathname).match(/^\/auctions\/([a-z-]+)$/);
  if (match && SUB_HUBS[match[1]]) return { slug: match[1] };
  return null;
}

function formatUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return `$${n.toFixed(Number.isInteger(n) ? 0 : 2)}`;
}

function formatEnds(iso) {
  if (!iso) return "–";
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${date.toISOString().slice(11, 16)} UTC`;
}

function registeredYear(record) {
  return record.domainCreatedAt ? String(new Date(record.domainCreatedAt).getUTCFullYear()) : "–";
}

function renderAuctionTable(records, options = {}) {
  if (!records.length) return `<p class="hub-empty">${escapeHtml(options.emptyText || "No running auctions match this list in the latest data.")}</p>`;
  const rows = records
    .map(
      (record) => `<tr><td><a href="/domains/${escapeHtml(record.slug)}">${escapeHtml(record.domain)}</a></td><td>${escapeHtml(formatUsd(record.currentBid))}</td><td>${record.bidCount || 0}</td><td>${escapeHtml(registeredYear(record))}</td><td>${escapeHtml(formatEnds(record.auctionEndsAt))}</td></tr>`
    )
    .join("");
  return `<div class="hub-table"><table><thead><tr><th scope="col">Domain</th><th scope="col">Current bid</th><th scope="col">Bids</th><th scope="col">First registered</th><th scope="col">Ends</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function buildItemList(baseUrl, url, records) {
  return {
    "@type": "ItemList",
    "@id": `${url}#list`,
    numberOfItems: records.length,
    itemListElement: records.slice(0, 50).map((record, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${baseUrl}/domains/${record.slug}`,
      name: record.domain,
    })),
  };
}

function buildHubNodes(baseUrl, url, title, description, records, crumbs, dateModified) {
  return [
    {
      "@type": "CollectionPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { "@id": websiteId(baseUrl) },
      publisher: { "@id": orgId(baseUrl) },
      ...(dateModified ? { dateModified } : {}),
      mainEntity: { "@id": `${url}#list` },
      breadcrumb: { "@id": `${url}#breadcrumbs` },
    },
    buildItemList(baseUrl, url, records),
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: crumb.url })),
    },
  ];
}

const HUB_STYLES = `
      .hub-main { max-width: 960px; margin: 0 auto; padding: 8px 20px 40px; font: 16px/1.65 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .hub-main a { color: #0044ff; }
      .hub-crumbs { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
      .hub-main h1 { margin: 0 0 12px; font-size: 2rem; line-height: 1.2; }
      .hub-main h2 { margin: 32px 0 12px; font-size: 1.3rem; }
      .hub-data { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin: 16px 0 24px; font-size: 15px; }
      .hub-table { overflow-x: auto; }
      .hub-main table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
      .hub-main th, .hub-main td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
      .hub-main th { background: #f3f4f6; }
      .hub-links { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 0; list-style: none; }
      .hub-empty { color: #4b5563; }`;

function renderDataBox(label) {
  if (!label) return `<div class="hub-data"><p>No auction data is loaded right now.</p></div>`;
  return `<div class="hub-data"><p>${escapeHtml(label.sentence)}</p><p>Bids, counts and end times are as they stood at that moment. Always confirm the current bid and end time on NameSilo before bidding.</p></div>`;
}

function renderGuideLinks() {
  return `<h2>Before you bid</h2>
      <ul>
        <li><a href="/guides/should-i-bid-on-a-domain-with-low-bid-count">Should I bid on a domain with a low bid count?</a></li>
        <li><a href="/guides/how-to-estimate-a-fair-bid-for-an-expired-domain">How to estimate a fair bid for an expired domain</a></li>
        <li><a href="/guides">All expired-domain guides</a> · <a href="/methodology/">How we score names</a> · <a href="/data/">Download the data</a></li>
      </ul>`;
}

function renderSubHubPage(slug, baseUrl, now) {
  const hub = SUB_HUBS[slug];
  const url = `${baseUrl}${hubPath(slug)}`;
  const label = describeAuctionData(getAuctionDataMeta(), now);
  const all = listHubRecords(slug, now);
  const shown = all.slice(0, HUB_LIST_LIMIT);
  const indexable = all.length >= MIN_HUB_ITEMS;
  const countLine = all.length
    ? `${all.length.toLocaleString("en-US")} running auction${all.length === 1 ? "" : "s"} match${all.length === 1 ? "es" : ""} this list${all.length > shown.length ? `; the top ${shown.length} are shown` : ""}.`
    : "";
  const description = `${hub.intro.split(". ")[0]}. Updated from NameSilo's auction data${label ? ` (fetched ${label.fetchedDate})` : ""}.`;
  const crumbs = [
    { name: "Home", url: `${baseUrl}/` },
    { name: "Auctions", url: `${baseUrl}/auctions` },
    { name: hub.shortTitle, url },
  ];
  const otherHubs = Object.values(SUB_HUBS)
    .filter((entry) => entry.slug !== slug)
    .map((entry) => `<li><a href="${hubPath(entry.slug)}">${escapeHtml(entry.shortTitle)}</a></li>`)
    .join("");
  const body = `    <main class="hub-main">
      <p class="hub-crumbs"><a href="/">Home</a> › <a href="/auctions">Auctions</a> › ${escapeHtml(hub.shortTitle)}</p>
      <h1>${escapeHtml(hub.h1)}</h1>
      <p>${escapeHtml(hub.intro)}</p>
      ${renderDataBox(label)}
      ${countLine ? `<p>${escapeHtml(countLine)}</p>` : ""}
      ${renderAuctionTable(shown, { emptyText: "No running auctions match this list in the latest data. New NameSilo auctions start every day; check back soon." })}
      <h2>More lists</h2>
      <ul class="hub-links"><li><a href="/auctions">All auctions this week</a></li>${otherHubs}</ul>
      ${renderGuideLinks()}
    </main>`;
  return renderPageDocument({
    title: `${hub.title} | ${SITE_NAME}`,
    description,
    canonical: url,
    robots: indexable ? "index,follow" : "noindex,follow",
    baseUrl,
    nodes: buildHubNodes(baseUrl, url, hub.title, description, shown, crumbs, label?.fetchedAt),
    styles: HUB_STYLES,
    body,
    currentPath: "/auctions",
  });
}

function renderMainHubPage(baseUrl, now) {
  const url = `${baseUrl}/auctions`;
  const meta = getAuctionDataMeta();
  const label = describeAuctionData(meta, now);
  const running = listRunningAuctions(now);
  const picks = running.filter((record) => isIndexNowTier(record, now) && indexRejection(record, now) === null).sort(byRank).slice(0, 24);
  const title = "Expiring Domain Auctions This Week: NameSilo Expired Domains";
  const description =
    "This week's NameSilo expired-domain auctions, checked for spam and sorted into lists: names with bids, clean .com names and real-word names. Each list shows the current bid, bid count, first registration year and end time.";
  const crumbs = [
    { name: "Home", url: `${baseUrl}/` },
    { name: "Auctions", url },
  ];
  const hubLinks = Object.values(SUB_HUBS)
    .map((hub) => {
      const count = listHubRecords(hub.slug, now, running).length;
      return `<li><a href="${hubPath(hub.slug)}">${escapeHtml(hub.shortTitle)}</a> (${count.toLocaleString("en-US")} running)</li>`;
    })
    .join("");
  const tldRows = (meta?.stats?.topTlds || [])
    .map((entry) => `<tr><td>${escapeHtml(entry.tld)}</td><td>${entry.count.toLocaleString("en-US")}</td></tr>`)
    .join("");
  const notEnded = listDurableCandidates().filter((record) => !hasAuctionEnded(record, now)).length;
  const runningLine = notEnded
    ? `${notEnded.toLocaleString("en-US")} of these auctions are still running.`
    : `None of the auctions in the latest data are still running${meta?.stats?.lastEnd ? ` (the last one ended on ${formatLongDate(meta.stats.lastEnd)})` : ""}. New NameSilo auctions start every day; the lists below fill again when the data is next refreshed.`;
  const body = `    <main class="hub-main">
      <p class="hub-crumbs"><a href="/">Home</a> › Auctions</p>
      <h1>Expiring domain auctions this week</h1>
      <p>NameSilo auctions domains that their owners did not renew. Each auction is short: it opens at a low starting bid (usually $1) and closes within days, and most close with no bids at all. This page sorts the current batch so you can skip the spam and look at names worth a second look.</p>
      ${renderDataBox(label)}
      <p>${escapeHtml(runningLine)}</p>
      <h2>Lists</h2>
      <ul>${hubLinks}</ul>
      <h2>Our picks from this batch</h2>
      <p>Running auctions whose names are made of common words, are easy to say, use a widely trusted extension and score well on our <a href="/methodology/">name scores</a>, with names that already have bids first. Picks are suggestions, not valuations.</p>
      ${renderAuctionTable(picks, { emptyText: "No running auction in the latest data meets the bar for a pick." })}
      ${tldRows ? `<h2>Extensions in this batch</h2><div class="hub-table"><table><thead><tr><th scope="col">Extension</th><th scope="col">Auctions</th></tr></thead><tbody>${tldRows}</tbody></table></div>` : ""}
      <h2>How we filter</h2>
      <p>We leave out adult, gambling, piracy, drug, brand look-alike and test names entirely. Names that read as random strings of letters and digits stay listed in our <a href="/data/domain-listings">data feed</a> but never make a pick. The rules are on the <a href="/methodology/">methodology page</a>.</p>
      ${renderGuideLinks()}
    </main>`;
  return renderPageDocument({
    title: `${title} | ${SITE_NAME}`,
    description,
    canonical: url,
    robots: "index,follow",
    baseUrl,
    nodes: buildHubNodes(baseUrl, url, title, description, picks, crumbs, label?.fetchedAt),
    styles: HUB_STYLES,
    body,
    currentPath: "/auctions",
  });
}

function renderAuctionHubPage(slug, baseUrl = DEFAULT_PUBLIC_BASE_URL, options = {}) {
  const now = options.now ?? Date.now();
  if (!slug) return renderMainHubPage(baseUrl, now);
  if (!SUB_HUBS[slug]) return null;
  return renderSubHubPage(slug, baseUrl, now);
}

module.exports = {
  MIN_HUB_ITEMS,
  SUB_HUBS,
  hubPath,
  listHubRecords,
  isHubIndexable,
  listIndexableHubEntries,
  resolveAuctionHubRoute,
  renderAuctionHubPage,
};
