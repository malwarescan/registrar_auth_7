const NDJSON_INLINE_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
};

const JSON_INLINE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
};

function sendNdjsonHeaders(res, status = 200) {
  res.writeHead(status, NDJSON_INLINE_HEADERS);
}

function sendJsonHeaders(res, status = 200) {
  res.writeHead(status, JSON_INLINE_HEADERS);
}

module.exports = {
  NDJSON_INLINE_HEADERS,
  JSON_INLINE_HEADERS,
  sendNdjsonHeaders,
  sendJsonHeaders,
};
