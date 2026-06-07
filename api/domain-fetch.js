const { fetchDomainCandidates } = require("../server/domain-fetch/candidate-service");

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

async function orchestrateDomainFetch({ brief, constraints = {}, limit = 10, apiKey, fetchFn = fetch }) {
  return fetchDomainCandidates({
    brief,
    constraints,
    limit,
    apiKey,
    fetchFn,
  });
}

async function handleDomainFetch(req, res) {
  try {
    const apiKey = process.env.NAMESILO_API_KEY;
    if (!apiKey) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing NAMESILO_API_KEY environment variable." }));
      return;
    }

    const payload = await parseBody(req);
    const brief = String(payload?.brief || "").trim();
    if (!brief) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "brief is required." }));
      return;
    }

    const result = await orchestrateDomainFetch({
      brief,
      constraints: payload?.constraints || {},
      limit: payload?.limit || 10,
      apiKey,
    });

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: "Failed to fetch domain candidates.",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

module.exports = {
  handleDomainFetch,
  orchestrateDomainFetch,
};
