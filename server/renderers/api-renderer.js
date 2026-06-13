const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { isIndexNowTier } = require("../candidate-store/seo-tier");

function renderProductRecordApi(record) {
  if (!record) return null;
  return {
    record,
    indexable: isIndexNowTier(record),
    published: isIndexNowTier(record),
    seoTier: record.seoTier,
    graphId: record.graphId,
  };
}

function renderProductGraphApi(record, metadataBaseUrl = "https://snatch.auction") {
  return buildDomainProductGraph(record, metadataBaseUrl);
}

module.exports = {
  renderProductRecordApi,
  renderProductGraphApi,
};
