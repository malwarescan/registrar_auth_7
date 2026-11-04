const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { SITE_NAME, orgId, namesiloId } = require("../site-identity");

function dataHubDatasetId(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  return `${metadataBaseUrl}/data/#dataset`;
}

function renderFeedDistribution(metadataBaseUrl, contentUrl, encodingFormat) {
  return {
    "@type": "DataDownload",
    encodingFormat,
    contentUrl: `${metadataBaseUrl}${contentUrl}`,
  };
}

function renderDomainListingsDatasetMetadata(counts = {}, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const {
    listingsAll = 0,
    listingsIndexed = 0,
    listingsActive = 0,
    listingsArchive = 0,
    catalogTotal = 0,
    graphTotal = 0,
  } = counts;

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": dataHubDatasetId(metadataBaseUrl),
    name: `${SITE_NAME} expired-domain auction data`,
    description:
      "Expired-domain auction records collected from public NameSilo auctions: listing, full catalog and relationship-graph feeds. Each record's status is recalculated from its auction end time.",
    creator: { "@id": orgId(metadataBaseUrl), "@type": "Organization", name: SITE_NAME, url: `${metadataBaseUrl}/` },
    isBasedOn: { "@id": namesiloId(metadataBaseUrl), "@type": "Organization", name: "NameSilo", url: "https://www.namesilo.com" },
    url: `${metadataBaseUrl}/data/`,
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
        name: "All recorded auction listings (default scope)",
        url: `${metadataBaseUrl}/data/domain-listings`,
        contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson`,
        numberOfItems: listingsAll,
      },
      {
        "@type": "DataFeed",
        name: "Listings whose pages are in the sitemap",
        url: `${metadataBaseUrl}/data/domain-listings`,
        contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=indexed`,
        numberOfItems: listingsIndexed,
      },
      {
        "@type": "DataFeed",
        name: "Active domain listings",
        url: `${metadataBaseUrl}/data/domain-listings`,
        contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=active`,
        numberOfItems: listingsActive,
      },
      {
        "@type": "DataFeed",
        name: "Archived domain listings",
        url: `${metadataBaseUrl}/data/domain-listings`,
        contentUrl: `${metadataBaseUrl}/api/domain-listings.ndjson?scope=archive`,
        numberOfItems: listingsArchive,
      },
      {
        "@type": "DataFeed",
        name: "Full durable catalog",
        url: `${metadataBaseUrl}/data/domain-feed`,
        contentUrl: `${metadataBaseUrl}/api/domain-feed.ndjson`,
        numberOfItems: catalogTotal,
      },
      {
        "@type": "DataFeed",
        name: "Marketplace graph export",
        url: `${metadataBaseUrl}/data/domain-graph`,
        contentUrl: `${metadataBaseUrl}/api/domain-graph.ndjson`,
        numberOfItems: graphTotal,
      },
    ],
    variableMeasured: [
      "domain",
      "auction status",
      "recorded bid",
      "TLD trust",
      "brandability",
      "category",
      "use case",
    ],
  };
}

module.exports = {
  dataHubDatasetId,
  renderDomainListingsDatasetMetadata,
};
