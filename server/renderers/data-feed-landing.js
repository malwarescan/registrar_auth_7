const {
  countDurableCandidates,
  listDurableCandidates,
} = require("../candidate-store/durable-candidates");
const { countListingCandidates } = require("../candidate-store/listing-feed");
const { renderDomainListingRecord } = require("./listing-feed-renderer");
const { buildGraphFeedRecord } = require("./graph-feed-renderer");
const { renderDomainListingsDatasetMetadata } = require("./dataset-metadata-renderer");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

const UPDATE_FREQUENCY = "Auction status refreshed on ingest; listing feed TTL 15 minutes.";

function getFeedStats(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return {
    metadataBaseUrl,
    listingsIndexed: countListingCandidates("indexed", { metadataBaseUrl }),
    listingsActive: countListingCandidates("active", { metadataBaseUrl }),
    listingsArchive: countListingCandidates("archive", { metadataBaseUrl }),
    catalogTotal: countDurableCandidates(),
    graphTotal: countDurableCandidates(),
  };
}

function renderHomepageDatasetSchema(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const stats = getFeedStats(metadataBaseUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Snatch Domain Auction Listings",
    description: "Machine-readable catalog of NameSilo domain auction listings, product graphs, and marketplace relationships.",
    url: `${metadataBaseUrl}/data/domain-listings`,
    creator: {
      "@type": "Organization",
      name: "Snatch.auction",
      url: `${metadataBaseUrl}/`,
    },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/x-ndjson",
        contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/x-ndjson",
        contentUrl: `${metadataBaseUrl}/api/domain-feed.ndjson`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/x-ndjson",
        contentUrl: `${metadataBaseUrl}/api/domain-graph.ndjson`,
      },
    ],
    numberOfItems: stats.listingsIndexed,
    variableMeasured: ["domain", "auction status", "current bid", "category", "use case", "provider", "TLD"],
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
  } = options;

  return {
    "@context": "https://schema.org",
    "@type": "DataFeed",
    name,
    description,
    url: landingUrl,
    encodingFormat,
    dataFeedElement: exampleElements.slice(0, 5).map((item, index) => ({
      "@type": "DataFeedItem",
      position: index + 1,
      item: item,
    })),
    ...(recordCount ? { numberOfItems: recordCount } : {}),
    ...(feedUrl ? { contentUrl: feedUrl } : {}),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDiscoveryHeadLinks(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return `
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-listings.ndjson" title="Domain Listings Feed" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-feed.ndjson" title="Domain Catalog Feed" />
    <link rel="alternate" type="application/x-ndjson" href="/api/domain-graph.ndjson" title="Domain Graph Feed" />
    <link rel="describedby" type="application/json" href="/api/domain-listings.dataset.json" title="Feed Dataset Metadata" />
    <link rel="help" href="${metadataBaseUrl}/data/domain-listings" title="Domain data feeds" />`;
}

function injectHomeDiscovery(html, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const dataset = renderHomepageDatasetSchema(metadataBaseUrl);
  const links = renderDiscoveryHeadLinks(metadataBaseUrl);
  const schemaScript = `<script type="application/ld+json">${JSON.stringify(dataset).replace(/<\/script/gi, "<\\/script")}</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${links}\n${schemaScript}\n</head>`);
  }
  return html;
}

function sampleListingExample(metadataBaseUrl) {
  const records = listDurableCandidates({ limit: 1 });
  if (!records.length) return null;
  return renderDomainListingRecord(records[0], metadataBaseUrl);
}

function sampleGraphExample(metadataBaseUrl) {
  const records = listDurableCandidates({ limit: 1 });
  if (!records.length) return null;
  return buildGraphFeedRecord(records[0], metadataBaseUrl);
}

function sampleCatalogExample(metadataBaseUrl) {
  const records = listDurableCandidates({ limit: 1 });
  if (!records.length) return null;
  const record = records[0];
  return {
    domain: record.domain,
    slug: record.slug,
    canonicalUrl: `${metadataBaseUrl}/domains/${record.slug}`,
    graphUrl: `${metadataBaseUrl}/api/domains/${record.slug}/graph.json`,
    seoTier: record.seoTier,
    status: record.status,
  };
}

