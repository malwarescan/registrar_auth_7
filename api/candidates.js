const { listPublishedCandidates } = require("../server/published-catalog");

function handleCandidates(_req, res) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ candidates: listPublishedCandidates() }));
}

module.exports = {
  handleCandidates,
};
