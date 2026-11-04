// One honest description of the auction data currently loaded, used by the
// hubs, guides and data pages so they all say the same thing.
const { getAuctionDataMeta, isAuctionDataStale } = require("../candidate-store/auction-snapshot");

function formatLongDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatUtcTime(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(11, 16);
}

function formatFetched(iso) {
  return `${formatLongDate(iso)} at ${formatUtcTime(iso)} UTC`;
}

function formatEndRange(stats) {
  if (!stats?.firstEnd || !stats?.lastEnd) return "";
  const first = formatLongDate(stats.firstEnd);
  const last = formatLongDate(stats.lastEnd);
  return first === last ? `on ${first}` : `between ${first} and ${last}`;
}

// Plain-text sentences (no HTML). Returns null when nothing is loaded.
function describeAuctionData(meta = getAuctionDataMeta(), now = Date.now()) {
  if (!meta?.stats) return null;
  const { stats } = meta;
  const left = meta.excluded?.brandSafety
    ? ` We leave out ${meta.excluded.brandSafety.toLocaleString("en-US")} adult, gambling, piracy, brand look-alike and test names.`
    : "";
  const stale = isAuctionDataStale(meta, now);
  const status = stale
    ? ` All of these auctions have since ended, so none can be bid on now; the figures are kept as a record of that batch.`
    : ` All were running when fetched and end ${formatEndRange(stats)}; NameSilo's expired-domain auctions are short, so this list changes every day.`;
  return {
    fetchedAt: meta.fetchedAt,
    fetchedLabel: formatFetched(meta.fetchedAt),
    fetchedDate: formatLongDate(meta.fetchedAt),
    live: meta.origin === "namesilo-api",
    stale,
    total: stats.total,
    sentence: `Data: every expired-domain auction NameSilo listed as active when we fetched its auction API on ${formatFetched(meta.fetchedAt)}: ${stats.total.toLocaleString("en-US")} auctions across ${stats.tldCount} extensions.${left}${status}`,
  };
}

module.exports = {
  describeAuctionData,
  formatLongDate,
  formatFetched,
  formatEndRange,
};
