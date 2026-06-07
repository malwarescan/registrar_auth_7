const test = require("node:test");
const assert = require("node:assert/strict");
const { orchestrateDomainFetch } = require("../api/domain-fetch");

function makeFetchMock({ auctions = [], availabilityResolver, availabilityError = false }) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes("listAuctions")) {
      return {
        ok: true,
        async json() {
          return {
            reply: {
              code: 300,
              body: auctions,
            },
          };
        },
      };
    }

    if (parsed.pathname.includes("checkRegisterAvailability")) {
      if (availabilityError) {
        return {
          ok: false,
          async json() {
            return { reply: { code: 280, detail: "availability temporary failure" } };
          },
        };
      }
      const domains = String(parsed.searchParams.get("domains") || "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const availableDomains = domains.filter((d) => availabilityResolver?.(d));
      const unavailableDomains = domains.filter((d) => !availabilityResolver?.(d));
      return {
        ok: true,
        async json() {
          return {
            reply: {
              code: 300,
              available: availableDomains.join(","),
              unavailable: unavailableDomains.join(","),
            },
          };
        },
      };
    }

    throw new Error(`Unexpected URL: ${url}`);
  };
}

test("waterfall continues to generation when no auction candidates", async () => {
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions: [],
      availabilityResolver: (domain) => domain.includes("pizza") || domain.includes("slice"),
    }),
  });

  assert.equal(result.sourceSummary.qualifiedAuctions, 0);
  assert.ok(result.sourceSummary.generatedNames > 0);
  assert.ok(result.sourceSummary.availabilityChecked > 0);
  assert.ok(result.decisionCandidates.length > 0);
});

test("available generated candidate is surfaced as namesilo-available register path", async () => {
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions: [],
      availabilityResolver: (domain) => domain.includes("brooklynslice") || domain.includes("pizzadelivery"),
    }),
  });

  const generated = result.decisionCandidates.find((c) => c.source === "namesilo-available");
  assert.ok(generated);
  assert.equal(generated.status, "available");
  assert.equal(generated.acquisitionPath?.type, "register");
  assert.ok(generated.sourceUrl?.includes("namesilo.com"));
});

test("unavailable generated domains are not surfaced as available", async () => {
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions: [],
      availabilityResolver: () => false,
    }),
  });

  assert.equal(result.registrationCandidates.filter((c) => c.availability === "available").length, 0);
});

test("availability API technical failure does not fabricate available candidates", async () => {
  const auctions = [
    { id: "a1", domain: "brooklynpizza.com", currentBid: "90", bidsQuantity: "1", auctionEndsOnUtc: new Date().toISOString() },
  ];
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions,
      availabilityError: true,
      availabilityResolver: () => false,
    }),
  });

  assert.ok(result.sourceSummary.errors.some((e) => e.source === "availability"));
  assert.ok(result.decisionCandidates.some((c) => c.source === "namesilo-auction"));
  assert.equal(result.decisionCandidates.some((c) => c.source === "namesilo-available"), false);
});

test("regeneration runs automatically when first pass yield is insufficient", async () => {
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions: [],
      availabilityResolver: (domain) => domain.includes("brooklynpizza"),
    }),
  });

  assert.ok(result.sourceSummary.generationPasses >= 2);
});

test("mixed candidate set includes qualified auctions and generated available domains", async () => {
  const auctions = [
    { id: "a1", domain: "brooklynpizza.com", currentBid: "120", bidsQuantity: "1", auctionEndsOnUtc: new Date().toISOString() },
    { id: "a2", domain: "slicedelivery.com", currentBid: "140", bidsQuantity: "2", auctionEndsOnUtc: new Date().toISOString() },
  ];
  const result = await orchestrateDomainFetch({
    brief: "pizza delivery in Brooklyn NY",
    constraints: { preferredTlds: [".com"], includeAuctions: true },
    apiKey: "test-key",
    fetchFn: makeFetchMock({
      auctions,
      availabilityResolver: (domain) =>
        domain.includes("pizza") || domain.includes("slice") || domain.includes("crust") || domain.includes("pie"),
    }),
  });

  assert.ok(result.decisionCandidates.some((c) => c.source === "namesilo-auction"));
  assert.ok(result.decisionCandidates.some((c) => c.source === "namesilo-available"));
});
