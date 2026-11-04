const { COMMON_WORDS } = require("./common-words");

const MAX_WORDS = 3;

// Splits a name into the fewest common English words ("seedjuice" ->
// ["seed", "juice"]). Returns null when the whole name cannot be read as
// words from the vocabulary, or would need more than MAX_WORDS of them.
function segmentWords(root, vocabulary = COMMON_WORDS) {
  const text = String(root || "").toLowerCase();
  if (!text || !/^[a-z]+$/.test(text)) return null;
  const best = new Array(text.length + 1).fill(null);
  best[0] = [];
  for (let end = 1; end <= text.length; end += 1) {
    for (let start = Math.max(0, end - 14); start < end; start += 1) {
      const prev = best[start];
      if (!prev || prev.length >= MAX_WORDS) continue;
      const word = text.slice(start, end);
      if (!vocabulary.has(word)) continue;
      const candidate = [...prev, word];
      const current = best[end];
      // Fewer words wins; on a tie prefer the split whose shortest word is longer.
      if (
        !current ||
        candidate.length < current.length ||
        (candidate.length === current.length &&
          Math.min(...candidate.map((w) => w.length)) > Math.min(...current.map((w) => w.length)))
      ) {
        best[end] = candidate;
      }
    }
  }
  return best[text.length];
}

module.exports = { MAX_WORDS, segmentWords };
