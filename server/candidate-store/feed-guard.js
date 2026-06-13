const DEFAULT_JSON_FEED_LIMIT = 1000;
const LISTING_SCOPES = new Set(["indexed", "active", "archive"]);

function resolveListingScope(query = {}) {
  const scope = String(query.scope || "indexed").trim().toLowerCase();
  return LISTING_SCOPES.has(scope) ? scope : "indexed";
}

function resolveJsonFeedOptions(query = {}, options = {}) {
  const isProduction = options.isProduction === true;
  const allowFullFeed = options.allowFullFeed === true;
  const allRequested = query.all === "true";

  if (allRequested) {
    if (isProduction && !allowFullFeed) {
      return {
        limit: DEFAULT_JSON_FEED_LIMIT,
        allRequested: true,
        allAllowed: false,
        truncated: true,
      };
    }
    return { limit: null, allRequested: true, allAllowed: true, truncated: false };
  }

  const parsedLimit = query.limit ? Number(query.limit) : DEFAULT_JSON_FEED_LIMIT;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_JSON_FEED_LIMIT;
  return { limit, allRequested: false, allAllowed: false, truncated: false };
}

function resolveNdjsonFeedOptions(query = {}) {
  if (query.all === "true" || query.limit === undefined) {
    return { limit: null, allExport: query.all === "true" };
  }
  const parsedLimit = Number(query.limit);
  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null,
    allExport: false,
  };
}

module.exports = {
  DEFAULT_JSON_FEED_LIMIT,
  LISTING_SCOPES,
  resolveListingScope,
  resolveJsonFeedOptions,
  resolveNdjsonFeedOptions,
};
