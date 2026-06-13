const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildScoreBackedEvidenceRows,
  buildHeroSubtitle,
  renderCompactScoreBreakdown,
  renderSummaryStrip,
  renderDecisionCard,
  buildTrustRowHtml,
  buildAlternativeComparisonRowHtml,
  buildCandidateJsonLd,
  buildSchemaDescription,
  renderCandidatePageHtml,
  formatWithArticle,
  isWeakTokenMatch,
  buildTermEvidence,
  normalizeTaxonomyCategory,
  buildCalibratedRecommendation,
  buildTradeoffLabel,
  buildPageTitle,
} = require("../server/candidate-detail-page");
const { createIntentRecord } = require("../server/domain-fetch/intent-session");
const { toPublicMetadataUrl } = require("../server/public-url");
const { buildStableSitemapPaths } = require("../server/sitemap");

function mockIntentRecord() {
  return createIntentRecord({
    brief: "AI Receptionist",
    interpretedIntent: {
      productCategory: "AI Software",
      businessType: "software",
      targetBuyer: ["operations teams", "small business owners", "automation buyers"],
    },
    strategy: { primaryIntent: "ai-software" },
    fetchedAt: new Date().toISOString(),
    requestId: "test-req",
  });
}

function mockLegalAiIntentRecord() {
  return createIntentRecord({
    brief: "Legal AI",
    interpretedIntent: {
      productCategory: "AI Software",
      businessType: "software",
      targetBuyer: ["legal teams", "law firms", "compliance buyers"],
    },
    strategy: { primaryIntent: "ai-software" },
    fetchedAt: new Date().toISOString(),
    requestId: "test-legal-req",
  });
}

function sampleCandidate(overrides = {}) {
  return {
    candidateId: "candidate_anudesk-com_auction",
    candidateType: "auction",
    domain: "anudesk.com",
    slug: "anudesk-com",
    tld: ".com",
    source: "namesilo-auction",
    status: "auction-active",
    sessionRank: 1,
    statusVerifiedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    statusExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    matchedTerms: ["desk", "support"],
    matchedConceptGroups: ["required-concept", "adjacent-concept"],
    primaryIntent: "ai software",
    category: "ai-software",
    confidence: 0.42,
    catch: "Current bid is not final price.",
    nextAction: "Watch auction timing, compare alternatives, then open the auction path.",
    lessIdealIf: "You need fixed pricing and immediate checkout.",
    buyerFit: ["operations teams", "small business owners", "automation buyers"],
    scores: {
      overall: 76,
      semanticFit: 74,
      buyerFit: 71,
      brandability: 75,
      pronounceability: 78,
      categoryClarity: 57,
      tldTrust: 96,
      acquisitionFriction: 62,
      acquisitionSignal: 74,
      riskAdjusted: 73,
    },
    acquisitionPath: {
      type: "auction",
      provider: "NameSilo",
      currentBid: 1,
      priceCurrency: "USD",
      actionUrl: "https://www.namesilo.com/domain/search-domains?query=anudesk.com",
      auctionEndsAt: "2026-06-12T08:00:00.000Z",
      bidCount: 1,
      priceType: "current-bid",
    },
    relatedCandidates: [
      {
        candidateId: "candidate_b",
        domain: "sbobettai.com",
        url: "/domains/sbobettai-com",
        status: "auction-active",
        rank: 2,
        fitScore: 68,
        currentBid: 1,
        scores: { overall: 68, pronounceability: 52, tldTrust: 74, brandability: 60, semanticFit: 60, categoryClarity: 57 },
      },
      {
        candidateId: "candidate_c",
        domain: "aiu18.top",
        url: "/domains/aiu18-top",
        status: "auction-active",
        rank: 3,
        fitScore: 61,
        currentBid: 1,
        scores: { overall: 61, tldTrust: 62, pronounceability: 70 },
      },
    ],
    ...overrides,
  };
}

test("normalizeTaxonomyCategory maps AI Product to AI Software", () => {
  assert.equal(normalizeTaxonomyCategory("AI Product"), "AI Software");
});

