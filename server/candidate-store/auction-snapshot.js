// Loads NameSilo expired-domain auctions into the candidate store, either from
// the committed snapshot (data/namesilo-auctions-snapshot.json) or from the
// NameSilo API when NAMESILO_API_KEY is set. Both go through the same
// pipeline: normalize -> validate -> brand-safety -> product record (scores and
// quality flags) -> indexing policy.
const fs = require("fs");
const path = require("path");
const { normalizeAuctionRecord } = require("../domain-fetch/fetch-namesilo-auctions");
const { normalizeAuctionToProductRecord } = require("./product-record");
const { validateNormalizedAuction, validateProductRecord } = require("./ingest-validation");
const { checkBrandSafety } = require("./brand-safety");
const { applyIndexingPolicy } = require("./indexing-policy");
const { getSitemapFreshnessMs } = require("./sitemap-freshness");
const { configureStorePaths } = require("./durable-candidates");
const { setIndexNowBatchRecords } = require("./index-now-batch");
const { fetchNameSiloAuctionRawPage } = require("./ingest-runner");
const { toSlug } = require("../domain-fetch/classify-domain");

const ROOT = path.resolve(__dirname, "..", "..");
const SNAPSHOT_PATH = path.join(ROOT, "data", "namesilo-auctions-snapshot.json");
// Only the fields the site shows are kept in the committed snapshot.
const SNAPSHOT_FIELDS = ["domain", "openingBid", "currentBid", "bidsQuantity", "domainCreatedOn", "auctionEndsOnUtc"];
const SNAPSHOT_SOURCE = "NameSilo API listAuctions (statusId=2 active, typeId=3 expired-domain auctions)";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const API_PAGE_SIZE = 200;
const API_MAX_PAGES = 400;

let currentMeta = null;
let lastRefreshError = null;
let refreshTimer = null;

function toUtcIso(value) {
  if (!value) return null;
  const text = String(value).trim();
  const withZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Raw API records -> compact committed form (one array row per auction).
// Names that fail the brand-safety filter are left out of the file (they would
// never get a page), but their number is kept so totals stay honest.
function compactSnapshot(rawAuctions, options = {}) {
  const withDomain = (rawAuctions || []).filter((raw) => raw && raw.domain);
  const excludedByCategory = {};
  const safe = withDomain.filter((raw) => {
    const result = checkBrandSafety(raw.domain);
    if (!result.safe) excludedByCategory[result.category] = (excludedByCategory[result.category] || 0) + 1;
    return result.safe;
  });
  const rows = safe.map((raw) => SNAPSHOT_FIELDS.map((field) => (raw[field] === undefined ? null : raw[field])));
  return {
    source: options.source || SNAPSHOT_SOURCE,
    fetchedAtUtc: toUtcIso(options.fetchedAt) || new Date().toISOString(),
    fetchedCount: withDomain.length,
    excludedBrandSafety: withDomain.length - safe.length,
    excludedByCategory,
    count: rows.length,
    fields: SNAPSHOT_FIELDS,
    rows,
  };
}

// Accepts the compact form or a plain { fetchedAtUtc, auctions: [...] } dump.
function expandSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const fetchedAt = toUtcIso(snapshot.fetchedAtUtc || snapshot.fetchedAt);
  if (!fetchedAt) return null;
  let auctions = [];
  if (Array.isArray(snapshot.rows) && Array.isArray(snapshot.fields)) {
    auctions = snapshot.rows.map((row) => Object.fromEntries(snapshot.fields.map((field, index) => [field, row[index]])));
  } else if (Array.isArray(snapshot.auctions)) {
    auctions = snapshot.auctions;
  }
  return {
    fetchedAt,
    source: snapshot.source || SNAPSHOT_SOURCE,
    auctions,
    fetchedCount: Number.isFinite(snapshot.fetchedCount) ? snapshot.fetchedCount : auctions.length,
    excludedBrandSafety: Number.isFinite(snapshot.excludedBrandSafety) ? snapshot.excludedBrandSafety : 0,
    excludedByCategory: snapshot.excludedByCategory || {},
  };
}

