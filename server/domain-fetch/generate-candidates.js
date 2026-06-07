const { splitDomain } = require("./classify-domain");

function normalizeRoot(root) {
  return String(root || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateRoot(root) {
  if (!root) return { ok: false, reason: "empty-root" };
  if (root.length > 63) return { ok: false, reason: "root-too-long" };
  if (!/^[a-z0-9-]+$/.test(root)) return { ok: false, reason: "invalid-characters" };
  if (root.startsWith("-") || root.endsWith("-")) return { ok: false, reason: "hyphen-edge" };
  if (root.includes("--")) return { ok: false, reason: "repeated-hyphen" };
  if (/(.)\1{2,}/.test(root)) return { ok: false, reason: "repeated-characters" };
  return { ok: true };
}

function laneRoots(intentModel, pass) {
  const req = intentModel.requiredConcepts;
  const adj = intentModel.adjacentConcepts;
  const location = intentModel.location ? String(intentModel.location).toLowerCase().split(/[,\s]+/)[0] : "";
  const isLocalHealthcare = intentModel.productCategory === "Local healthcare";
  const roots = [];
  const add = (root, lane) => {
    const normalized = normalizeRoot(root);
    if (!normalized) return;
    if (!roots.find((r) => r.root === normalized)) roots.push({ root: normalized, lane });
  };

  if (isLocalHealthcare) {
    const locationStem = location ? normalizeRoot(location) : "local";
    const serviceTerms = req.filter((term) => ["dentist", "dental", "clinic", "smile", "care"].includes(term));
    const patientTerms = adj.filter((term) => ["family", "care", "oral", "book", "local", "smile"].includes(term));

    if (pass === 1) {
      for (const term of serviceTerms.slice(0, 5)) {
        add(`${locationStem}${term}`, "clear-category-compounds");
        add(`${term}${locationStem}`, "clear-category-compounds");
      }
      add(`${locationStem}dental`, "clear-category-compounds");
      add(`${locationStem}dentist`, "clear-category-compounds");
      add("orangecountydentist", "local-brandables");
      add("orangecountydental", "local-brandables");
    } else if (pass === 2) {
      for (const term of serviceTerms.slice(0, 5)) {
        add(`${term}care`, "action-convenience");
        add(`book${term}`, "action-convenience");
      }
      for (const term of patientTerms.slice(0, 5)) {
        add(`${locationStem}${term}`, "local-brandables");
      }
      add("ocdentalcare", "local-brandables");
      add("ocdentist", "local-brandables");
    } else {
      add("smilehouse", "premium-concise");
      add("dentalworks", "premium-concise");
      add("oralstudio", "premium-concise");
      add("smileclinic", "invented-pronounceable");
      add("familydentalco", "invented-pronounceable");
    }
  } else if (pass === 1) {
    for (const a of req.slice(0, 8)) for (const b of req.slice(0, 8)) if (a !== b) add(`${a}${b}`, "clear-category-compounds");
    for (const a of req.slice(0, 8)) for (const b of adj.slice(0, 6)) add(`${a}${b}`, "clear-category-compounds");
    if (location) for (const a of req.slice(0, 6)) add(`${location}${a}`, "local-brandables");
  } else if (pass === 2) {
    for (const a of req.slice(0, 8)) add(`get${a}`, "action-convenience");
    for (const a of req.slice(0, 8)) add(`${a}now`, "action-convenience");
    for (const a of req.slice(0, 8)) add(`${a}fast`, "action-convenience");
    for (const a of req.slice(0, 8)) add(`${a}house`, "premium-concise");
    for (const a of req.slice(0, 8)) add(`${a}works`, "premium-concise");
  } else {
    const suffix = ["club", "co", "labs", "vault", "studio"];
    for (const a of [...req, ...adj].slice(0, 10)) for (const s of suffix) add(`${a}${s}`, "invented-pronounceable");
    if (location) {
      for (const a of req.slice(0, 6)) add(`${location}${a}delivery`, "exact-local-intent");
      for (const a of req.slice(0, 6)) add(`${a}${location}`, "exact-local-intent");
    }
  }
  return roots;
}

function generateCandidatesForPass({ intentModel, constraints = {}, pass, seenDomains }) {
  const preferredTlds = intentModel.preferredTlds;
  const roots = laneRoots(intentModel, pass);
  const candidates = [];
  const syntaxRejected = [];
  const dedupe = new Set();

  for (const laneRoot of roots) {
    for (const tld of preferredTlds) {
      const domain = `${laneRoot.root}${tld}`.toLowerCase();
      if (dedupe.has(domain) || seenDomains.has(domain)) continue;
      dedupe.add(domain);
      const { root } = splitDomain(domain);
      const valid = validateRoot(root);
      if (!valid.ok) {
        syntaxRejected.push({ domain, reason: valid.reason, generationLane: laneRoot.lane, generationPass: pass });
        continue;
      }
      if (constraints.avoidHyphens && domain.includes("-")) continue;
      candidates.push({
        domain,
        root,
        tld,
        generationLane: laneRoot.lane,
        generationPass: pass,
      });
      seenDomains.add(domain);
    }
  }

  return {
    generated: candidates.slice(0, 100),
    syntaxRejected,
  };
}

module.exports = {
  generateCandidatesForPass,
};
