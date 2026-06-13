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
  renderDomainListingsNdjson,
  renderDomainListingsJson,
} = require("../server/renderers/listings-renderer");
const { listListingCandidates, countListingCandidates } = require("../server/candidate-store/listing-feed");
const {
  resolveJsonFeedOptions,
  resolveNdjsonFeedOptions,
  resolveListingScope,
} = require("../server/candidate-store/feed-guard");
const { DEFAULT_PUBLIC_BASE_URL } = require("../server/public-url");

function handleDomainProductBySlug(_req, res, slug, options = {}) {
  const record = getDurableCandidateBySlug(slug);
  if (!record) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Domain product record not found." }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(renderProductRecordApi(record)));
}

function handleDomainGraphBySlug(_req, res, slug, options = {}) {
  const record = getDurableCandidateBySlug(slug);
  if (!record) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Domain graph not found." }));
    return;
  }
  const graph = renderProductGraphApi(record, options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(graph));
}

function handleDomainFeedNdjson(_req, res, options = {}) {
  const feedOptions = resolveNdjsonFeedOptions(options.query || {});
  const records = listDurableCandidates({ limit: feedOptions.limit });
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
  for (const graph of renderDomainFeedNdjson(records, metadataBaseUrl)) {
    res.write(`${JSON.stringify(graph)}\n`);
  }
  res.end();
}

function handleDomainFeedJson(_req, res, options = {}) {
  const feedOptions = resolveJsonFeedOptions(options.query || {}, options);
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
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function handleDomainListingsNdjson(_req, res, options = {}) {
  const scope = resolveListingScope(options.query || {});
  const feedOptions = resolveNdjsonFeedOptions(options.query || {});
  const metadataBaseUrl = options.metadataBaseUrl || DEFAULT_PUBLIC_BASE_URL;
  let records = listListingCandidates(scope, { metadataBaseUrl });
  if (feedOptions.limit !== null) {
    records = records.slice(0, feedOptions.limit);
  }
  res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
  for (const listing of renderDomainListingsNdjson(records, metadataBaseUrl)) {
    res.write(`${JSON.stringify(listing)}\n`);
  }
  res.end();
}

function handleDomainListingsJson(_req, res, options = {}) {
  const scope = resolveListingScope(options.query || {});
  const feedOptions = resolveJsonFeedOptions(options.query || {}, options);
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
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
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
  resolveSlugFromApiPath,
};