function readSnapshotFile(filePath = SNAPSHOT_PATH) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return expandSnapshot(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Market figures over the auctions loaded on the site, as they stood at fetch
// time (names removed by the brand-safety filter are not counted).
function computeAuctionStats(auctions) {
  if (!auctions.length) return null;
  const bids = auctions.map((a) => a.bidCount || 0);
  const withBids = auctions.filter((a) => (a.bidCount || 0) > 0);
  const opening = auctions.map((a) => a.openingBid ?? a.currentBid).filter(Number.isFinite).sort((a, b) => a - b);
  const bidPrices = withBids.map((a) => a.currentBid).filter(Number.isFinite).sort((a, b) => a - b);
  const ends = auctions.map((a) => a.auctionEndsAt).filter(Boolean).sort();
  const tldCounts = {};
  auctions.forEach((a) => {
    tldCounts[a.tld] = (tldCounts[a.tld] || 0) + 1;
  });
  const minOpening = opening[0] ?? null;
  return {
    total: auctions.length,
    zeroBids: auctions.length - withBids.length,
    withBids: withBids.length,
    maxBidCount: Math.max(...bids),
    openingMin: minOpening,
    openingMedian: median(opening),
    openingMax: opening[opening.length - 1] ?? null,
    atMinimumOpening: opening.filter((value) => value === minOpening).length,
    bidPriceMedian: median(bidPrices),
    bidPriceMax: bidPrices[bidPrices.length - 1] ?? null,
    firstEnd: ends[0] || null,
    lastEnd: ends[ends.length - 1] || null,
    tldCount: Object.keys(tldCounts).length,
    topTlds: Object.entries(tldCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tld, count]) => ({ tld, count })),
  };
}

// Runs raw API records through the pipeline. Returns the slug -> record map
// and a summary of what was loaded and why records were left out.
function buildAuctionStore(rawAuctions, options = {}) {
  const now = options.now ?? Date.now();
  const fetchedAt = toUtcIso(options.fetchedAt) || new Date(now).toISOString();
  const fetchedMs = new Date(fetchedAt).getTime();
  const records = {};
  const seen = new Set();
  const valid = [];
  const excluded = { invalid: 0, duplicate: 0, brandSafety: 0, byCategory: {} };

  for (const raw of rawAuctions || []) {
    const auction = normalizeAuctionRecord(raw || {});
    if (!validateNormalizedAuction(auction).valid) {
      excluded.invalid += 1;
      continue;
    }
    const slug = toSlug(auction.domain);
    if (seen.has(slug)) {
      excluded.duplicate += 1;
      continue;
    }
    seen.add(slug);
    const safety = checkBrandSafety(auction.domain);
    if (!safety.safe) {
      excluded.brandSafety += 1;
      excluded.byCategory[safety.category] = (excluded.byCategory[safety.category] || 0) + 1;
      continue;
    }
    valid.push(auction);
    // A fetched record is trusted until the sitemap freshness window passes
    // or the auction ends, whichever is first.
    const endsMs = auction.auctionEndsAt ? new Date(auction.auctionEndsAt).getTime() : Infinity;
    const statusExpiresAt = new Date(Math.min(fetchedMs + getSitemapFreshnessMs(), endsMs)).toISOString();
    const record = normalizeAuctionToProductRecord(auction, null, { now, verifiedAt: fetchedAt, statusExpiresAt });
    if (!validateProductRecord(record).valid) {
      excluded.invalid += 1;
      continue;
    }
    records[record.slug] = record;
  }

  // Names already removed when the snapshot file was written still count.
  excluded.brandSafety += options.excludedBrandSafety || 0;
  for (const [category, count] of Object.entries(options.excludedByCategory || {})) {
    excluded.byCategory[category] = (excluded.byCategory[category] || 0) + count;
  }
  const list = Object.values(records);
  const indexed = applyIndexingPolicy(list, { now, publishedAt: fetchedAt });
  const meta = {
    source: options.source || SNAPSHOT_SOURCE,
    origin: options.origin || "snapshot",
    fetchedAt,
    loadedAt: new Date(now).toISOString(),
    fetchedCount: options.fetchedCount ?? (rawAuctions || []).length,
    loadedCount: list.length,
    indexedCount: indexed.size,
    excluded,
    stats: computeAuctionStats(valid),
  };
  return { records, meta };
}

function installAuctionStore(result) {
  configureStorePaths({ indexNowBatchPath: SNAPSHOT_PATH });
  setIndexNowBatchRecords(result.records);
  currentMeta = result.meta;
  return currentMeta;
}

