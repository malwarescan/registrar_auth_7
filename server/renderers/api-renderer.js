const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { isIndexNowTier } = require("../candidate-store/seo-tier");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

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

function renderProductGraphApi(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return buildDomainProductGraph(record, metadataBaseUrl);
}

module.exports = {
  renderProductRecordApi,
  renderProductGraphApi,
};