const FEED_LANDING_PAGES = {
  "domain-listings": {
    slug: "domain-listings",
    title: "Domain Listings Feed",
    eyebrow: "Public listing feed",
    description:
      "Machine-readable export of domain auction product listings. Default scope is index-now / sitemap-aligned active listings.",
    feedPath: "/api/domain-listings.ndjson",
    jsonPath: "/api/domain-listings.json",
    scopes: [
      { name: "indexed", query: "scope=indexed", note: "index-now tier, sitemap-aligned (default)" },
      { name: "active", query: "scope=active", note: "all active auction product pages" },
      { name: "archive", query: "scope=archive", note: "ended, sold, or unavailable listings" },
    ],
    recordKey: "listingsIndexed",
    sampleFn: sampleListingExample,
    fields: [
      "type",
      "domain",
      "slug",
      "url",
      "canonicalUrl",
      "status",
      "lifecycleState",
      "seoTier",
      "robots",
      "provider",
      "source",
      "auction",
      "scores",
      "categoryGuesses",
      "buyerUseCases",
      "graphUrl",
      "updatedAt",
      "statusVerifiedAt",
    ],
  },
  "domain-feed": {
    slug: "domain-feed",
    title: "Domain Catalog Feed",
    eyebrow: "Full durable catalog",
    description:
      "Internal/full machine feed with graph payloads for all durable domain product records in the catalog store.",
    feedPath: "/api/domain-feed.ndjson",
    jsonPath: "/api/domain-feed.json",
    scopes: [],
    recordKey: "catalogTotal",
    sampleFn: sampleCatalogExample,
    fields: ["@context", "@graph", "graphId", "slug", "domain", "canonicalUrl", "lifecycleState", "status"],
  },
  "domain-graph": {
    slug: "domain-graph",
    title: "Domain Graph Feed",
    eyebrow: "Marketplace graph export",
    description:
      "Entity and relationship export for AI retrieval: domains, offers, auctions, categories, use cases, providers, TLDs, intents, and personas.",
    feedPath: "/api/domain-graph.ndjson",
    jsonPath: null,
    scopes: [],
    recordKey: "graphTotal",
    sampleFn: sampleGraphExample,
    fields: ["type", "domain", "slug", "canonicalUrl", "graphUrl", "nodes", "edges"],
    nodeTypes: ["Domain", "Offer", "Auction", "Category", "UseCase", "Provider", "TLD", "Intent", "Persona", "ComparableDomain"],
    edgeTypes: ["hasOffer", "listedInAuction", "inCategory", "supportsUseCase", "hasIntent", "targetsPersona", "listedWith", "relatedTo", "soldBy"],
  },
};

