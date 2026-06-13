const NDJSON_MIME = "application/x-ndjson; charset=utf-8";
const NDJSON_INLINE_MIME = "text/plain; charset=utf-8";
const JSON_MIME = "application/json; charset=utf-8";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseAcceptHeader(req) {
  return String(req?.headers?.accept || "").toLowerCase();
}

function wantsStrictNdjsonMime(req, query = {}) {
  if (
    query.raw === "1" ||
    query.raw === "true" ||
    query.download === "1" ||
    query.download === "true" ||
    query.view === "raw" ||
    query.view === "ndjson"
  ) {
    return true;
  }
  const accept = parseAcceptHeader(req);
  return accept.includes("application/x-ndjson");
}

function wantsHtmlFeedPreview(req, query = {}) {
  if (wantsStrictNdjsonMime(req, query)) return false;
  if (query.view === "raw" || query.view === "ndjson") return false;
  const accept = parseAcceptHeader(req);
  if (!accept.includes("text/html")) return false;
  if (accept.includes("application/json") && !accept.includes("text/html")) return false;
  return true;
}

function wantsInlineJsonPreview(req, query = {}) {
  if (query.raw === "1" || query.raw === "true") return false;
  const accept = parseAcceptHeader(req);
  return accept.includes("text/html") && !accept.includes("application/json");
}

function ndjsonInlineHeaders(strict = false) {
  return {
    "Content-Type": strict ? NDJSON_MIME : NDJSON_INLINE_MIME,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    ...(strict ? {} : { "X-Feed-Format": "application/x-ndjson" }),
  };
}

function jsonInlineHeaders() {
  return {
    "Content-Type": JSON_MIME,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };
}

function htmlInlineHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  };
}

function sendNdjsonFeedHeaders(res, req, query = {}, status = 200) {
  const strict = wantsStrictNdjsonMime(req, query);
  res.writeHead(status, ndjsonInlineHeaders(strict));
}

function sendJsonFeedHeaders(res, req, query = {}, status = 200) {
  res.writeHead(status, jsonInlineHeaders());
}

function sendHtmlFeedHeaders(res, status = 200) {
  res.writeHead(status, htmlInlineHeaders());
}

function renderFeedBrowsePage(options = {}) {
  const {
    title,
    description,
    requestPath,
    lineCount,
    previewLines = [],
    links = [],
  } = options;

  const preview = previewLines.join("\n");
  const linkHtml = links
    .map(
      (link) =>
        `<a class="feed-link" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,follow" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f8f7f4; color: #111827; }
      main { max-width: 960px; margin: 0 auto; padding: 24px 20px 40px; }
      h1 { font-size: 1.5rem; margin: 0 0 8px; }
      p { line-height: 1.5; margin: 0 0 16px; color: #374151; }
      .meta { font-size: 0.95rem; margin-bottom: 20px; }
      .links { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
      .feed-link { color: #0044ff; text-decoration: none; font-weight: 600; }
      pre { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; overflow: auto; white-space: pre-wrap; word-break: break-word; font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="meta"><strong>${lineCount}</strong> record lines in this feed.</div>
      <div class="links">
        ${linkHtml}
      </div>
      <pre>${escapeHtml(preview || "No records in this feed.")}</pre>
      <p class="meta">Preview shows up to ${previewLines.length} lines from <code>${escapeHtml(requestPath)}</code>.</p>
    </main>
  </body>
</html>`;
}

module.exports = {
  NDJSON_MIME,
  NDJSON_INLINE_MIME,
  JSON_MIME,
  wantsStrictNdjsonMime,
  wantsHtmlFeedPreview,
  wantsInlineJsonPreview,
  ndjsonInlineHeaders,
  jsonInlineHeaders,
  htmlInlineHeaders,
  sendNdjsonFeedHeaders,
  sendJsonFeedHeaders,
  sendHtmlFeedHeaders,
  renderFeedBrowsePage,
};
