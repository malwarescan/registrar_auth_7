const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function renderFeedDistribution(metadataBaseUrl, contentUrl, encodingFormat) {
  return {
    "@type": "DataDownload",
    encodingFormat,
    contentUrl: `${metadataBaseUrl}${contentUrl}`,
  };
}

function renderDomainListingsDatasetMetadata(counts = {}, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const {
    listingsIndexed = 0,
    listingsActive = 0,
    listingsArchive = 0,
    catalogTotal = 0,
    graphTotal = 0,
  } = counts;

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "UrlSnatcher Domain Marketplace Feeds",
    description:
      "Public domain listing feeds, full durable catalog export, and marketplace graph export for AI retrieval and discovery.",
    url: `${metadataBaseUrl}/api/domain-listings.dataset.json`,
    creator: {
      "@type": "Organization",
      name: "Snatch.auction",
      url: `${metadataBaseUrl}/`,
    },
    distribution: [
      renderFeedDistribution(metadataBaseUrl, "/api/domain-listings.ndjson", "application/x-ndjson"),
      renderFeedDistribution(metadataBaseUrl, "/api/domain-listings.json", "application/json"),
      renderFeedDistribution(metadataBaseUrl, "/api/domain-feed.ndjson", "application/x-ndjson"),
      renderFeedDistribution(metadataBaseUrl, "/api/domain-feed.json", "application/json"),
      renderFeedDistribution(metadataBaseUrl, "/api/domain-graph.ndjson", "application/x-ndjson"),
    ],
    hasPart: [
      {
        "@type": "DataFeed",
        name: "Public domain listings (indexed scope default)",
        url: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=indexed`,
        numberOfItems: listingsIndexed,
      },
      {
        "@type": "DataFeed",
        name: "Active domain listings",
        url: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=active`,
        numberOfItems: listingsActive,
      },
      {
        "@type": "DataFeed",
        name: "Archived domain listings",
        url: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=archive`,
        numberOfItems: listingsArchive,
      },
      {
        "@type": "DataFeed",
        name: "Full durable catalog",
        url: `${metadataBaseUrl}/api/domain-feed.ndjson`,
        numberOfItems: catalogTotal,
      },
      {
        "@type": "DataFeed",
        name: "Marketplace graph export",
        url: `${metadataBaseUrl}/api/domain-graph.ndjson`,
        numberOfItems: graphTotal,
      },
    ],
    variableMeasured: [
      "domain",
      "auction status",
      "current bid",
      "TLD trust",
      "brandability",
      "category",
      "use case",
    ],
  };
}

module.exports = {
  renderDomainListingsDatasetMetadata,
};
