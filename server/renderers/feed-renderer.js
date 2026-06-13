const { buildDomainProductGraph } = require("../candidate-store/domain-graph");

function renderDomainFeedNdjson(records, metadataBaseUrl = "https://snatch.auction") {
  return records.map((record) => buildDomainProductGraph(record, metadataBaseUrl));
}

function renderDomainFeedJson(records, metadataBaseUrl = "https://snatch.auction") {
  const graphs = renderDomainFeedNdjson(records, metadataBaseUrl);
  return {
    count: graphs.length,
    records: graphs,
  };
}

function renderDatasetMetadata(records, metadataBaseUrl = "https://snatch.auction") {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Snatch.auction Domain Product Catalog",
    description: "Machine-readable domain auction product records and disambiguation graphs.",
    url: `${metadataBaseUrl}/api/domain-feed.json`,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/x-ndjson",
        contentUrl: `${metadataBaseUrl}/api/domain-feed.ndjson`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${metadataBaseUrl}/api/domain-feed.json`,
      },
    ],
    variableMeasured: ["domain", "auction status", "current bid", "TLD trust", "brandability"],
    numberOfItems: records.length,
  };
}

module.exports = {
  renderDomainFeedNdjson,
  renderDomainFeedJson,
  renderDatasetMetadata,
};
