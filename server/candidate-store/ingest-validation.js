const REQUIRED_AUCTION_FIELDS = ["domain"];

function validateNormalizedAuction(auction) {
  const missing = REQUIRED_AUCTION_FIELDS.filter((field) => !auction?.[field]);
  if (missing.length) {
    return { valid: false, reason: `Missing auction fields: ${missing.join(", ")}` };
  }
  if (!String(auction.domain).includes(".")) {
    return { valid: false, reason: "Invalid domain format" };
  }
  return { valid: true };
}

function validateProductRecord(record) {
  if (!record) return { valid: false, reason: "Normalization returned null" };
  const required = ["slug", "domain", "source", "provider", "status", "canonicalUrl", "graphId"];
  const missing = required.filter((field) => !record[field]);
  if (missing.length) {
    return { valid: false, reason: `Missing record fields: ${missing.join(", ")}` };
  }
  if (!record.acquisitionPath?.actionUrl && !record.auctionUrl) {
    return { valid: false, reason: "Missing acquisition URL" };
  }
  return { valid: true };
}

module.exports = {
  REQUIRED_AUCTION_FIELDS,
  validateNormalizedAuction,
  validateProductRecord,
};
