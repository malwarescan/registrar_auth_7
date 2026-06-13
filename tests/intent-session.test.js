const test = require("node:test");
const assert = require("node:assert/strict");
const {
  appendNameSiloTrackingParams,
  buildAcquirePath,
  buildDomainDetailPath,
  createIntentRecord,
  getIntent,
} = require("../server/domain-fetch/intent-session");

test("createIntentRecord stores retrievable intent metadata", () => {
  const record = createIntentRecord({
    brief: "Founder workflow",
    interpretedIntent: {
      businessType: "workflow software",
      productCategory: "Workflow SaaS",
      targetBuyer: ["founders", "operators"],
    },
    strategy: { primaryIntent: "workflow software" },
    fetchedAt: new Date().toISOString(),
    requestId: "fetch_test",
  });

  assert.match(record.intentId, /^if_[a-f0-9]{4}$/);
  assert.equal(record.intentSlug, "founder-workflow");
  assert.equal(getIntent(record.intentId)?.label, "Founder workflow");
});

test("buildDomainDetailPath carries intent query params", () => {
  const path = buildDomainDetailPath("workflowfounder-com", {
    intentId: "if_7f3a",
    intentSlug: "founder-workflow",
    rank: 1,
    fitScore: 83,
  });
  assert.equal(
    path,
    "/domains/workflowfounder-com?intent_id=if_7f3a&intent=founder-workflow&rank=1&fit=83"
  );
});

test("buildAcquirePath creates redirect endpoint query", () => {
  const path = buildAcquirePath({
    domain: "workflowfounder.com",
    intentId: "if_7f3a",
    candidateId: "candidate_workflowfounder-com_reg",
    source: "domain-detail",
    rank: 1,
    fitScore: 83,
  });
  assert.match(path, /^\/out\/acquire\?/);
  assert.match(path, /domain=workflowfounder\.com/);
  assert.match(path, /intent_id=if_7f3a/);
});

test("appendNameSiloTrackingParams adds safe UTM fields", () => {
  const url = appendNameSiloTrackingParams("https://www.namesilo.com/domain/search-domains?query=workflowfounder.com", {
    intentRecord: { intentId: "if_7f3a", intentSlug: "founder-workflow", label: "Founder workflow" },
    candidate: { slug: "workflowfounder-com", domain: "workflowfounder.com" },
    rank: 1,
    fitScore: 83,
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("utm_source"), "snatch");
  assert.equal(parsed.searchParams.get("utm_campaign"), "founder-workflow");
  assert.equal(parsed.searchParams.get("snatch_intent_id"), "if_7f3a");
  assert.equal(parsed.searchParams.get("snatch_fit"), "83");
});
