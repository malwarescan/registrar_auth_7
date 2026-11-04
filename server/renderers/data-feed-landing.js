const {
  countDurableCandidates,
  listDurableCandidates,
} = require("../candidate-store/durable-candidates");
const { countListingCandidates } = require("../candidate-store/listing-feed");
const { hasAuctionEnded } = require("../candidate-store/product-lifecycle");
const { renderDomainListingRecord } = require("./listing-feed-renderer");
const { buildGraphFeedRecord } = require("./graph-feed-renderer");
const { renderDomainListingsDatasetMetadata, dataHubDatasetId } = require("./dataset-metadata-renderer");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { SITE_NAME, orgId, websiteId, namesiloId, escapeHtml } = require("../site-identity");
const { renderPageDocument, renderSiteHeadTags } = require("./site-layout");
const { describeAuctionData } = require("./auction-data-label");

const UPDATE_FREQUENCY =
  "Records come from NameSilo's auction API and are re-fetched every 6 hours when the site's API connection is on; otherwise the last fetched copy is served. Each record's status is recalculated from its auction end time every time it is served.";
const LICENSE_NOTE = "Free to read and reuse with attribution to the site. Auction facts belong to NameSilo; check them on NameSilo before acting.";

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Plain-language summary of what the shipped snapshot contains right now.
function getSnapshotSummary() {
  const records = listDurableCandidates();
  const ends = records.map((record) => record.auctionEndsAt).filter(Boolean).sort();
  const checked = records.map((record) => record.statusVerifiedAt).filter(Boolean).sort();
  // Running means the end time has not passed yet.
  const live = records.filter((record) => !hasAuctionEnded(record)).length;
  return {
    total: records.length,
    live,
    ended: records.length - live,
    firstEnd: ends[0] || null,
    lastEnd: ends[ends.length - 1] || null,
    lastChecked: checked[checked.length - 1] || null,
  };
}

function getFeedStats(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return {
    metadataBaseUrl,
    listingsAll: countListingCandidates("all", { metadataBaseUrl }),
    listingsIndexed: countListingCandidates("indexed", { metadataBaseUrl }),
    listingsActive: countListingCandidates("active", { metadataBaseUrl }),
    listingsArchive: countListingCandidates("archive", { metadataBaseUrl }),
    catalogTotal: countDurableCandidates(),
    graphTotal: countDurableCandidates(),
  };
}

// Dataset node for the /data/ hub. Kept under its historical export name.
function renderHomepageDatasetSchema(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return {
    "@context": "https://schema.org",
    ...renderDataHubDatasetNode(metadataBaseUrl),
  };
}

function renderDataHubDatasetNode(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const summary = getSnapshotSummary();
  return {
    "@type": "Dataset",
    "@id": dataHubDatasetId(metadataBaseUrl),
    name: `${SITE_NAME} expired-domain auction data`,
    description:
      "Expired-domain auction records collected from public NameSilo auctions, with each name's recorded bid, end time, status and name-quality scores, published as listing, catalog and graph feeds.",
    url: `${metadataBaseUrl}/data/`,
    creator: { "@id": orgId(metadataBaseUrl) },
    publisher: { "@id": orgId(metadataBaseUrl) },
    isBasedOn: { "@id": namesiloId(metadataBaseUrl) },
    ...(summary.lastChecked ? { dateModified: summary.lastChecked } : {}),
    ...(summary.firstEnd && summary.lastEnd ? { temporalCoverage: `${summary.firstEnd.slice(0, 10)}/${summary.lastEnd.slice(0, 10)}` } : {}),
    license: `${metadataBaseUrl}/data/#license`,
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson` },
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${metadataBaseUrl}/api/domain-feed.ndjson` },
      { "@type": "DataDownload", encodingFormat: "application/x-ndjson", contentUrl: `${metadataBaseUrl}/api/domain-graph.ndjson` },
    ],
    variableMeasured: ["domain", "auction status", "recorded bid", "bid count", "auction end time", "category", "name-quality scores"],
  };
}

