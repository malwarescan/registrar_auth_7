const NAMESILO_AUCTIONS_ENDPOINT = "https://www.namesilo.com/public/api/listAuctions";
const { splitDomain } = require("./classify-domain");

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toEndsIn(utcValue) {
  if (!utcValue) return "N/A";
  const target = new Date(utcValue);
  if (Number.isNaN(target.getTime())) return "N/A";
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "Ended";
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

function normalizeAuctionRecord(raw) {
  const domain = String(raw.domain || "").toLowerCase();
  const { root, tld } = splitDomain(domain);
  const auctionEndsAt = toIsoDate(raw.auctionEndsOnUtc || raw.auctionEndsOn);
  return {
    id: String(raw.id || raw.domainId || domain),
    domain,
    root,
    tld,
    currentBid: toNumber(raw.currentBid),
    bidCount: Number.parseInt(raw.bidsQuantity || raw.hasBids || 0, 10) || 0,
    auctionEndsAt,
    auctionEndsIn: toEndsIn(auctionEndsAt),
    auctionUrl: raw.url || `https://www.namesilo.com/auctions/${domain}`,
  };
}

function extractAuctionRecords(payload) {
  const body = payload?.reply?.body;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.record)) return body.record;
  if (Array.isArray(body?.auctions)) return body.auctions;
  if (Array.isArray(body?.auction)) return body.auction;
  return [];
}

async function fetchNameSiloAuctions({ apiKey, fetchFn = fetch, pageSize = 100 }) {
  const params = new URLSearchParams({
    version: "1",
    type: "json",
    key: apiKey,
    statusId: "2",
    typeId: "3",
    page: "1",
    pageSize: String(pageSize),
    orderBy: "auctionEndsOnUtc",
    orderType: "ASC",
  });
  const response = await fetchFn(`${NAMESILO_AUCTIONS_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("NameSilo auction request failed.");
  if (String(payload?.reply?.code || "") !== "300") {
    throw new Error(payload?.reply?.detail || "NameSilo auctions returned non-success code.");
  }
  return extractAuctionRecords(payload).map(normalizeAuctionRecord);
}

module.exports = {
  fetchNameSiloAuctions,
};
