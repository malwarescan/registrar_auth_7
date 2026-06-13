const {
  ndjsonInlineHeaders,
  jsonInlineHeaders,
  htmlInlineHeaders,
  sendNdjsonFeedHeaders,
  sendJsonFeedHeaders,
  sendHtmlFeedHeaders,
  NDJSON_INLINE_MIME,
  JSON_MIME,
} = require("./feed-browser");

const NDJSON_INLINE_HEADERS = ndjsonInlineHeaders(false);
const JSON_INLINE_HEADERS = jsonInlineHeaders();

function sendNdjsonHeaders(res, reqOrStatus, maybeStatus) {
  if (typeof reqOrStatus === "number") {
    res.writeHead(reqOrStatus, NDJSON_INLINE_HEADERS);
    return;
  }
  const req = reqOrStatus;
  const status = typeof maybeStatus === "number" ? maybeStatus : 200;
  sendNdjsonFeedHeaders(res, req, {}, status);
}

function sendJsonHeaders(res, reqOrStatus, maybeStatus) {
  if (typeof reqOrStatus === "number") {
    res.writeHead(reqOrStatus, JSON_INLINE_HEADERS);
    return;
  }
  sendJsonFeedHeaders(res, reqOrStatus, {}, typeof maybeStatus === "number" ? maybeStatus : 200);
}

module.exports = {
  NDJSON_INLINE_HEADERS,
  JSON_INLINE_HEADERS,
  NDJSON_INLINE_MIME,
  JSON_MIME,
  sendNdjsonHeaders,
  sendJsonHeaders,
  sendHtmlFeedHeaders,
  sendNdjsonFeedHeaders,
  sendJsonFeedHeaders,
};
