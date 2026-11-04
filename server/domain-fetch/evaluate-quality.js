function clampScore(value, min = 20, max = 97) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Letter pairs that almost never occur in pronounceable English or
// romanised brand names; random strings hit them often.
const RARE_BIGRAMS = new Set([
  "xc", "kx", "wc", "jt", "yf", "zx", "qk", "jr", "xk", "fq", "wd", "jh", "pz", "vq", "qy", "xj", "zj", "jz", "qz", "bz", "cj", "fz", "gx", "hx", "jx", "kz", "mx", "qx", "vx", "wx", "xz", "zq", "jq", "vj", "wq", "yq", "kq", "zv", "vw", "wv", "xq",
]);

function countLetterDigitTransitions(compact) {
  let transitions = 0;
  for (let i = 1; i < compact.length; i += 1) {
    if (/\d/.test(compact[i]) !== /\d/.test(compact[i - 1])) transitions += 1;
  }
  return transitions;
}

// Returns a 0+ score; 2 or more means the label reads as a random string
// (for example 09kybuo0c or 23aqyfe2) rather than a word, brand or number+word.
function randomStringScore(compact) {
  if (!compact) return 0;
  const letters = compact.replace(/\d/g, "");
  const hasDigits = letters.length !== compact.length;
  let score = 0;

  if (hasDigits && letters.length) {
    const transitions = countLetterDigitTransitions(compact);
    if (transitions >= 3) score += 2;
    else if (/^\d+[a-z]+\d+$/.test(compact)) score += 2;
    else if (transitions === 2) score += 1;
  }

  if (/q(?!u|$)/.test(letters)) score += 1;

  // Bigrams and consonant runs are checked per letter segment, so "abc88slot"
  // is read as "abc" + "slot", not "abcslot".
  const segments = compact.split(/\d+/).filter(Boolean);
  let rare = 0;
  for (const segment of segments) {
    for (let i = 1; i < segment.length; i += 1) {
      if (RARE_BIGRAMS.has(segment.slice(i - 1, i + 1))) rare += 1;
    }
  }
  score += Math.min(rare, 2);

  if (letters.length >= 4) {
    const vowelish = (letters.match(/[aeiouy]/g) || []).length / letters.length;
    if (vowelish < 0.2) score += 1;
  }
  if (segments.some((segment) => /[bcdfghjklmnpqrstvwxz]{5,}/.test(segment))) score += 1;

  return score;
}

function evaluateQuality(root) {
  const safe = String(root || "").toLowerCase();
  const compact = safe.replace(/[^a-z0-9]/g, "");
  // Vowel ratio is measured on letters only: digits are neither vowels nor
  // consonants, and counting them hid low-vowel random strings.
  const letters = compact.replace(/\d/g, "");
  const hasDigits = /\d/.test(compact);
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;
  const repeatedChars = /(.)\1{2,}/.test(compact);
  const longConsonantRuns = /[bcdfghjklmnpqrstvwxyz]{6,}/.test(compact);
  const randomString = randomStringScore(compact) >= 2;

  const qualityFlags = [];
  if (compact.length > 22) qualityFlags.push("excessive-length");
  if (repeatedChars) qualityFlags.push("repeated-characters");
  if (longConsonantRuns || vowelRatio < 0.2 || vowelRatio > 0.8 || randomString) qualityFlags.push("hard-to-pronounce");
  if (hasDigits || safe.includes("--")) qualityFlags.push("confusing-spelling");
  if (compact.length > 0 && new Set(compact).size / compact.length < 0.35) qualityFlags.push("gibberish");
  if (randomString) qualityFlags.push("random-string");

  let pronounceability = 78 - (qualityFlags.includes("hard-to-pronounce") ? 28 : 0) - (repeatedChars ? 16 : 0);
  // Digits mixed into a name force the listener to ask how it is spelled.
  if (hasDigits) pronounceability = Math.min(pronounceability, letters.length ? 55 : 45);
  if (!vowels) pronounceability = Math.min(pronounceability, 30);
  if (randomString) pronounceability = Math.min(pronounceability, 25);
  pronounceability = clampScore(pronounceability);

  let brandability =
    75 -
    Math.max(0, compact.length - 12) * 2 -
    (safe.includes("-") ? 8 : 0) -
    (qualityFlags.includes("gibberish") ? 20 : 0);
  if (randomString) brandability = Math.min(brandability, 30);
  brandability = clampScore(brandability);

  return {
    qualityFlags,
    pronounceability,
    brandability,
  };
}

module.exports = {
  clampScore,
  randomStringScore,
  evaluateQuality,
};