function renderDataFeedSchema(options = {}) {
  const {
    name,
    description,
    feedUrl,
    landingUrl,
    recordCount = 0,
    encodingFormat = "application/x-ndjson",
    exampleElements = [],
    metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL,
  } = options;

  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    "@id": `${landingUrl}#datafeed`,
    name,
    description,
    url: landingUrl,
    encodingFormat,
    isPartOf: { "@id": dataHubDatasetId(metadataBaseUrl) },
    creator: { "@id": orgId(metadataBaseUrl) },
    dataFeedElement: exampleElements.slice(0, 5).map((item, index) => ({
      "@type": "DataFeedItem",
      position: index + 1,
      item,
    })),
    ...(recordCount ? { numberOfItems: recordCount } : {}),
    ...(feedUrl ? { contentUrl: feedUrl } : {}),
  };
}

function renderDiscoveryHeadLinks(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return `
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-listings.ndjson" title="Domain Listings Feed" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-feed.ndjson" title="Domain Catalog Feed" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-graph.ndjson" title="Domain Graph Feed" />
    <link rel="describedby" type="application/json" href="/api/domain-listings.dataset.json" title="Feed Dataset Metadata" />
    <link rel="help" href="${metadataBaseUrl}/data/" title="Domain data feeds" />`;
}

const STATIC_PAGE_NODES = {
  "/": (baseUrl) => ({
    "@type": "WebPage",
    "@id": `${baseUrl}/#webpage`,
    url: `${baseUrl}/`,
    name: "Find expired domain auctions worth bidding on",
    isPartOf: { "@id": websiteId(baseUrl) },
    publisher: { "@id": orgId(baseUrl) },
    about: { "@type": "Thing", name: "Expired domain auction", sameAs: "https://en.wikipedia.org/wiki/Domain_drop_catching" },
    hasPart: [
      { "@id": `${baseUrl}/experiments/intent-fetch/#webapp` },
      { "@id": `${baseUrl}/guides#collection` },
      { "@id": dataHubDatasetId(baseUrl) },
    ],
  }),
  "/experiments/intent-fetch": (baseUrl) => [
    {
      "@type": "WebApplication",
      "@id": `${baseUrl}/experiments/intent-fetch/#webapp`,
      name: "Expired domain finder",
      url: `${baseUrl}/experiments/intent-fetch/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (web browser)",
      description:
        "Describe what you are building and the finder searches current NameSilo expired-domain auctions for names that fit, with scores and the auction link for each.",
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      publisher: { "@id": orgId(baseUrl) },
      isPartOf: { "@id": websiteId(baseUrl) },
    },
    {
      "@type": "WebPage",
      "@id": `${baseUrl}/experiments/intent-fetch/#webpage`,
      url: `${baseUrl}/experiments/intent-fetch/`,
      name: "Expired domain finder",
      isPartOf: { "@id": websiteId(baseUrl) },
      publisher: { "@id": orgId(baseUrl) },
      mainEntity: { "@id": `${baseUrl}/experiments/intent-fetch/#webapp` },
    },
  ],
};

// Adds the site graph (Organization, WebSite, page node) and feed discovery
// links to the static homepage and finder. No Dataset here: it lives on /data/.
function injectHomeDiscovery(html, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL, pathname = "/") {
  const normalized = String(pathname || "/").replace(/\/+$/, "") || "/";
  const builder = STATIC_PAGE_NODES[normalized] || STATIC_PAGE_NODES["/"];
  const pageNodes = [].concat(builder(metadataBaseUrl));
  const links = renderDiscoveryHeadLinks(metadataBaseUrl);
  const headTags = renderSiteHeadTags(metadataBaseUrl, { nodes: pageNodes });
  if (html.includes("</head>")) {
    return html.replace("</head>", `${links}\n    ${headTags}\n</head>`);
  }
  return html;
}

// Picks a real, pronounceable record for "example record" blocks: no quality
// flags, a recognisable category, best score, shortest name.
function pickExampleRecord() {
  const records = listDurableCandidates();
  const clean = records
    .filter((record) => record?.slug && record.domain)
    .filter((record) => !(record.qualityFlags || []).length && (record.categoryGuesses || []).length)
    .sort(
      (a, b) =>
        (b.baseScores?.overall ?? 0) - (a.baseScores?.overall ?? 0) ||
        a.domain.length - b.domain.length ||
        a.domain.localeCompare(b.domain)
    );
  return clean[0] || records.find((record) => !(record.qualityFlags || []).includes("random-string")) || null;
}