test("domain-specific evidence mentions intent and domain signals", () => {
  const intentRecord = mockIntentRecord();
  const rows = buildScoreBackedEvidenceRows(sampleCandidate(), sampleCandidate().scores, true, intentRecord);
  assert.ok(rows.some((row) => /desk signals support/i.test(row.detail)));
  assert.ok(rows.some((row) => /receptionist|coined AI assistant/i.test(row.detail)));
  assert.equal(rows.some((row) => /Commercial software fit/i.test(row.title)), false);
});

test("weak ai suffix uses brandable signal copy", () => {
  assert.equal(isWeakTokenMatch("ai", "sbobettai.com"), true);
  const evidence = buildTermEvidence("ai", { domain: "sbobettai.com" });
  assert.match(evidence.title, /Brandable AI signal/i);
  assert.match(evidence.detail, /core brand needs explanation/i);
});

test("hero subtitle includes domain candidate phrasing with category", () => {
  const intentRecord = mockIntentRecord();
  const line = buildHeroSubtitle(sampleCandidate(), intentRecord, true);
  assert.equal(line, "AI Receptionist domain candidate in AI Software");
  assert.doesNotMatch(line, /AI Product/i);
});

test("page title uses intent domain candidate pattern", () => {
  const intentRecord = mockIntentRecord();
  const title = buildPageTitle(sampleCandidate(), intentRecord);
  assert.equal(title, "anudesk.com — AI Receptionist Domain Candidate | Snatch.auction");
  assert.doesNotMatch(title, /Candidate match/i);
});

test("legal ai desk domain uses desk-calibrated copy without overclaiming title", () => {
  const intentRecord = mockLegalAiIntentRecord();
  const candidate = sampleCandidate({ matchedTerms: ["desk", "support"] });
  assert.equal(
    buildPageTitle(candidate, intentRecord),
    "anudesk.com — Legal AI Domain Candidate | Snatch.auction"
  );
  assert.equal(buildHeroSubtitle(candidate, intentRecord, true), "Legal AI domain candidate in AI Software");
  assert.equal(
    buildCalibratedRecommendation(
      { ...candidate.scores, semanticFit: 60, categoryClarity: 57 },
      candidate,
      intentRecord
    ),
    "Support/workflow .com with moderate Legal AI clarity"
  );
  assert.equal(
    buildTradeoffLabel(
      { ...candidate.scores, semanticFit: 60, categoryClarity: 57 },
      candidate,
      intentRecord
    ),
    "Tradeoff: strong workflow signal, weaker literal legal signal"
  );
});

test("literal intent token keeps direct domain candidate title", () => {
  const intentRecord = mockLegalAiIntentRecord();
  const candidate = sampleCandidate({
    domain: "legalai.com",
    slug: "legalai-com",
    matchedTerms: ["legal", "ai"],
  });
  assert.equal(
    buildPageTitle(candidate, intentRecord),
    "legalai.com — Legal AI Domain Candidate | Snatch.auction"
  );
});

test("schema description uses AI receptionist casing and oxford comma", () => {
  const intentRecord = mockIntentRecord();
  const scores = { ...sampleCandidate().scores, semanticFit: 60, categoryClarity: 57 };
  const description = buildSchemaDescription(sampleCandidate(), intentRecord, scores);
  assert.match(description, /for AI receptionist and workflow software/);
  assert.match(description, /strong TLD trust, moderate semantic fit, and moderate category clarity/);
  assert.doesNotMatch(description, /Candidate match/i);
});

test("desk domains use workflow-specific calibrated copy", () => {
  const intentRecord = mockIntentRecord();
  const line = buildCalibratedRecommendation(
    { ...sampleCandidate().scores, semanticFit: 60, categoryClarity: 57 },
    sampleCandidate({ domain: "anudesk.com", matchedTerms: ["desk"] }),
    intentRecord
  );
  assert.equal(line, "Support/workflow .com with moderate AI receptionist clarity");
  const tradeoff = buildTradeoffLabel(
    { ...sampleCandidate().scores, semanticFit: 60, categoryClarity: 57 },
    sampleCandidate({ domain: "anudesk.com", matchedTerms: ["desk"] }),
    intentRecord
  );
  assert.equal(tradeoff, "Tradeoff: strong workflow signal, weaker literal receptionist signal");
});

