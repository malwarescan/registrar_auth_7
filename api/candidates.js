const { listPublicCandidates } = require("../server/domain-fetch/candidate-service");

function handleCandidates(_req, res) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ candidates: listPublicCandidates() }));
}

module.exports = {
  handleCandidates,
};