function sampleListingExample(metadataBaseUrl) {
  const record = pickExampleRecord();
  return record ? renderDomainListingRecord(record, metadataBaseUrl) : null;
}

function sampleGraphExample(metadataBaseUrl) {
  const record = pickExampleRecord();
  return record ? buildGraphFeedRecord(record, metadataBaseUrl) : null;
}

function sampleCatalogExample(metadataBaseUrl) {
  const record = pickExampleRecord();
  if (!record) return null;
  return {
    domain: record.domain,
    slug: record.slug,
    canonicalUrl: `${metadataBaseUrl}/domains/${record.slug}`,
    graphUrl: `${metadataBaseUrl}/api/domains/${record.slug}/graph.json`,
    status: renderDomainListingRecord(record, metadataBaseUrl)?.status || record.status,
  };
}

const FEED_LANDING_PAGES = {
  "domain-listings": {
    slug: "domain-listings",
    title: "Expired Domain Auction Listings Feed",
    shortTitle: "Listings feed",
    eyebrow: "Data feed",
    description:
      "One line per expired-domain auction we recorded on NameSilo: the domain, whether the auction is still running or has ended, the recorded bid and bid count, the end time and our name-quality scores.",
    useFor: "Use it to see which names were on auction, when each auction ends or ended, and how each name scored.",
    feedPath: "/api/domain-listings.ndjson",
    jsonPath: "/api/domain-listings.json",
    scopes: [
      { name: "all", query: "scope=all", note: "every recorded auction with its current status (default)" },
      { name: "active", query: "scope=active", note: "only auctions that have not ended yet" },
      { name: "indexed", query: "scope=indexed", note: "only running auctions whose pages are in our sitemap" },
      { name: "archive", query: "scope=archive", note: "only ended, sold or unavailable auctions" },
    ],
    recordKey: "listingsAll",
    sampleFn: sampleListingExample,
    fields: [
      ["domain", "the domain name"],
      ["status", "auction-active or auction-ended, recalculated from the end time"],
      ["lifecycleState", "active, ended, sold or unavailable"],
      ["robots", "whether the domain's page is indexable"],
      ["auction", "NameSilo auction link, recorded bid, bid count and end time"],
      ["scores", "overall, TLD trust, brandability and pronounceability (0-100)"],
      ["categoryGuesses / buyerUseCases", "what the name signals, when it signals anything"],
      ["statusVerifiedAt", "when the record was last checked against NameSilo"],
    ],
  },
  "domain-feed": {
    slug: "domain-feed",
    title: "Expired Domain Catalog Feed",
    shortTitle: "Catalog feed",
    eyebrow: "Data feed",
    description:
      "The full record for every domain we store, including names that never qualified for search: the complete schema.org graph for each domain page.",
    useFor: "Use it when you need everything we hold on a name, not just the listing summary.",
    feedPath: "/api/domain-feed.ndjson",
    jsonPath: "/api/domain-feed.json",
    scopes: [],
    recordKey: "catalogTotal",
    sampleFn: sampleCatalogExample,
    fields: [
      ["@graph", "schema.org nodes for the domain page (Product, Offer when running, categories, risk signals)"],
      ["slug / domain", "identifiers"],
      ["canonicalUrl", "the domain's page on this site"],
      ["lifecycleState / status", "whether the auction is running or has ended"],
    ],
  },
  "domain-graph": {
    slug: "domain-graph",
    title: "Expired Domain Relationship Graph Feed",
    shortTitle: "Graph feed",
    eyebrow: "Data feed",
    description:
      "The same domains as nodes and links: each domain connected to its auction, the registrar running it, its extension, and the categories and uses the name suggests.",
    useFor: "Use it to load the data into a graph database or to answer questions such as which auctioned names suggest a fintech use.",
    feedPath: "/api/domain-graph.ndjson",
    jsonPath: null,
    scopes: [],
    recordKey: "graphTotal",
    sampleFn: sampleGraphExample,
    fields: [
      ["nodes", "Domain, Offer, Auction, Category, UseCase, Provider, TLD, Intent, Persona, ComparableDomain"],
      ["edges", "hasOffer, listedInAuction, inCategory, supportsUseCase, hasIntent, targetsPersona, listedWith, relatedTo, soldBy"],
    ],
  },
};

