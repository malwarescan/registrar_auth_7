const {
  renderDomainListingRecord,
  streamDomainListingsNdjson,
  renderDomainListingsJson,
} = require("./listing-feed-renderer");

module.exports = {
  renderDomainListing: renderDomainListingRecord,
  renderDomainListingsNdjson(records, metadataBaseUrl) {
    return records.map((record) => renderDomainListingRecord(record, metadataBaseUrl)).filter(Boolean);
  },
  renderDomainListingsJson,
  renderDomainListingRecord,
  streamDomainListingsNdjson,
};
