const {
  getDurableCandidateBySlug,
  listDurableCandidates,
  countDurableCandidates,
  normalizeSlug,
} = require("../server/candidate-store/durable-candidates");
const { renderProductRecordApi, renderProductGraphApi } = require("../server/renderers/api-renderer");
const {
  renderDomainFeedNdjson,
  renderDomainFeedJson,
} = require("../server/renderers/feed-renderer");
const {
  streamDomainListingsNdjson,
  renderDomainListingsJson,
  renderDomainListingRecord,
} = require("../server/renderers/listing-feed-renderer");
const { buildGraphFeedRecord } = require("../server/renderers/graph-feed-renderer");
const { renderDomainListingsDatasetMetadata } = require("../server/renderers/dataset-metadata-renderer");
const {
  sendNdjsonHeaders,
  sendJsonHeaders,
  sendHtmlFeedHeaders,
  sendNdjsonFeedHeaders,
} = require("../server/renderers/feed-headers");
const {
  wantsHtmlFeedPreview,
  renderFeedBrowsePage,
} = require("../server/renderers/feed-browser");
const {
  listListingCandidates,
  countListingCandidates,
} = require("../server/candidate-store/listing-feed");
const {
  resolveJsonFeedOptions,
  resolveNdjsonFeedOptions,
  resolveListingScope,
} = require("../server/candidate-store/feed-guard");
const { DEFAULT_PUBLIC_BASE_URL } = require("../server/public-url");

const FEED_PREVIEW_LINES = 25;

function buildRequestPath(pathname, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).length) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function sendFeedBrowsePage(res, options) {
  sendHtmlFeedHeaders(res);
  res.end(renderFeedBrowsePage(options));
}

function handleDomainProductBySlug(_req, res, slug, options = {}) {
  const record = getDurableCandidateBySlug(slug);
  if (!record) {
    sendJsonHeaders(res, 404);
    res.end(JSON.stringify({ error: "Domain product record not found." }));
    return;
  }
  sendJsonHeaders(res);
  res.end(JSON.stringify(renderProductRecordApi(record)));
}

function handleDomainGraphBySlug(_req, res, slug, options = {}) {
  const record = getDurableCandidateBySlug(slug);
  if (!record) {
    sendJsonHeaders(res, 404);
    res.end(JSON.stringify({ error: "Domain graph not found." }));
    return;
  }
  const graph = renderProductGraphApi(record, options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL);
  sendJsonHeaders(res);
  res.end(JSON.stringify(graph));
}

function handleDomainFeedNdjson(req, res, options = {}) {
  const query = options.query || {};
  const feedOptions = resolveNdjsonFeedOptions(query);
  const records = listDurableCandidates({ limit: feedOptions.limit });
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const lines = renderDomainFeedNdjson(records, metadataBaseUrl).map((entry) => JSON.stringify(entry));
  const requestPath = buildRequestPath("/api/domain-feed.ndjson", query);

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Catalog Feed",
      description: "Full durable catalog NDJSON export with graph payloads.",
      requestPath,
      lineCount: lines.length,
      previewLines: lines.slice(0, FEED_PREVIEW_LINES),
      links: [
        { href: `${requestPath}${requestPath.includes("?") ? "&" : "?"}view=raw`, label: "View raw NDJSON" },
        { href: "/api/domain-feed.json?limit=1000&raw=1", label: "View JSON" },
      ],
    });
    return;
  }

  sendNdjsonFeedHeaders(res, req, query);
  for (const line of lines) res.write(`${line}\n`);
  res.end();
}

function handleDomainFeedJson(req, res, options = {}) {
  const query = options.query || {};
  const feedOptions = resolveJsonFeedOptions(query, options);
  const totalAvailable = countDurableCandidates();
  const records = listDurableCandidates({ limit: feedOptions.limit });
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const payload = {
    ...renderDomainFeedJson(records, metadataBaseUrl),
    totalAvailable,
    limit: feedOptions.limit,
    truncated: feedOptions.truncated || (feedOptions.limit !== null && totalAvailable > records.length),
    allRequested: feedOptions.allRequested,
    allAllowed: feedOptions.allAllowed,
  };
  const requestPath = buildRequestPath("/api/domain-feed.json", query);

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Catalog Feed (JSON)",
      description: "Full durable catalog JSON export.",
      requestPath,
      lineCount: payload.records?.length || 0,
      previewLines: [JSON.stringify(payload, null, 2).slice(0, 12000)],
      links: [
        { href: `${requestPath}${requestPath.includes("?") ? "&" : "?"}raw=1`, label: "View raw JSON" },
        { href: "/api/domain-feed.ndjson?view=raw", label: "View NDJSON" },
      ],
    });
    return;
  }

  sendJsonHeaders(res, req, query);
  res.end(JSON.stringify(payload));
}

