const NAMESILO_AVAILABILITY_ENDPOINT = "https://www.namesilo.com/api/checkRegisterAvailability";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function readPriceDetails(entry) {
  if (!entry || typeof entry !== "object") return {};
  return {
    registrationPrice:
      toNumber(entry.registration_price) ??
      toNumber(entry.register_price) ??
      toNumber(entry.registrationPrice) ??
      toNumber(entry.price),
    renewalPrice:
      toNumber(entry.renewal_price) ??
      toNumber(entry.renew_price) ??
      toNumber(entry.renewalPrice) ??
      toNumber(entry.renew),
    priceCurrency: typeof entry.currency === "string" && entry.currency.trim() ? entry.currency.trim().toUpperCase() : "USD",
  };
}

function readAvailabilityRecord(entry) {
  if (!entry || typeof entry !== "object") return null;

  if (typeof entry.domain === "string" && entry.domain.includes(".")) {
    const prices = readPriceDetails(entry);
    return {
      domain: entry.domain.toLowerCase(),
      registrationPrice: prices.registrationPrice,
      renewalPrice: prices.renewalPrice,
      priceCurrency: prices.priceCurrency || "USD",
    };
  }

  if (entry.domain && typeof entry.domain === "object") {
    return readAvailabilityRecord(entry.domain);
  }

  return null;
}

function markDomainAvailability(domain, available, map, detailMap, pricing = {}) {
  const normalized = String(domain || "").toLowerCase();
  if (!normalized.includes(".")) return;
  map.set(normalized, available);
  if (available) {
    detailMap.set(normalized, {
      registrationPrice: pricing.registrationPrice,
      renewalPrice: pricing.renewalPrice,
      priceCurrency: pricing.priceCurrency || "USD",
    });
  }
}

function markAvailabilityFromValue(value, available, map, detailMap) {
  if (typeof value === "string") {
    value
      .split(/[,|\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.includes("."))
      .forEach((domain) => {
        markDomainAvailability(domain, available, map, detailMap);
      });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const record = readAvailabilityRecord(entry);
      if (record) {
        markDomainAvailability(record.domain, available, map, detailMap, record);
        return;
      }
      markAvailabilityFromValue(entry, available, map, detailMap);
    });
    return;
  }
  if (value && typeof value === "object") {
    const record = readAvailabilityRecord(value);
    if (record) {
      markDomainAvailability(record.domain, available, map, detailMap, record);
      return;
    }
    Object.entries(value).forEach(([key, entry]) => {
      if (key.includes(".")) {
        const status = String(entry?.status || entry || "").toLowerCase();
        const domain = key.toLowerCase();
        if (status.includes("available") || status === "1" || status === "true") {
          const prices = readPriceDetails(entry);
          markDomainAvailability(domain, true, map, detailMap, prices);
        }
        if (status.includes("unavailable") || status === "0" || status === "false") map.set(domain, false);
      } else {
        markAvailabilityFromValue(entry, available, map, detailMap);
      }
    });
  }
}

function parseAvailability(payload, requestedDomains) {
  const map = new Map();
  const detailMap = new Map();
  requestedDomains.forEach((d) => map.set(d, false));
  markAvailabilityFromValue(payload?.reply?.available, true, map, detailMap);
  markAvailabilityFromValue(payload?.reply?.unavailable, false, map, detailMap);
  markAvailabilityFromValue(payload?.available, true, map, detailMap);
  markAvailabilityFromValue(payload?.unavailable, false, map, detailMap);
  if (String(payload?.reply?.code || "") !== "300") {
    throw new Error(payload?.reply?.detail || "Availability API returned non-success code.");
  }
  return { map, detailMap };
}

async function checkRegisterAvailability({ apiKey, domains, fetchFn = fetch }) {
  const batches = [];
  for (let i = 0; i < domains.length; i += 35) batches.push(domains.slice(i, i + 35));

  const available = new Set();
  const availabilityByDomain = new Map();
  let checked = 0;

  for (const batch of batches) {
    const params = new URLSearchParams({
      version: "1",
      type: "json",
      key: apiKey,
      domains: batch.join(","),
    });
    const response = await fetchFn(`${NAMESILO_AVAILABILITY_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error("Availability request failed.");
    const parsed = parseAvailability(payload, batch);
    checked += batch.length;
    for (const [domain, isAvailable] of parsed.map.entries()) {
      if (isAvailable) available.add(domain);
      availabilityByDomain.set(domain, {
        available: isAvailable,
        registrationPrice: parsed.detailMap.get(domain)?.registrationPrice,
        renewalPrice: parsed.detailMap.get(domain)?.renewalPrice,
        priceCurrency: parsed.detailMap.get(domain)?.priceCurrency || "USD",
      });
    }
  }
  return {
    checked,
    availableDomains: [...available],
    availabilityByDomain,
  };
}

module.exports = {
  checkRegisterAvailability,
};
