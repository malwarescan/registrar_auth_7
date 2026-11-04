const { buildGraphId } = require("./product-record");
const { resolveLifecycleState } = require("./product-lifecycle");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { SITE_NAME, buildOrganizationNode, buildWebSiteNode, buildNameSiloNode, namesiloId } = require("../site-identity");

function recordIsIndexNow(record) {
  if (!record?.domain) return false;
  if (resolveLifecycleState(record) !== "active") return false;
  if (record.seoTier === "index-now") return true;
  if (record.seoTier === "hold-noindex" || record.seoTier === "archive") return false;
  return record.indexable === true;
}

function buildDomainProductGraph(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  if (!record) return null;

  const canonicalUrl = record.canonicalUrl || `${metadataBaseUrl}/domains/${record.slug}`;
  const graphId = record.graphId || buildGraphId(record.slug);
  const scores = record.baseScores || {};

  const snatchOrganization = buildOrganizationNode(metadataBaseUrl);
  const snatchWebSite = buildWebSiteNode(metadataBaseUrl);
  const providerNode = buildNameSiloNode(metadataBaseUrl);

  const tldNode = {
    "@type": "DefinedTerm",
    "@id": `${canonicalUrl}#tld`,
    name: record.tld || ".com",
    termCode: record.tld || ".com",
  };

  const categoryNodes = (record.categoryGuesses || []).map((label, index) => ({
    "@type": "DefinedTerm",
    "@id": `${canonicalUrl}#category-${index + 1}`,
    name: label,
  }));

  const useCaseNodes = (record.buyerUseCases || []).map((label, index) => ({
    "@type": "DefinedTerm",
    "@id": `${canonicalUrl}#use-case-${index + 1}`,
    name: label,
  }));

  const riskSignalNodes = (record.riskFlags || []).map((flag, index) => ({
    "@type": "PropertyValue",
    "@id": `${canonicalUrl}#risk-${index + 1}`,
    name: "riskSignal",
    value: flag,
  }));

  const comparableNodes = (record.comparableDomains || []).map((entry, index) => {
    const domain = typeof entry === "string" ? entry : entry.domain;
    return {
      "@type": "Product",
      "@id": `${canonicalUrl}#comparable-${index + 1}`,
      name: domain,
      category: "Domain name",
    };
  });

  const lifecycleState = resolveLifecycleState(record);

  const seoDescription =
    lifecycleState === "active"
      ? `${record.domain} is a ${record.tld || ".com"} auction domain available through NameSilo, with the recorded bid, end time and ${SITE_NAME} name-quality scores.`
      : `${record.domain} was a ${record.tld || ".com"} expired-domain auction on NameSilo. The auction has ended; this record keeps the last known details and scores.`;

  const productNode = {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: record.domain,
    sku: record.candidateId || `product_${record.slug}`,
    category: "Domain name",
    description: seoDescription,
    additionalProperty: [
      { "@type": "PropertyValue", name: "tldTrust", value: scores.tldTrust },
      { "@type": "PropertyValue", name: "brandability", value: scores.brandability },
      { "@type": "PropertyValue", name: "pronounceability", value: scores.pronounceability },
      { "@type": "PropertyValue", name: "overall", value: scores.overall },
    ],
    isRelatedTo: comparableNodes.map((node) => ({ "@id": node["@id"] })),
  };

  const webpageNode = {
    "@type": "WebPage",
    "@id": `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: `${record.domain} — ${record.tld || ".com"} Auction Domain`,
    description: seoDescription,
    isPartOf: { "@id": `${metadataBaseUrl}/#website` },
    publisher: { "@id": `${metadataBaseUrl}/#organization` },
    about: { "@id": `${canonicalUrl}#product` },
    dateModified: record.statusVerifiedAt,
  };

  const breadcrumbNode = {
    "@type": "BreadcrumbList",
    "@id": `${canonicalUrl}#breadcrumbs`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${metadataBaseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Domain listings", item: `${metadataBaseUrl}/data/domain-listings` },
      { "@type": "ListItem", position: 3, name: record.domain, item: canonicalUrl },
    ],
  };

  let offerNode = null;
  if (lifecycleState === "active" && record.acquisitionPath?.actionUrl) {
    offerNode = {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      url: record.acquisitionPath.actionUrl,
      priceCurrency: record.acquisitionPath.priceCurrency || "USD",
      price: record.currentBid,
      availability: "https://schema.org/InStock",
      seller: { "@id": namesiloId(metadataBaseUrl) },
      validThrough: record.auctionEndsAt,
      description: "Current bid is not the final sale price.",
    };
    if (typeof record.bidCount === "number" && record.bidCount > 0) {
      offerNode.offerCount = record.bidCount;
    }
    productNode.offers = { "@id": `${canonicalUrl}#offer` };
  } else if (lifecycleState === "sold" || lifecycleState === "ended") {
    offerNode = {
      "@type": "Offer",
      "@id": `${canonicalUrl}#offer`,
      priceCurrency: record.acquisitionPath?.priceCurrency || "USD",
      price: record.currentBid,
      availability: lifecycleState === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/Discontinued",
      seller: { "@id": namesiloId(metadataBaseUrl) },
      description: lifecycleState === "sold" ? "Auction sold." : "Auction ended.",
    };
    productNode.offers = { "@id": `${canonicalUrl}#offer` };
  }

  const graph = [
    snatchOrganization,
    snatchWebSite,
    providerNode,
    tldNode,
    ...categoryNodes,
    ...useCaseNodes,
    ...riskSignalNodes,
    ...comparableNodes,
    breadcrumbNode,
    webpageNode,
    productNode,
  ];

  if (offerNode) graph.push(offerNode);

  return {
    "@context": "https://schema.org",
    "@graph": graph,
    graphId,
    slug: record.slug,
    domain: record.domain,
    canonicalUrl,
    indexable: recordIsIndexNow(record),
    published: record.published === true,
    qualityFlags: record.qualityFlags || [],
    riskFlags: record.riskFlags || [],
    riskNotes: record.riskNotes || [],
    categoryGuesses: record.categoryGuesses || [],
    buyerUseCases: record.buyerUseCases || [],
    baseScores: scores,
    lifecycleState,
    status: record.status,
    auctionUrl: record.auctionUrl,
    currentBid: record.currentBid,
    auctionEndsAt: record.auctionEndsAt,
  };
}

module.exports = {
  buildDomainProductGraph,
};
