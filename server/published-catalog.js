const fs = require("fs");
const path = require("path");
const { getPublishedCatalogPath } = require("./candidate-store/published-catalog-generator");

const ROOT = path.resolve(__dirname, "..");
const PUBLISHED_INTENTS_PATH = path.join(ROOT, "data", "published-intents.json");

function normalizeSlug(slug) {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function readPublishedArray(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @returns {Array<{ slug: string, label?: string, href?: string }>} */
function listPublishedIntents() {
  // TODO(Phase C): hydrate from editorial workflow / promotion pipeline.
  return readPublishedArray(PUBLISHED_INTENTS_PATH);
}

/** @returns {Array<{ slug: string, domain?: string, candidateId?: string }>} */
function listPublishedCandidates() {
  return readPublishedArray(getPublishedCatalogPath());
}

function isPublishedCandidate(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return false;
  return listPublishedCandidates().some((entry) => {
    const entrySlug = normalizeSlug(entry.slug || String(entry.domain || "").replace(/\./g, "-"));
    return entrySlug === normalized;
  });
}

function getPublishedCandidateBySlug(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  const entry = listPublishedCandidates().find((item) => {
    const entrySlug = normalizeSlug(item.slug || String(item.domain || "").replace(/\./g, "-"));
    return entrySlug === normalized;
  });
  if (!entry) return null;
  // Published records may be lightweight stubs until Phase D persistence lands.
  return entry.candidateId || entry.domain ? entry : null;
}

module.exports = {
  listPublishedIntents,
  listPublishedCandidates,
  isPublishedCandidate,
  getPublishedCandidateBySlug,
  normalizeSlug,
};