function loadCommittedSnapshot(options = {}) {
  const snapshot = readSnapshotFile(options.filePath || SNAPSHOT_PATH);
  if (!snapshot) return null;
  return installAuctionStore(
    buildAuctionStore(snapshot.auctions, {
      fetchedAt: snapshot.fetchedAt,
      source: snapshot.source,
      origin: "snapshot",
      now: options.now,
      fetchedCount: snapshot.fetchedCount,
      excludedBrandSafety: snapshot.excludedBrandSafety,
      excludedByCategory: snapshot.excludedByCategory,
    })
  );
}

async function fetchAllNameSiloAuctions({ apiKey, fetchFn = fetch, pageSize = API_PAGE_SIZE, maxPages = API_MAX_PAGES } = {}) {
  if (!apiKey) throw new Error("Missing NameSilo API key.");
  const all = [];
  const seen = new Set();
  let fullPage = null;
  for (let page = 1; page <= maxPages; page += 1) {
    const raw = await fetchNameSiloAuctionRawPage({ apiKey, fetchFn, page, pageSize });
    const fresh = raw.filter((item) => item?.domain && !seen.has(String(item.domain).toLowerCase()));
    fresh.forEach((item) => seen.add(String(item.domain).toLowerCase()));
    all.push(...fresh);
    // The API may cap the page size below what we asked for, so a short page
    // is measured against the first page, not the requested size.
    if (fullPage === null) fullPage = raw.length;
    if (!raw.length || !fresh.length || raw.length < Math.min(pageSize, fullPage)) break;
  }
  return all;
}

// Replaces the store with a fresh API pull. On any failure, or an empty
// result, the last good data stays in place and the error is recorded.
async function refreshAuctionStoreFromApi(options = {}) {
  try {
    const fetchedAt = new Date(options.now ?? Date.now()).toISOString();
    const raw = await fetchAllNameSiloAuctions(options);
    if (!raw.length) throw new Error("NameSilo returned no auctions; keeping the previous data.");
    const meta = installAuctionStore(
      buildAuctionStore(raw, { fetchedAt, origin: "namesilo-api", now: options.now })
    );
    lastRefreshError = null;
    return { ok: true, meta };
  } catch (error) {
    // Never let the key leak into logs or /health through an error message.
    const raw = error instanceof Error ? error.message : String(error);
    const message = (options.apiKey ? raw.split(options.apiKey).join("[key]") : raw).slice(0, 300);
    lastRefreshError = { at: new Date().toISOString(), message };
    return { ok: false, error: lastRefreshError, meta: currentMeta };
  }
}

// Refresh on boot and every 6 hours. Does nothing without an API key, in which
// case the committed snapshot stays loaded and its auctions turn "ended" (and
// noindex) on their own as their end times pass.
function startAuctionRefreshLoop(options = {}) {
  const apiKey = options.apiKey;
  if (!apiKey) return null;
  const intervalMs = options.intervalMs || REFRESH_INTERVAL_MS;
  const log = options.log || (() => {});
  const run = async () => {
    const result = await refreshAuctionStoreFromApi({ apiKey, fetchFn: options.fetchFn });
    if (result.ok) log(`NameSilo auctions refreshed: ${result.meta.loadedCount} loaded, ${result.meta.indexedCount} indexable.`);
    else log(`NameSilo auction refresh failed (keeping previous data): ${result.error.message}`);
    return result;
  };
  stopAuctionRefreshLoop();
  refreshTimer = setInterval(run, intervalMs);
  if (typeof refreshTimer.unref === "function") refreshTimer.unref();
  return run();
}

function stopAuctionRefreshLoop() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function getAuctionDataMeta() {
  return currentMeta;
}

function getLastRefreshError() {
  return lastRefreshError;
}

// True once every auction in the loaded data has passed its end time.
function isAuctionDataStale(meta = currentMeta, now = Date.now()) {
  const lastEnd = meta?.stats?.lastEnd;
  if (!lastEnd) return true;
  return new Date(lastEnd).getTime() <= now;
}

function resetAuctionDataMeta() {
  currentMeta = null;
  lastRefreshError = null;
}

module.exports = {
  SNAPSHOT_PATH,
  SNAPSHOT_FIELDS,
  REFRESH_INTERVAL_MS,
  compactSnapshot,
  expandSnapshot,
  readSnapshotFile,
  computeAuctionStats,
  buildAuctionStore,
  installAuctionStore,
  loadCommittedSnapshot,
  fetchAllNameSiloAuctions,
  refreshAuctionStoreFromApi,
  startAuctionRefreshLoop,
  stopAuctionRefreshLoop,
  getAuctionDataMeta,
  getLastRefreshError,
  isAuctionDataStale,
  resetAuctionDataMeta,
};
