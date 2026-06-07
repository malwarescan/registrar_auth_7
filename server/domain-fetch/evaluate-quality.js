function clampScore(value, min = 20, max = 97) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function evaluateQuality(root) {
  const safe = String(root || "").toLowerCase();
  const compact = safe.replace(/[^a-z0-9]/g, "");
  const vowels = (compact.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowels / Math.max(compact.length, 1);
  const repeatedChars = /(.)\1{2,}/.test(compact);
  const longConsonantRuns = /[bcdfghjklmnpqrstvwxyz]{6,}/.test(compact);

  const qualityFlags = [];
  if (compact.length > 22) qualityFlags.push("excessive-length");
  if (repeatedChars) qualityFlags.push("repeated-characters");
  if (longConsonantRuns || vowelRatio < 0.2 || vowelRatio > 0.8) qualityFlags.push("hard-to-pronounce");
  if (/\d/.test(compact) || safe.includes("--")) qualityFlags.push("confusing-spelling");
  if (compact.length > 0 && new Set(compact).size / compact.length < 0.35) qualityFlags.push("gibberish");

  const pronounceability = clampScore(78 - (qualityFlags.includes("hard-to-pronounce") ? 28 : 0) - (repeatedChars ? 16 : 0));
  const brandability = clampScore(
    75 -
      Math.max(0, compact.length - 12) * 2 -
      (safe.includes("-") ? 8 : 0) -
      (qualityFlags.includes("gibberish") ? 20 : 0)
  );

  return {
    qualityFlags,
    pronounceability,
    brandability,
  };
}

module.exports = {
  clampScore,
  evaluateQuality,
};
