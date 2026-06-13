import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSource = fs.readFileSync(path.join(__dirname, "../src/intent-fetch-api.js"), "utf8");
const signalBlock = apiSource.slice(0, apiSource.indexOf("export function getCandidateStatusLabel"));
const apiContext = { module: { exports: {} }, exports: {} };
apiContext.exports = apiContext.module.exports;

vm.runInNewContext(
  `${signalBlock.replace(/^export function detectBriefSignals/gm, "function detectBriefSignals")}
module.exports = { detectBriefSignals };`,
  apiContext
);

const { detectBriefSignals } = apiContext.module.exports;

test("detectBriefSignals normalizes malformed SaaS tokens", () => {
  const signals = detectBriefSignals("Cybersecurity SaaSX");
  assert.equal(JSON.stringify(signals), JSON.stringify(["Cybersecurity", "SaaS"]));
  assert.doesNotMatch(signals.join(" "), /Saasx/i);
});

test("detectBriefSignals dedupes pattern and raw labels case-insensitively", () => {
  const signals = detectBriefSignals("saas cybersecurity saas");
  assert.equal(JSON.stringify(signals), JSON.stringify(["Cybersecurity", "SaaS"]));
});

test("getCandidateReasonLine formats matched terms without throwing", () => {
  const reasonBlock = apiSource.slice(
    apiSource.indexOf("function titleCaseWord"),
    apiSource.indexOf("export async function fetchDomainCandidates")
  );
  const reasonContext = { module: { exports: {} }, exports: {} };
  reasonContext.exports = reasonContext.module.exports;
  vm.runInNewContext(
    `${signalBlock.replace(/^export function detectBriefSignals/gm, "function detectBriefSignals")}
${reasonBlock.replace(/^export function getCandidateReasonLine/gm, "function getCandidateReasonLine")}
module.exports = { getCandidateReasonLine };`,
    reasonContext
  );
  const { getCandidateReasonLine } = reasonContext.module.exports;
  assert.equal(getCandidateReasonLine({ matchedTerms: ["legal", "ai"] }), "Legal + AI signal");
  assert.equal(getCandidateReasonLine({ matchedTerms: ["workflow"] }), "Workflow");
});

test("detected signal normalization lock preserves normalizeSignalLabel helper", () => {
  assert.match(apiSource, /function normalizeSignalLabel\(label\)/);
  assert.match(apiSource, /\^saas\/i\.test\(cleaned\)\) return "SaaS"/);
  assert.match(apiSource, /function titleCaseWord\(value\)/);
  assert.match(apiSource, /dedupeNormalizedLabels/);
});
