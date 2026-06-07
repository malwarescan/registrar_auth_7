const NAMESILO_AVAILABILITY_ENDPOINT = "https://www.namesilo.com/api/checkRegisterAvailability";

function markAvailabilityFromValue(value, available, map) {
  if (typeof value === "string") {
    value
      .split(/[,|\s]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.includes("."))
      .forEach((domain) => map.set(domain, available));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => markAvailabilityFromValue(entry, available, map));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      if (key.includes(".")) {
        const status = String(entry?.status || entry || "").toLowerCase();
        if (status.includes("available") || status === "1" || status === "true") map.set(key.toLowerCase(), true);
        if (status.includes("unavailable") || status === "0" || status === "false") map.set(key.toLowerCase(), false);
      } else {
        markAvailabilityFromValue(entry, available, map);
      }
    });
  }
}

function parseAvailability(payload, requestedDomains) {
  const map = new Map();
  requestedDomains.forEach((d) => map.set(d, false));
  markAvailabilityFromValue(payload?.reply?.available, true, map);
  markAvailabilityFromValue(payload?.reply?.unavailable, false, map);
  markAvailabilityFromValue(payload?.available, true, map);
  markAvailabilityFromValue(payload?.unavailable, false, map);
  if (String(payload?.reply?.code || "") !== "300") {
    throw new Error(payload?.reply?.detail || "Availability API returned non-success code.");
  }
  return map;
}

async function checkRegisterAvailability({ apiKey, domains, fetchFn = fetch }) {
  const batches = [];
  for (let i = 0; i < domains.length; i += 35) batches.push(domains.slice(i, i + 35));

  const available = new Set();
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
    for (const [domain, isAvailable] of parsed.entries()) {
      if (isAvailable) available.add(domain);
    }
  }
  return {
    checked,
    availableDomains: [...available],
  };
}

module.exports = {
  checkRegisterAvailability,
};
