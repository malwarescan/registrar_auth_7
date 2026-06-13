const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function nodeTypeForSchemaType(schemaType, nodeId = "") {
  if (schemaType === "Product" && nodeId.includes("#comparable-")) return "ComparableDomain";
  if (schemaType === "Product") return "DomainProduct";
  if (schemaType === "Offer") return "Offer";
  if (schemaType === "Organization" && nodeId.includes("#provider-")) return "Provider";
  if (schemaType === "DefinedTerm" && nodeId.includes("#category-")) return "Category";
  if (schemaType === "DefinedTerm" && nodeId.includes("#use-case-")) return "UseCase";
  if (schemaType === "DefinedTerm" && nodeId.includes("#tld")) return "TLD";
  return null;
}

function buildGraphFeedRecord(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  if (!record?.slug || !record.domain) return null;

  const graphPayload = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graphPayload?.["@graph"]) return null;

  const canonicalUrl = graphPayload.canonicalUrl;
  const domainNodeId = `${canonicalUrl}#product`;
  const nodes = [];
  const edges = [];
  const seenNodeIds = new Set();

  for (const node of graphPayload["@graph"]) {
    const schemaType = node["@type"];
    const nodeId = node["@id"];
    if (!schemaType || !nodeId) continue;

    const feedType = nodeTypeForSchemaType(schemaType, nodeId);
    if (!feedType) continue;

    seenNodeIds.add(nodeId);
    nodes.push({
      type: feedType,
      id: nodeId,
      name: node.name || record.domain,
      ...(feedType === "Offer"
        ? {
            url: node.url || null,
            price: node.price ?? null,
            priceCurrency: node.priceCurrency || "USD",
            availability: node.availability || null,
            validThrough: node.validThrough || null,
          }
        : {}),
      ...(feedType === "Provider" ? { url: node.url || "https://www.namesilo.com/" } : {}),
      ...(feedType === "TLD" ? { termCode: node.termCode || record.tld || ".com" } : {}),
    });

    if (feedType === "Offer") {
      edges.push({ type: "hasOffer", from: domainNodeId, to: nodeId });
      const providerId = `${metadataBaseUrl}/#provider-namesilo`;
      if (node.seller?.["@id"]) {
        edges.push({ type: "soldBy", from: nodeId, to: node.seller["@id"] });
      } else {
        edges.push({ type: "soldBy", from: nodeId, to: providerId });
      }
    }

    if (feedType === "Category" || feedType === "UseCase" || feedType === "TLD" || feedType === "ComparableDomain") {
      edges.push({ type: "relatedTo", from: domainNodeId, to: nodeId });
    }

    if (feedType === "Provider") {
      edges.push({ type: "listedWith", from: domainNodeId, to: nodeId });
    }
  }

  return {
    type: "MarketplaceGraphRecord",
    domain: record.domain,
    slug: record.slug,
    canonicalUrl,
    graphUrl: `${metadataBaseUrl}/api/domains/${record.slug}/graph.json`,
    nodes,
    edges,
  };
}

function streamDomainGraphNdjson(records, res, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  for (const record of records) {
    const line = buildGraphFeedRecord(record, metadataBaseUrl);
    if (line) res.write(`${JSON.stringify(line)}\n`);
  }
  res.end();
}

module.exports = {
  buildGraphFeedRecord,
  streamDomainGraphNdjson,
};