test("summary strip exposes fit score context", () => {
  const html = renderSummaryStrip(sampleCandidate(), sampleCandidate().scores, true, false);
  assert.match(html, /Fit score/);
  assert.match(html, />76</);
  assert.match(html, /moderate category clarity|semantic fit/i);
});

test("score breakdown uses acquisition ease label", () => {
  const html = renderCompactScoreBreakdown(sampleCandidate().scores);
  assert.match(html, /Acquisition ease/);
  assert.doesNotMatch(html, /Acquisition friction/);
});

test("alternatives preserve own rank in display and URLs", () => {
  const current = sampleCandidate({ sessionRank: 2, candidateId: "candidate_b" });
  const intentRecord = mockIntentRecord();
  const pageContext = { intentId: intentRecord.intentId, rank: 2, fitScore: 68 };
  const altHtml = buildAlternativeComparisonRowHtml(
    current,
    { ...current.relatedCandidates[0], rank: 1, domain: "anudesk.com", url: "/domains/anudesk-com" },
    pageContext,
    intentRecord
  );
  assert.match(altHtml, /#1/);
  assert.match(altHtml, /anudesk\.com/);
  assert.match(altHtml, /rank=1/);
  assert.doesNotMatch(altHtml, /rank=2/);
});

test("noindex pages still emit Product and Offer JSON-LD graph", () => {
  const intentRecord = mockIntentRecord();
  const jsonLd = buildCandidateJsonLd(
    sampleCandidate(),
    toPublicMetadataUrl("/domains/anudesk-com"),
    toPublicMetadataUrl("/domain-assets/anudesk-com.png"),
    false,
    [],
    { indexable: false, metadataBaseUrl: "https://snatch.auction", intentRecord }
  );
  const serialized = JSON.stringify(jsonLd);
  assert.match(serialized, /"@type":"WebPage"/);
  assert.match(serialized, /"@type":"Product"/);
  assert.match(serialized, /"@type":"Offer"/);
  assert.match(serialized, /"@type":"Organization"/);
  assert.match(serialized, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(serialized, /"@type":"Auction"/);
  assert.doesNotMatch(serialized, /localhost/);
});

test("schema description uses calibrated language", () => {
  const intentRecord = mockIntentRecord();
  const description = buildSchemaDescription(sampleCandidate(), intentRecord, sampleCandidate().scores);
  assert.match(description, /AI receptionist and workflow software/i);
  assert.doesNotMatch(description, /AI Product/i);
});

test("rendered page includes tradeoff badge and desk-calibrated hero for anudesk", () => {
  const intentRecord = mockIntentRecord();
  const html = renderCandidatePageHtml(
    sampleCandidate({
      intentLabel: "AI Receptionist",
      matchedIntents: ["AI Receptionist", "ai software"],
      scores: {
        ...sampleCandidate().scores,
        semanticFit: 60,
        categoryClarity: 57,
      },
    }),
    { intentId: intentRecord.intentId, rank: 1, fitScore: 76 },
    { indexable: false, port: 4173, isProduction: false }
  );
  assert.match(html, /anudesk\.com — AI Receptionist Domain Candidate \| Snatch\.auction/);
  assert.match(html, /Support\/workflow \.com with moderate AI receptionist clarity/);
  assert.match(html, /Tradeoff: strong workflow signal, weaker literal receptionist signal/);
  assert.match(html, /AI Receptionist domain candidate in AI Software/);
  assert.match(html, /for AI receptionist and workflow software/);
  assert.doesNotMatch(html, /Candidate match/i);
});

test("formatWithArticle handles AI prefix", () => {
  assert.equal(formatWithArticle("AI software"), "an AI Software");
});

test("sitemap excludes session candidate slugs", () => {
  const paths = buildStableSitemapPaths();
  assert.equal(paths.some((entry) => entry.startsWith("/domains/anudesk-com")), false);
});
