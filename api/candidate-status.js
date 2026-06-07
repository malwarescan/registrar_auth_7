const { refreshCandidateStatus } = require("../server/domain-fetch/candidate-service");

async function handleCandidateStatus(_req, res, candidateId, { apiKey }) {
  try {
    if (!apiKey) throw new Error("Missing NAMESILO_API_KEY.");
    const candidate = await refreshCandidateStatus({ candidateId, apiKey });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(candidate));
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Status refresh failed." }));
  }
}

module.exports = {
  handleCandidateStatus,
};