const DATA_PAGE_STYLES = `
      .data-main { max-width: 960px; margin: 0 auto; padding: 8px 20px 40px; font: 16px/1.65 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .data-main a { color: #0044ff; }
      .data-crumbs { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #6b7280; margin: 0 0 8px; }
      .data-main h1 { margin: 0 0 12px; font-size: 2rem; line-height: 1.2; }
      .lede { color: #1f2937; font-size: 1.05rem; }
      .feed-meta { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin: 16px 0 24px; }
      .feed-section { margin: 28px 0; }
      .feed-section h2 { margin: 0 0 12px; font-size: 1.3rem; }
      .feed-links { display: flex; flex-wrap: wrap; gap: 12px; }
      .feed-link { font-weight: 600; text-decoration: none; }
      .data-main table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
      .data-main th, .data-main td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
      .data-main th { background: #f3f4f6; }
      .data-main code { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 1px 6px; font-size: 13px; }
      .data-main pre { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; overflow: auto; white-space: pre-wrap; word-break: break-word; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }`;

function renderSnapshotLine(summary) {
  if (!summary.total) return "No auction records are loaded right now.";
  const label = describeAuctionData();
  const liveLine = summary.live
    ? `${summary.live.toLocaleString("en-US")} are still running and ${summary.ended.toLocaleString("en-US")} have ended.`
    : "All of them have ended, so none can be bid on now; the records are kept for reference.";
  if (label) return `${label.sentence} Right now ${liveLine.charAt(0).toLowerCase()}${liveLine.slice(1)}`;
  const range =
    summary.firstEnd && summary.lastEnd
      ? formatDate(summary.firstEnd) === formatDate(summary.lastEnd)
        ? ` ending on ${formatDate(summary.firstEnd)}`
        : ` ending between ${formatDate(summary.firstEnd)} and ${formatDate(summary.lastEnd)}`
      : "";
  const checked = summary.lastChecked ? ` Last checked against NameSilo on ${formatDate(summary.lastChecked)}.` : "";
  return `The current data holds ${summary.total.toLocaleString("en-US")} NameSilo expired-domain auctions${range}. ${liveLine}${checked}`;
}

