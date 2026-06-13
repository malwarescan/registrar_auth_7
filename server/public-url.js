const DEFAULT_PUBLIC_BASE_URL = "https://urlsnatcher.com";

function normalizeBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function getPublicBaseUrl(options = {}) {
  const configured = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
  if (configured) return configured;

  const port = Number(options.port || process.env.PORT || 4173);
  const isProduction =
    options.isProduction ??
    (process.env.NODE_ENV === "production" ||
      Boolean(process.env.RAILWAY_ENVIRONMENT_NAME) ||
      Boolean(process.env.RAILWAY_PROJECT_ID));

  if (isProduction) return DEFAULT_PUBLIC_BASE_URL;
  return `http://localhost:${port}`;
}

/** Base URL for HTML metadata / JSON-LD — never localhost unless explicitly allowed. */
function getMetadataBaseUrl(options = {}) {
  const configured = normalizeBaseUrl(process.env.PUBLIC_BASE_URL);
  if (configured) return configured;
  if (options.allowLocalhostInMetadata) {
    return getPublicBaseUrl(options);
  }
  return DEFAULT_PUBLIC_BASE_URL;
}

function toAbsolutePublicUrl(pathname, options = {}) {
  const base = getPublicBaseUrl(options);
  const path = String(pathname || "").startsWith("/") ? pathname : `/${pathname || ""}`;
  return `${base}${path}`;
}

function toPublicMetadataUrl(pathname, options = {}) {
  const base = getMetadataBaseUrl(options);
  const path = String(pathname || "").startsWith("/") ? pathname : `/${pathname || ""}`;
  return `${base}${path}`;
}

module.exports = {
  DEFAULT_PUBLIC_BASE_URL,
  getPublicBaseUrl,
  getMetadataBaseUrl,
  toAbsolutePublicUrl,
  toPublicMetadataUrl,
};
