#!/usr/bin/env node
// Writes data/namesilo-auctions-snapshot.json, the auction data committed with
// the site and loaded on boot when no NAMESILO_API_KEY is set.
//
//   node scripts/build-auction-snapshot.js --from-file=/path/to/dump.json
//   NAMESILO_API_KEY=... node scripts/build-auction-snapshot.js --from-api
//
// A dump file is { fetchedAtUtc, auctions: [raw NameSilo listAuctions records] }.
// Only the fields the site shows are kept.
const fs = require("fs");
const path = require("path");
const {
  SNAPSHOT_PATH,
  compactSnapshot,
  expandSnapshot,
  buildAuctionStore,
  fetchAllNameSiloAuctions,
} = require("../server/candidate-store/auction-snapshot");

function readArg(name) {
  const hit = process.argv.slice(2).find((arg) => arg === name || arg.startsWith(`${name}=`));
  if (!hit) return null;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
}

(async () => {
  const fromFile = readArg("--from-file");
  const fromApi = readArg("--from-api");
  const outPath = readArg("--out") || SNAPSHOT_PATH;
  let auctions;
  let fetchedAt;

  if (typeof fromFile === "string") {
    const expanded = expandSnapshot(JSON.parse(fs.readFileSync(fromFile, "utf8")));
    if (!expanded) throw new Error(`${fromFile} has no fetchedAtUtc or auctions.`);
    auctions = expanded.auctions;
    fetchedAt = expanded.fetchedAt;
  } else if (fromApi) {
    fetchedAt = new Date().toISOString();
    auctions = await fetchAllNameSiloAuctions({ apiKey: process.env.NAMESILO_API_KEY });
  } else {
    throw new Error("Use --from-file=<dump.json> or --from-api (needs NAMESILO_API_KEY).");
  }

  const snapshot = compactSnapshot(auctions, { fetchedAt });
  fs.writeFileSync(outPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  const { meta } = buildAuctionStore(auctions, { fetchedAt });
  process.stdout.write(
    `Wrote ${snapshot.count} auctions (fetched ${snapshot.fetchedAtUtc}) to ${path.relative(process.cwd(), outPath)}\n` +
      `  loaded after filters: ${meta.loadedCount}, indexable now: ${meta.indexedCount}\n` +
      `  excluded: ${JSON.stringify(meta.excluded)}\n`
  );
})().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