function renderFeedLandingPage(pageKey, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const page = FEED_LANDING_PAGES[pageKey];
  if (!page) return null;

  const stats = getFeedStats(metadataBaseUrl);
  const summary = getSnapshotSummary();
  const recordCount = stats[page.recordKey] ?? 0;
  const sample = page.sampleFn(metadataBaseUrl);
  const landingUrl = `${metadataBaseUrl}/data/${page.slug}`;
  const feedUrl = `${metadataBaseUrl}${page.feedPath}`;

  const dataFeedSchema = renderDataFeedSchema({
    name: page.title,
    description: page.description,
    feedUrl,
    landingUrl,
    recordCount,
    exampleElements: sample ? [sample] : [],
    metadataBaseUrl,
  });
  delete dataFeedSchema["@context"];
  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${landingUrl}#breadcrumbs`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${metadataBaseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Data", item: `${metadataBaseUrl}/data/` },
      { "@type": "ListItem", position: 3, name: page.shortTitle, item: landingUrl },
    ],
  };
  const hubDataset = renderDataHubDatasetNode(metadataBaseUrl);

  const scopeHtml = page.scopes.length
    ? `<section class="feed-section">
        <h2>Filter the feed</h2>
        <p>Add a <code>scope</code> parameter to the feed URL:</p>
        <ul>${page.scopes.map((scope) => `<li><code>?${escapeHtml(scope.query)}</code>: ${escapeHtml(scope.note)}</li>`).join("")}</ul>
      </section>`
    : "";

  const fieldsHtml = `<section class="feed-section">
      <h2>What each record contains</h2>
      <table><thead><tr><th scope="col">Field</th><th scope="col">Meaning</th></tr></thead><tbody>${page.fields
        .map(([field, meaning]) => `<tr><td><code>${escapeHtml(field)}</code></td><td>${escapeHtml(meaning)}</td></tr>`)
        .join("")}</tbody></table>
    </section>`;

  const exampleHtml = sample
    ? `<section class="feed-section">
        <h2>Example record</h2>
        <p>One real record from the feed (${escapeHtml(sample.domain || "")}):</p>
        <pre>${escapeHtml(JSON.stringify(sample, null, 2))}</pre>
      </section>`
    : "";

  const relatedLinks = Object.values(FEED_LANDING_PAGES)
    .filter((entry) => entry.slug !== page.slug)
    .map((entry) => `<a class="feed-link" href="/data/${escapeHtml(entry.slug)}">${escapeHtml(entry.title)}</a>`)
    .join("");

  const body = `    <main class="data-main">
      <p class="data-crumbs"><a href="/">Home</a> › <a href="/data/">Data</a> › ${escapeHtml(page.shortTitle)}</p>
      <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="lede">${escapeHtml(page.description)}</p>
      <p>${escapeHtml(page.useFor)}</p>
      <div class="feed-meta">
        <p><strong>${recordCount.toLocaleString()}</strong> records in this feed. ${escapeHtml(renderSnapshotLine(summary))}</p>
        <p>Source: public NameSilo expired-domain auctions. ${escapeHtml(UPDATE_FREQUENCY)}</p>
      </div>
      <section class="feed-section">
        <h2>Download</h2>
        <div class="feed-links">
          <a class="feed-link" href="${escapeHtml(page.feedPath)}">NDJSON (one JSON record per line)</a>
          ${page.jsonPath ? `<a class="feed-link" href="${escapeHtml(page.jsonPath)}">JSON</a>` : ""}
          <a class="feed-link" href="/api/domain-listings.dataset.json?raw=1">Dataset description (JSON)</a>
        </div>
      </section>
      ${scopeHtml}
      ${fieldsHtml}
      ${exampleHtml}
      <section class="feed-section">
        <h2>How the scores are worked out</h2>
        <p>Every score is explained on the <a href="/methodology/">methodology page</a>. Scores are directional signals, not valuations.</p>
      </section>
      <section class="feed-section">
        <h2>Other feeds</h2>
        <div class="feed-links"><a class="feed-link" href="/data/">All data feeds</a>${relatedLinks}</div>
      </section>
    </main>`;

  return renderPageDocument({
    title: `${page.title} | ${SITE_NAME}`,
    description: `${page.description} Free NDJSON and JSON downloads.`.slice(0, 300),
    canonical: landingUrl,
    robots: "index,follow",
    ogType: "website",
    baseUrl: metadataBaseUrl,
    nodes: [
      {
        "@type": "WebPage",
        "@id": `${landingUrl}#webpage`,
        url: landingUrl,
        name: page.title,
        isPartOf: { "@id": websiteId(metadataBaseUrl) },
        publisher: { "@id": orgId(metadataBaseUrl) },
        breadcrumb: { "@id": `${landingUrl}#breadcrumbs` },
        mainEntity: { "@id": dataFeedSchema["@id"] },
      },
      breadcrumb,
      hubDataset,
      dataFeedSchema,
    ],
    extraHead: `${renderDiscoveryHeadLinks(metadataBaseUrl)}
    <link rel="alternate" type="application/x-ndjson" href="${escapeHtml(page.feedPath)}" title="${escapeHtml(page.title)}" />
    ${page.jsonPath ? `<link rel="alternate" type="application/json" href="${escapeHtml(page.jsonPath)}" title="${escapeHtml(page.title)} JSON" />` : ""}`,
    styles: DATA_PAGE_STYLES,
    body,
    currentPath: "/data/",
  });
}

