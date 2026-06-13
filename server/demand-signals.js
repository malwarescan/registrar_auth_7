const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SIGNALS_PATH = path.join(ROOT, "data", "intent-signals.jsonl");

function appendDemandSignal(record, filePath = SIGNALS_PATH) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    process.stderr.write(
      `[demand-signals] Failed to append intent signal: ${
        error instanceof Error ? error.message : "Unknown error"
      }\n`
    );
  }
}

function buildDemandSignalFromFetch({ intentRecord, decisionCandidates = [], fetchedAt, sessionId }) {
  return {
    timestamp: fetchedAt || new Date().toISOString(),
    intentId: intentRecord?.intentId || null,
    intentSlug: intentRecord?.intentSlug || null,
    rawBrief: intentRecord?.brief || "",
    interpretedLabel: intentRecord?.label || "",
    category: intentRecord?.intentCategory || null,
    candidateCount: decisionCandidates.length,
    topCandidateDomains: decisionCandidates.slice(0, 10).map((candidate) => candidate.domain),
    source: "intent-fetch",
    sessionId: sessionId || intentRecord?.requestId || null,
  };
}

function logDemandSignalFromFetch(payload) {
  appendDemandSignal(buildDemandSignalFromFetch(payload));
}

module.exports = {
  SIGNALS_PATH,
  appendDemandSignal,
  buildDemandSignalFromFetch,
  logDemandSignalFromFetch,
};