function handleDomainListingsNdjson(req, res, options = {}) {
  const query = options.query || {};
  const scope = resolveListingScope(query);
  const feedOptions = resolveNdjsonFeedOptions(query);
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  let records = listListingCandidates(scope, { metadataBaseUrl });
  if (feedOptions.limit !== null) {
    records = records.slice(0, feedOptions.limit);
  }
  const lines = records
    .map((record) => renderDomainListingRecord(record, metadataBaseUrl))
    .filter(Boolean)
    .map((entry) => JSON.stringify(entry));
  const requestPath = buildRequestPath("/api/domain-listings.ndjson", query);

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Listings Feed",
      description: `Public listing feed for scope=${scope}.`,
      requestPath,
      lineCount: lines.length,
      previewLines: lines.slice(0, FEED_PREVIEW_LINES),
      links: [
        { href: `${requestPath}${requestPath.includes("?") ? "&" : "?"}view=raw`, label: "View raw NDJSON" },
        { href: `/api/domain-listings.json?scope=${encodeURIComponent(scope)}&raw=1`, label: "View JSON" },
        { href: "/api/domain-listings.dataset.json?raw=1", label: "Feed metadata" },
      ],
    });
    return;
  }

  sendNdjsonFeedHeaders(res, req, query);
  for (const line of lines) res.write(`${line}\n`);
  res.end();
}

function handleDomainListingsJson(req, res, options = {}) {
  const query = options.query || {};
  const scope = resolveListingScope(query);
  const feedOptions = resolveJsonFeedOptions(query, options);
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const totalAvailable = countListingCandidates(scope, { metadataBaseUrl });
  const allRecords = listListingCandidates(scope, { metadataBaseUrl });
  const records = feedOptions.limit !== null ? allRecords.slice(0, feedOptions.limit) : allRecords;
  const payload = renderDomainListingsJson(records, metadataBaseUrl, {
    scope,
    limit: feedOptions.limit,
    truncated:
      feedOptions.truncated || (feedOptions.limit !== null && totalAvailable > records.length),
    totalAvailable,
    allRequested: feedOptions.allRequested,
    allAllowed: feedOptions.allAllowed,
  });
  const requestPath = buildRequestPath("/api/domain-listings.json", query);

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Listings Feed (JSON)",
      description: `Public listing feed JSON wrapper for scope=${scope}.`,
      requestPath,
      lineCount: payload.listings?.length || 0,
      previewLines: [JSON.stringify(payload, null, 2).slice(0, 12000)],
      links: [
        { href: `${requestPath}${requestPath.includes("?") ? "&" : "?"}raw=1`, label: "View raw JSON" },
        { href: `/api/domain-listings.ndjson?scope=${encodeURIComponent(scope)}&view=raw`, label: "View NDJSON" },
      ],
    });
    return;
  }

  sendJsonHeaders(res, req, query);
  res.end(JSON.stringify(payload));
}

function handleDomainGraphNdjson(req, res, options = {}) {
  const query = options.query || {};
  const feedOptions = resolveNdjsonFeedOptions(query);
  const records = listDurableCandidates({ limit: feedOptions.limit });
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const lines = records
    .map((record) => buildGraphFeedRecord(record, metadataBaseUrl))
    .filter(Boolean)
    .map((entry) => JSON.stringify(entry));
  const requestPath = buildRequestPath("/api/domain-graph.ndjson", query);

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Graph Feed",
      description: "Marketplace graph NDJSON export for AI retrieval.",
      requestPath,
      lineCount: lines.length,
      previewLines: lines.slice(0, FEED_PREVIEW_LINES),
      links: [
        { href: `${requestPath}${requestPath.includes("?") ? "&" : "?"}view=raw`, label: "View raw NDJSON" },
        { href: "/api/domain-listings.ndjson?view=raw", label: "View listings feed" },
      ],
    });
    return;
  }

  sendNdjsonFeedHeaders(res, req, query);
  for (const line of lines) res.write(`${line}\n`);
  res.end();
}

function handleDomainListingsDatasetJson(req, res, options = {}) {
  const query = options.query || {};
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  const payload = renderDomainListingsDatasetMetadata(
    {
      listingsIndexed: countListingCandidates("indexed", { metadataBaseUrl }),
      listingsActive: countListingCandidates("active", { metadataBaseUrl }),
      listingsArchive: countListingCandidates("archive", { metadataBaseUrl }),
      catalogTotal: countDurableCandidates(),
      graphTotal: countDurableCandidates(),
    },
    metadataBaseUrl
  );

  if (wantsHtmlFeedPreview(req, query)) {
    sendFeedBrowsePage(res, {
      title: "Domain Feed Metadata",
      description: "Schema.org Dataset metadata for public feed endpoints.",
      requestPath: "/api/domain-listings.dataset.json",
      lineCount: payload.distribution?.length || 0,
      previewLines: [JSON.stringify(payload, null, 2)],
      links: [
        { href: "/api/domain-listings.dataset.json?raw=1", label: "View raw JSON" },
        { href: "/api/domain-listings.ndjson", label: "Open listings feed" },
      ],
    });
    return;
  }

  sendJsonHeaders(res, req, query);
  res.end(JSON.stringify(payload));
}

function resolveSlugFromApiPath(pathname, prefix) {
  const raw = pathname.replace(prefix, "").replace(/\/graph\.json$/, "").replace(/\/$/, "");
  return normalizeSlug(raw);
}

module.exports = {
  handleDomainProductBySlug,
  handleDomainGraphBySlug,
  handleDomainFeedNdjson,
  handleDomainFeedJson,
  handleDomainListingsNdjson,
  handleDomainListingsJson,
  handleDomainGraphNdjson,
  handleDomainListingsDatasetJson,
  resolveSlugFromApiPath,
};
