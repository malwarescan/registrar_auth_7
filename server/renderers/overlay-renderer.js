function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHumanPhrase(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((word) => (/^ai$/i.test(word) ? "AI" : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

function buildIntentOverlay(record, intentRecord, sessionCandidate, pageContext = {}) {
  if (!intentRecord) {
    return {
      bannerHtml: "",
      intentLabel: null,
      rank: null,
      fitScore: null,
      alternatives: [],
    };
  }

  const label = formatHumanPhrase(intentRecord.label);
  const rank = pageContext.rank ?? sessionCandidate?.sessionRank ?? null;
  const fitScore = Math.round(
    pageContext.fitScore ?? sessionCandidate?.scores?.overall ?? record?.baseScores?.overall ?? 0
  );
  const alternatives = (sessionCandidate?.relatedCandidates || sessionCandidate?.alternatives || []).slice(0, 5);

  const bannerHtml = `<div class="productIntentOverlay"><p>Recommended for ${escapeHtml(label)} · #${escapeHtml(String(rank ?? "—"))} · ${fitScore} fit</p></div>`;

  return {
    bannerHtml,
    intentLabel: label,
    rank,
    fitScore,
    alternatives,
    reasons: sessionCandidate?.whySurfaced ? [sessionCandidate.whySurfaced] : [],
  };
}

module.exports = {
  buildIntentOverlay,
  escapeHtml,
  formatHumanPhrase,
};
