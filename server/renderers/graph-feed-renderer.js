const { buildDomainProductGraph } = require("../candidate-store/domain-graph");
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");

function nodeTypeForSchemaType(schemaType, nodeId = "") {
  if (schemaType === "Product" && nodeId.includes("#comparable-")) return "ComparableDomain";
  if (schemaType === "Product") return "Domain";
  if (schemaType === "Offer") return "Offer";
  if (schemaType === "Organization" && nodeId.includes("#provider-")) return "Provider";
  if (schemaType === "DefinedTerm" && nodeId.includes("#category-")) return "Category";
  if (schemaType === "DefinedTerm" && nodeId.includes("#use-case-")) return "UseCase";
  if (schemaType === "DefinedTerm" && nodeId.includes("#tld")) return "TLD";
  return null;
}

function pushNode(nodes, seen, node) {
  if (!node?.id || seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function pushEdge(edges, edge) {
  if (!edge?.from || !edge?.to || !edge?.type) return;
  edges.push(edge);
}

function buildGraphFeedRecord(record, metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  if (!record?.slug || !record.domain) return null;

  const graphPayload = buildDomainProductGraph(record, metadataBaseUrl);
  if (!graphPayload?.["@graph"]) return null;

  const canonicalUrl = graphPayload.canonicalUrl;
  const domainNodeId = `${canonicalUrl}#domain`;
  const nodes = [];
  const edges = [];
  const seenNodeIds = new Set();

  pushNode(nodes, seenNodeIds, {
    type: "Domain",
    id: domainNodeId,
    name: record.domain,
    url: canonicalUrl,
    slug: record.slug,
    status: record.status,
    seoTier: record.seoTier,
  });

  const auctionUrl =
    record.acquisitionPath?.actionUrl || record.auctionUrl || record.acquisitionPath?.url || null;
  if (auctionUrl) {
    const auctionNodeId = `${canonicalUrl}#auction`;
    pushNode(nodes, seenNodeIds, {
      type: "Auction",
      id: auctionNodeId,
      name: `${record.domain} auction`,
      url: auctionUrl,
      provider: record.provider || "NameSilo",
      currentBid: record.currentBid ?? record.acquisitionPath?.currentBid ?? null,
      bidCount: record.bidCount ?? record.acquisitionPath?.bidCount ?? 0,
      endsAt: record.auctionEndsAt ?? record.acquisitionPath?.auctionEndsAt ?? null,
    });
    pushEdge(edges, { type: "listedInAuction", from: domainNodeId, to: auctionNodeId });
  }

  (record.categoryGuesses || []).forEach((label, index) => {
    const categoryId = `${metadataBaseUrl}/categories/${encodeURIComponent(String(label).toLowerCase().replace(/\s+/g, "-"))}#category`;
    pushNode(nodes, seenNodeIds, { type: "Category", id: categoryId, name: label });
    pushNode(nodes, seenNodeIds, {
      type: "Intent",
      id: `${categoryId}-intent`,
      name: label,
    });
    pushEdge(edges, { type: "inCategory", from: domainNodeId, to: categoryId });
    pushEdge(edges, { type: "hasIntent", from: domainNodeId, to: `${categoryId}-intent` });
  });

  (record.buyerUseCases || []).forEach((label, index) => {
    const useCaseId = `${canonicalUrl}#use-case-${index + 1}`;
    const personaId = `${metadataBaseUrl}/personas/${encodeURIComponent(String(label).toLowerCase().replace(/\s+/g, "-"))}#persona`;
    pushNode(nodes, seenNodeIds, { type: "UseCase", id: useCaseId, name: label });
    pushNode(nodes, seenNodeIds, { type: "Persona", id: personaId, name: label });
    pushEdge(edges, { type: "supportsUseCase", from: domainNodeId, to: useCaseId });
    pushEdge(edges, { type: "targetsPersona", from: domainNodeId, to: personaId });
  });

  for (const node of graphPayload["@graph"]) {
    const schemaType = node["@type"];
    const nodeId = node["@id"];
    if (!schemaType || !nodeId) continue;

    const feedType = nodeTypeForSchemaType(schemaType, nodeId);
    if (!feedType || feedType === "Domain") continue;

    pushNode(nodes, seenNodeIds, {
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
      pushEdge(edges, { type: "hasOffer", from: domainNodeId, to: nodeId });
      const providerId = `${metadataBaseUrl}/#provider-namesilo`;
      pushEdge(edges, {
        type: "soldBy",
        from: nodeId,
        to: node.seller?.["@id"] || providerId,
      });
    }

    if (feedType === "Category" || feedType === "UseCase" || feedType === "TLD" || feedType === "ComparableDomain") {
      pushEdge(edges, { type: "relatedTo", from: domainNodeId, to: nodeId });
    }

    if (feedType === "Provider") {
      pushEdge(edges, { type: "listedWith", from: domainNodeId, to: nodeId });
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
