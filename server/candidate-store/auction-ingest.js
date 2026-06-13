const fs = require("fs");
const path = require("path");
const { normalizeAuctionRecord, extractAuctionRecords } = require("../domain-fetch/fetch-namesilo-auctions");
const { upsertProductRecordFromAuction } = require("./durable-candidates");
const { fetchNameSiloAuctionPage } = require("./ingest-runner");

async function ingestNameSiloAuctionPage({ apiKey, fetchFn = fetch, page = 1, pageSize = 200 }) {
  const result = await fetchNameSiloAuctionPage({ apiKey, fetchFn, page, pageSize });
  const records = [];
  for (const auction of result.auctions) {
    const record = upsertProductRecordFromAuction(auction);
    if (record) records.push(record);
  }
  return { page: result.page, count: records.length, records };
}

async function ingestNameSiloAuctions(options = {}) {
  const {
    apiKey,
    fetchFn = fetch,
    pageSize = 200,
    maxPages = null,
    onPage = null,
  } = options;

  if (!apiKey) throw new Error("Missing NameSilo API key.");

  let page = 1;
  let total = 0;
  let lastPageCount = pageSize;

  while (lastPageCount === pageSize) {
    if (maxPages && page > maxPages) break;
    const result = await ingestNameSiloAuctionPage({ apiKey, fetchFn, page, pageSize });
    lastPageCount = result.count;
    total += result.count;
    if (typeof onPage === "function") onPage({ page, count: result.count, total });
    if (lastPageCount < pageSize) break;
    page += 1;
  }

  return { pages: page, total };
}

module.exports = {
  ingestNameSiloAuctionPage,
  ingestNameSiloAuctions,
};
