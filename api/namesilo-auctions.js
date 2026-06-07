const NAMESILO_ENDPOINT = "https://www.namesilo.com/public/api/listAuctions";
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map();

function clamp(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitDomain(domain) {
  const safe = String(domain || "").trim().toLowerCase();
  const idx = safe.lastIndexOf(".");
  if (idx === -1) return { root: safe, tld: "" };
  return { root: safe.slice(0, idx), tld: safe.slice(idx) };
}

function toIsoDate(value) {
  if (!value) return null;
  const maybe = new Date(value);
  if (Number.isNaN(maybe.getTime())) return null;
  return maybe.toISOString();
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

function toDomainType(root) {
  const len = root.length;
  if (len <= 6) return "premium-short";
  if (root.includes("-")) return "seo-long-tail";
  if (len <= 10) return "brandable";
  return "exact-match";
}

function toTldTrustScore(tld) {
  if (tld === ".com") return 96;
  if (tld === ".net") return 84;
  if (tld === ".org") return 82;
  if (tld === ".ai") return 78;
  if (tld === ".io") return 75;
  return 66;
}

function toBrandability(root) {
  const vowels = (root.match(/[aeiou]/g) || []).length;
  const hasHyphen = root.includes("-");
  const base = 95 - Math.min(40, root.length * 2) + Math.min(15, vowels * 2);
  return Math.max(35, Math.min(95, hasHyphen ? base - 15 : base));
}

function toRiskFlags(auction) {
  const flags = [];
  const tld = splitDomain(auction.domain || "").tld;
  const bidCount = Number.parseInt(auction.bidsQuantity || auction.hasBids || 0, 10) || 0;
  if (tld === ".ai") flags.push("renewal-cost");
  if ((auction.domain || "").includes("-")) flags.push("category-crowded");
  if (bidCount === 0) flags.push("low-liquidity");
  if (flags.length === 0) flags.push("category-crowded");
  return flags.slice(0, 2);
}

function toSignal(currentBid, bidCount, endsInHours) {
  if ((bidCount <= 1 && currentBid <= 120) || endsInHours <= 8) return "high";
  if (currentBid <= 500 || bidCount <= 3) return "medium";
  return "low";
}

function getMockFallbackOpportunities() {
  return [
    {
      id: "mock-auction-agentdesk-ai",
      domain: "agentdesk.ai",
      root: "agentdesk",
      tld: ".ai",
      source: "auction",
      salesMode: "auction",
      availability: "pending",
      currentBid: 120,
      bidCount: 2,
      auctionEndsIn: "9h 15m",
      auctionEndsOnUtc: new Date(Date.now() + 9 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
      auctionUrl: "https://www.namesilo.com/domain_auctions.php",
      fetchMatch: 88,
      snatchSignal: "high",
      confidence: 0.88,
      primaryCategory: "Domain auction",
      domainType: "brandable",
      fetchReason: "Fallback candidate generated because live NameSilo inventory was temporarily unavailable.",
      buyerFit: ["AI product teams", "SMB automation tools", "Customer support workflows"],
      catch: "Current bid is not final price. Final acquisition cost depends on bidding pressure near close.",
      nextAction: "Open auction intelligence, compare alternatives, and set a bid ceiling before close.",
      riskFlags: ["renewal-cost", "category-crowded"],
      scores: {
        semanticFit: 86,
        buyerFit: 84,
        brandability: 90,
        acquisitionFriction: 70,
        tldTrust: 78,
        seoPotential: 67,
        aiAppFit: 95,
        riskAdjusted: 80,
        overall: 88,
      },
      relatedDomains: ["callpilot.ai", "frontdeskpro.com"],
      surfacedAt: new Date().toISOString(),
      raw: { fallback: true },
    },
    {
      id: "mock-auction-securewatch-net",
      domain: "securewatch.net",
      root: "securewatch",
      tld: ".net",
      source: "auction",
      salesMode: "auction",
      availability: "pending",
      currentBid: 74,
      bidCount: 1,
      auctionEndsIn: "6h 22m",
      auctionEndsOnUtc: new Date(Date.now() + 6 * 60 * 60 * 1000 + 22 * 60 * 1000).toISOString(),
      auctionUrl: "https://www.namesilo.com/domain_auctions.php",
      fetchMatch: 83,
      snatchSignal: "high",
      confidence: 0.83,
      primaryCategory: "Domain auction",
      domainType: "brandable",
      fetchReason: "Fallback candidate generated because live NameSilo inventory was temporarily unavailable.",
      buyerFit: ["Security teams", "Threat monitoring tools", "Enterprise buyers"],
      catch: "Current bid is not final price. Final acquisition cost depends on bidding pressure near close.",
      nextAction: "Open auction intelligence, compare alternatives, and set a bid ceiling before close.",
      riskFlags: ["low-liquidity"],
      scores: {
        semanticFit: 82,
        buyerFit: 81,
        brandability: 79,
        acquisitionFriction: 72,
        tldTrust: 84,
        seoPotential: 75,
        aiAppFit: 60,
        riskAdjusted: 79,
        overall: 83,
      },
      relatedDomains: ["threatdesk.com", "breachradar.com"],
      surfacedAt: new Date().toISOString(),
      raw: { fallback: true },
    },
  ];
}

function normalizeAuction(auction) {
  const domain = String(auction.domain || "").toLowerCase();
  const { root, tld } = splitDomain(domain);
  const currentBid = toNumber(auction.currentBid);
  const bidCount = clamp(auction.bidsQuantity, 0, 10000, 0);
  const endsOnUtc = toIsoDate(auction.auctionEndsOnUtc || auction.auctionEndsOn);
  const endsIn = toEndsIn(endsOnUtc);
  const endsAt = endsOnUtc ? new Date(endsOnUtc).getTime() : Date.now() + 2 * 60 * 60 * 1000;
  const endsInHours = Math.max(0, Math.round((endsAt - Date.now()) / (1000 * 60 * 60)));
  const domainType = toDomainType(root);
  const tldTrust = toTldTrustScore(tld);
  const brandability = toBrandability(root);
  const semanticFit = Math.max(40, Math.min(95, 88 - Math.min(root.length, 18)));
  const buyerFit = Math.max(45, Math.min(95, 80 - Math.min(35, bidCount * 4) + (domainType === "brandable" ? 8 : 0)));
  const acquisitionFriction = Math.max(35, Math.min(95, 90 - Math.min(60, (currentBid || 0) / 8) - Math.min(20, bidCount * 3)));
  const seoPotential = Math.max(40, Math.min(92, 68 + (domain.includes("-") ? 8 : 0) + (domainType === "exact-match" ? 10 : 0)));
  const aiAppFit = Math.max(35, Math.min(95, domain.includes("ai") ? 90 : 62));
  const riskAdjusted = Math.max(35, Math.min(95, Math.round((semanticFit + buyerFit + tldTrust + acquisitionFriction) / 4)));
  const overall = Math.max(40, Math.min(96, Math.round((semanticFit + buyerFit + brandability + tldTrust + riskAdjusted) / 5)));
  const signal = toSignal(currentBid || 0, bidCount, endsInHours);
  const confidence = Math.max(0.55, Math.min(0.97, overall / 100));
  const riskFlags = toRiskFlags(auction);

  return {
    id: `ns-${auction.id || auction.domainId || domain}`,
    domain,
    root,
    tld,
    source: "auction",
    salesMode: "auction",
    availability: "pending",
    currentBid,
    bidCount,
    auctionEndsIn: endsIn,
    auctionEndsOnUtc: endsOnUtc || undefined,
    auctionUrl: auction.url || undefined,
    fetchMatch: overall,
    snatchSignal: signal,
    confidence,
    primaryCategory: "Domain auction",
    domainType,
    fetchReason: "Surfaced from active NameSilo expired-domain auctions with current bidding and timing signals.",
    buyerFit: ["Category-aligned brands", "Operator-led products", "Audience-specific launches"],
    catch: "Current bid is not final price. Final acquisition cost depends on bidding pressure near close.",
    nextAction: "Open auction intelligence, compare alternatives, and set a bid ceiling before the close window.",
    riskFlags,
    scores: {
      semanticFit,
      buyerFit,
      brandability,
      acquisitionFriction,
      tldTrust,
      seoPotential,
      aiAppFit,
      riskAdjusted,
      overall,
    },
    relatedDomains: [],
    surfacedAt: new Date().toISOString(),
    raw: auction,
  };
}

function extractRecords(payload) {
  const body = payload?.reply?.body;
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    if (Array.isArray(body.record)) return body.record;
    if (Array.isArray(body.auctions)) return body.auctions;
    if (Array.isArray(body.auction)) return body.auction;
  }

  const bodyRecords = payload?.reply?.body?.record;
  if (Array.isArray(bodyRecords)) return bodyRecords;
  if (bodyRecords && typeof bodyRecords === "object") return Object.values(bodyRecords);

  const bodyList = payload?.reply?.body?.auctions || payload?.reply?.body?.auction;
  if (Array.isArray(bodyList)) return bodyList;
  if (bodyList && typeof bodyList === "object") return Object.values(bodyList);

  const primary = payload?.reply?.resource?.record;
  if (Array.isArray(primary)) return primary;
  if (primary && typeof primary === "object") return Object.values(primary);

  const alt1 = payload?.reply?.resource;
  if (Array.isArray(alt1)) return alt1;
  if (alt1 && typeof alt1 === "object") {
    if (Array.isArray(alt1.record)) return alt1.record;
    return Object.values(alt1).filter((value) => value && typeof value === "object" && value.domain);
  }

  const alt2 = payload?.auctions;
  if (Array.isArray(alt2)) return alt2;
  return [];
}

function getNameSiloReplyError(payload) {
  const code = payload?.reply?.code;
  const detail = payload?.reply?.detail;
  if (code == null) return null;
  const codeStr = String(code);
  // NameSilo success code is 300 for most public API operations.
  if (codeStr === "300") return null;
  return {
    code: codeStr,
    detail: detail || "NameSilo returned a non-success reply code.",
  };
}

async function handleNameSiloAuctions(req, res, requestUrl) {
  const useMockFallback = false;
  const apiKey = process.env.NAMESILO_API_KEY;
  if (!apiKey) {
    if (useMockFallback) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          opportunities: getMockFallbackOpportunities(),
          meta: {
            fallback: true,
            reason: "Missing NAMESILO_API_KEY environment variable.",
          },
        })
      );
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing NAMESILO_API_KEY environment variable." }));
    return;
  }

  try {
    const page = clamp(requestUrl.searchParams.get("page"), 1, 1000, 1);
    const pageSize = clamp(requestUrl.searchParams.get("pageSize"), 1, 200, 100);

    const params = new URLSearchParams({
      version: "1",
      type: "json",
      key: apiKey,
      statusId: requestUrl.searchParams.get("statusId") || "2",
      typeId: requestUrl.searchParams.get("typeId") || "3",
      page: String(page),
      pageSize: String(pageSize),
    });

    const passthrough = [
      "domainId",
      "domainName",
      "buyNow",
      "minCurrentBid",
      "maxCurrentBid",
      "orderBy",
      "orderType",
      "watchlist",
    ];
    passthrough.forEach((key) => {
      const value = requestUrl.searchParams.get(key);
      if (value !== null && value !== "") params.set(key, value);
    });

    const cacheKey = JSON.stringify({
      statusId: params.get("statusId"),
      typeId: params.get("typeId"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
      domainId: params.get("domainId"),
      domainName: params.get("domainName"),
      buyNow: params.get("buyNow"),
      minCurrentBid: params.get("minCurrentBid"),
      maxCurrentBid: params.get("maxCurrentBid"),
      orderBy: params.get("orderBy"),
      orderType: params.get("orderType"),
      watchlist: params.get("watchlist"),
    });

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...cached.payload, meta: { ...cached.payload.meta, cached: true } }));
      return;
    }

    const upstream = await fetch(`${NAMESILO_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const payload = await upstream.json();
    if (!upstream.ok) {
      if (useMockFallback) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            opportunities: getMockFallbackOpportunities(),
            meta: {
              fallback: true,
              reason: "NameSilo API request failed.",
              statusCode: upstream.status,
            },
          })
        );
        return;
      }
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "NameSilo API request failed.", details: payload }));
      return;
    }

    const replyError = getNameSiloReplyError(payload);
    if (replyError) {
      if (useMockFallback) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            opportunities: getMockFallbackOpportunities(),
            meta: {
              fallback: true,
              reason: `NameSilo reply error ${replyError.code}`,
              detail: replyError.detail,
            },
          })
        );
        return;
      }
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: `NameSilo reply error ${replyError.code}.`,
          message: replyError.detail,
        })
      );
      return;
    }

    const records = extractRecords(payload);
    const opportunities = records.map(normalizeAuction);
    const responsePayload = {
      opportunities,
      meta: {
        page,
        pageSize,
        returned: opportunities.length,
        statusId: params.get("statusId"),
        typeId: params.get("typeId"),
        cached: false,
        fallback: false,
      },
    };

    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload: responsePayload,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responsePayload));
  } catch (error) {
    if (useMockFallback) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          opportunities: getMockFallbackOpportunities(),
          meta: {
            fallback: true,
            reason: "Failed to retrieve NameSilo auctions.",
          },
        })
      );
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Failed to retrieve NameSilo auctions.",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

module.exports = {
  handleNameSiloAuctions,
};
