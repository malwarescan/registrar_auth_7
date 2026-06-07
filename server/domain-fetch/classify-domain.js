function splitDomain(domain) {
  const safe = String(domain || "").toLowerCase().trim();
  const idx = safe.lastIndexOf(".");
  if (idx === -1) return { root: safe, tld: "" };
  return { root: safe.slice(0, idx), tld: safe.slice(idx) };
}

function classifyDomainType(root) {
  if (!root) return "brandable";
  if (root.length <= 6) return "premium-short";
  if (root.includes("-")) return "compound";
  if (root.length > 18) return "exact-match";
  if (/\d/.test(root)) return "invented";
  return "brandable";
}

function detectNamingLane(root) {
  if (root.includes("-")) return "clear-compound";
  if (/^(get|go|try|use|open|order)/.test(root)) return "action-convenience";
  if (/(house|works|club|vault|studio|co)$/.test(root)) return "premium-concise";
  if (root.length > 18) return "exact-local-intent";
  return "local-brandable";
}

function toSlug(domain) {
  return String(domain || "")
    .toLowerCase()
    .replace(/\./g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

module.exports = {
  splitDomain,
  classifyDomainType,
  detectNamingLane,
  toSlug,
};
