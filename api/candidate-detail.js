const { getCandidate, isStatusStale, refreshCandidateStatus } = require("../server/domain-fetch/candidate-service");

async function handleCandidateDetail(_req, res, candidateId, { apiKey }) {
  try {
    let candidate = getCandidate(candidateId);
    if (!candidate) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Candidate not found." }));
      return;
    }
    if (apiKey && isStatusStale(candidate)) {
      candidate = await refreshCandidateStatus({ candidateId, apiKey });
    }
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(candidate));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Candidate detail failed." }));
  }
}

module.exports = {
  handleCandidateDetail,
};