function renderFeedLandingPage(pageKey, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const page = FEED_LANDING_PAGES[pageKey];
  if (!page) return null;

  const stats = getFeedStats(metadataBaseUrl);
  const recordCount = stats[page.recordKey] ?? 0;
  const sample = page.sampleFn(metadataBaseUrl);
  const landingUrl = `${metadataBaseUrl}/data/${page.slug}`;
  const feedUrl = `${metadataBaseUrl}${page.feedPath}`;

  const datasetSchema = renderDomainListingsDatasetMetadata(stats, metadataBaseUrl);
  const dataFeedSchema = renderDataFeedSchema({
    name: page.title,
    description: page.description,
    feedUrl,
    landingUrl,
    recordCount,
    exampleElements: sample ? [sample] : [],
  });

  const scopeHtml = page.scopes.length
    ? `<section class="feed-section">
        <h2>Scopes</h2>
        <ul class="feed-list">${page.scopes
          .map(
            (scope) =>
              `<li><code>?${escapeHtml(scope.query)}</code> — ${escapeHtml(scope.note)}</li>`
          )
          .join("")}</ul>
      </section>`
    : "";

  const nodeHtml = page.nodeTypes
    ? `<section class="feed-section">
        <h2>Graph node types</h2>
        <p class="feed-tags">${page.nodeTypes.map((type) => `<span>${escapeHtml(type)}</span>`).join("")}</p>
        <h3>Relationship types</h3>
        <p class="feed-tags">${page.edgeTypes.map((type) => `<span>${escapeHtml(type)}</span>`).join("")}</p>
      </section>`
    : "";

  const fieldsHtml = `<section class="feed-section">
      <h2>Record fields</h2>
      <p class="feed-tags">${page.fields.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</p>
    </section>`;

  const exampleHtml = sample
    ? `<section class="feed-section">
        <h2>Example record</h2>
        <pre>${escapeHtml(JSON.stringify(sample, null, 2))}</pre>
      </section>`
    : "";

  const relatedLinks = Object.values(FEED_LANDING_PAGES)
    .filter((entry) => entry.slug !== page.slug)
    .map(
      (entry) =>
        `<a class="feed-link" href="/data/${escapeHtml(entry.slug)}">${escapeHtml(entry.title)}</a>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index,follow" />
    <title>${escapeHtml(page.title)} | Snatch Data</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${escapeHtml(landingUrl)}" />
    ${renderDiscoveryHeadLinks(metadataBaseUrl)}
    <link rel="alternate" type="application/x-ndjson" href="${escapeHtml(page.feedPath)}" title="${escapeHtml(page.title)}" />
    ${page.jsonPath ? `<link rel="alternate" type="application/json" href="${escapeHtml(page.jsonPath)}" title="${escapeHtml(page.title)} JSON" />` : ""}
    <link rel="stylesheet" href="/assets/app.css?v=dev7" />
    <script type="application/ld+json">${JSON.stringify(datasetSchema).replace(/<\/script/gi, "<\\/script")}</script>
    <script type="application/ld+json">${JSON.stringify(dataFeedSchema).replace(/<\/script/gi, "<\\/script")}</script>
    <style>
      body { background: #f8f7f4; color: #111827; }
      main { max-width: 960px; margin: 0 auto; padding: 24px 20px 48px; }
      .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #6b7280; margin: 0 0 8px; }
      h1 { margin: 0 0 12px; font-size: 2rem; }
      .lede, .feed-meta { line-height: 1.6; color: #374151; }
      .feed-meta { margin: 16px 0 24px; }
      .feed-section { margin: 28px 0; }
      .feed-section h2, .feed-section h3 { margin: 0 0 12px; }
      .feed-links, .feed-list { display: flex; flex-wrap: wrap; gap: 12px; padding: 0; list-style: none; margin: 0; }
      .feed-link, .feed-links a { color: #0044ff; font-weight: 600; text-decoration: none; }
      .feed-tags span, code { display: inline-block; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 6px 10px; margin: 0 8px 8px 0; font-size: 13px; }
      pre { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; overflow: auto; white-space: pre-wrap; word-break: break-word; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </head>
  <body class="snatch-app">
    <main>
      <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="lede">${escapeHtml(page.description)}</p>
      <div class="feed-meta">
        <div><strong>${recordCount.toLocaleString()}</strong> records currently available.</div>
        <div>Update policy: ${escapeHtml(UPDATE_FREQUENCY)}</div>
      </div>
      <section class="feed-section">
        <h2>Feed URLs</h2>
        <div class="feed-links">
          <a class="feed-link" href="${escapeHtml(page.feedPath)}">NDJSON feed</a>
          ${page.jsonPath ? `<a class="feed-link" href="${escapeHtml(page.jsonPath)}">JSON feed</a>` : ""}
          <a class="feed-link" href="${escapeHtml(page.feedPath)}?view=raw">Raw NDJSON MIME</a>
          <a class="feed-link" href="/api/domain-listings.dataset.json?raw=1">Dataset metadata JSON</a>
        </div>
      </section>
      ${scopeHtml}
      ${nodeHtml}
      ${fieldsHtml}
      ${exampleHtml}
      <section class="feed-section">
        <h2>Related feeds</h2>
        <div class="feed-links">${relatedLinks}</div>
      </section>
    </main>
  </body>
</html>`;
}

function resolveFeedLandingKey(pathname) {
  const match = String(pathname || "").match(/^\/data\/(domain-listings|domain-feed|domain-graph)\/?$/);
  return match ? match[1] : null;
}

module.exports = {
  UPDATE_FREQUENCY,
  FEED_LANDING_PAGES,
  getFeedStats,
  renderHomepageDatasetSchema,
  renderDataFeedSchema,
  renderDiscoveryHeadLinks,
  injectHomeDiscovery,
  renderFeedLandingPage,
  resolveFeedLandingKey,
};
