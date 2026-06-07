const { compareCandidates } = require("../server/domain-fetch/candidate-service");

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body too large."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON payload."));
      }
    });
    req.on("error", reject);
  });
}

async function handleCompareCandidates(req, res) {
  try {
    const payload = await parseBody(req);
    const result = compareCandidates({
      candidateIds: Array.isArray(payload?.candidateIds) ? payload.candidateIds : [],
      priority: payload?.priority || "best-overall",
    });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Compare failed." }));
  }
}

module.exports = {
  handleCompareCandidates,
};