function renderDataHubPage(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const stats = getFeedStats(metadataBaseUrl);
  const summary = getSnapshotSummary();
  const hubUrl = `${metadataBaseUrl}/data/`;
  const feeds = Object.values(FEED_LANDING_PAGES);
  const hubDataset = renderDataHubDatasetNode(metadataBaseUrl);
  hubDataset.hasPart = feeds.map((page) => ({ "@id": `${metadataBaseUrl}/data/${page.slug}#datafeed` }));
  const feedNodes = feeds.map((page) => {
    const node = renderDataFeedSchema({
      name: page.title,
      description: page.description,
      feedUrl: `${metadataBaseUrl}${page.feedPath}`,
      landingUrl: `${metadataBaseUrl}/data/${page.slug}`,
      recordCount: stats[page.recordKey] ?? 0,
      metadataBaseUrl,
    });
    delete node["@context"];
    delete node.dataFeedElement;
    return node;
  });

  const rows = feeds
    .map(
      (page) => `<tr><td><a href="/data/${escapeHtml(page.slug)}"><strong>${escapeHtml(page.title)}</strong></a></td><td>${escapeHtml(page.description)} ${escapeHtml(page.useFor)}</td><td>${(stats[page.recordKey] ?? 0).toLocaleString()}</td></tr>`
    )
    .join("");

  const body = `    <main class="data-main">
      <p class="data-crumbs"><a href="/">Home</a> › Data</p>
      <h1>Expired domain auction data</h1>
      <p class="lede">The auction records behind ${escapeHtml(SITE_NAME)}, published as free downloads. Each record is one expired domain that was up for auction on NameSilo, with its recorded bid, end time, status and the scores we give the name.</p>
      <div class="feed-meta">
        <p>${escapeHtml(renderSnapshotLine(summary))}</p>
        <p>Bids are the amounts recorded when we last checked. For auctions with no bids that is the opening bid, not a sale price.</p>
      </div>
      <section class="feed-section">
        <h2>The three feeds</h2>
        <table><thead><tr><th scope="col">Feed</th><th scope="col">What it is</th><th scope="col">Records</th></tr></thead><tbody>${rows}</tbody></table>
      </section>
      <section class="feed-section">
        <h2>Where the data comes from</h2>
        <p>Records come from NameSilo's public expired-domain auction listings. NameSilo runs the auctions; this site only records them and scores the names. A name's status is worked out from its auction end time each time a page or feed is served, so a finished auction is always shown as ended.</p>
        <p>The scores (overall fit, brandability, pronounceability, TLD trust and others) are explained on the <a href="/methodology/">methodology page</a>.</p>
      </section>
      <section class="feed-section" id="license">
        <h2>Using the data</h2>
        <p>${escapeHtml(LICENSE_NOTE)}</p>
        <p>Feeds are plain NDJSON or JSON over HTTPS. Open a feed URL in a browser for a readable preview, or add <code>?view=raw</code> for the raw file.</p>
      </section>
      <section class="feed-section">
        <h2>Before you bid</h2>
        <p>Read the <a href="/guides">expired domain auction guides</a>, starting with <a href="/guides/how-to-check-an-expired-domain-before-bidding">how to check an expired domain before bidding</a>.</p>
      </section>
    </main>`;

  return renderPageDocument({
    title: `Expired Domain Auction Data: Free Listing, Catalog and Graph Feeds | ${SITE_NAME}`,
    description:
      "Free downloads of the expired-domain auction records behind the site: each NameSilo auction's recorded bid, end time, status and name-quality scores, as listing, catalog and graph feeds.",
    canonical: hubUrl,
    robots: "index,follow",
    ogType: "website",
    baseUrl: metadataBaseUrl,
    nodes: [
      {
        "@type": "CollectionPage",
        "@id": `${hubUrl}#webpage`,
        url: hubUrl,
        name: "Expired domain auction data",
        isPartOf: { "@id": websiteId(metadataBaseUrl) },
        publisher: { "@id": orgId(metadataBaseUrl) },
        breadcrumb: { "@id": `${hubUrl}#breadcrumbs` },
        mainEntity: { "@id": hubDataset["@id"] },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${hubUrl}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${metadataBaseUrl}/` },
          { "@type": "ListItem", position: 2, name: "Data", item: hubUrl },
        ],
      },
      hubDataset,
      ...feedNodes,
    ],
    extraHead: renderDiscoveryHeadLinks(metadataBaseUrl),
    styles: DATA_PAGE_STYLES,
    body,
    currentPath: "/data/",
  });
}

function resolveFeedLandingKey(pathname) {
  const match = String(pathname || "").match(/^\/data\/(domain-listings|domain-feed|domain-graph)\/?$/);
  return match ? match[1] : null;
}

module.exports = {
  UPDATE_FREQUENCY,
  FEED_LANDING_PAGES,
  getFeedStats,
  getSnapshotSummary,
  pickExampleRecord,
  renderHomepageDatasetSchema,
  renderDataHubDatasetNode,
  renderDataFeedSchema,
  renderDiscoveryHeadLinks,
  injectHomeDiscovery,
  renderFeedLandingPage,
  renderDataHubPage,
  resolveFeedLandingKey,
};
