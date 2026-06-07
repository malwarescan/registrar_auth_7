(function webMcpBootstrap() {
  function getModelContext() {
    if (document.modelContext && typeof document.modelContext.registerTool === "function") {
      return document.modelContext;
    }
    return null;
  }

  const modelContext = getModelContext();
  if (!modelContext) return;

  let candidateToolController = null;

  function resetCandidateTools() {
    if (candidateToolController) candidateToolController.abort();
    candidateToolController = new AbortController();
    return candidateToolController.signal;
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Tool request failed");
    return data;
  }

  function currentWorkspace() {
    return window.__intentFetchWorkspace || null;
  }

  function registerFetchTool() {
    modelContext.registerTool(
      {
        name: "fetch_domain_candidates",
        title: "Fetch domain candidates",
        description:
          "Fetch ranked domain acquisition candidates from a business brief using live NameSilo auctions and registration availability.",
        inputSchema: {
          type: "object",
          properties: {
            brief: { type: "string", description: "Business and naming brief." },
            maxBudget: { type: "number", minimum: 0 },
            includeAuctions: { type: "boolean" },
          },
          required: ["brief"],
        },
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async ({ brief, maxBudget, includeAuctions = true }) => {
          return postJson("/api/domain-fetch", {
            brief,
            constraints: {
              maxBudget,
              includeAuctions,
            },
            limit: 10,
          });
        },
      },
      { signal: resetCandidateTools() }
    );
  }

  function registerWorkspaceTools(workspace) {
    const signal = resetCandidateTools();
    const candidates = Array.isArray(workspace?.candidates) ? workspace.candidates : [];
    const auctionCandidates = candidates.filter((c) => c.source === "namesilo-auction");
    const requestId = workspace?.requestId;

    modelContext.registerTool(
      {
        name: "explain_domain_candidate",
        title: "Explain domain candidate",
        description: "Returns fit reasoning, buyer fit, scores, and live acquisition status for one candidate.",
        inputSchema: {
          type: "object",
          properties: { candidateId: { type: "string" } },
          required: ["candidateId"],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async ({ candidateId }) => {
          const response = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}`, { headers: { Accept: "application/json" } });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || "Candidate lookup failed");
          return data;
        },
      },
      { signal }
    );

    modelContext.registerTool(
      {
        name: "compare_domain_candidates",
        title: "Compare domain candidates",
        description: "Compares two to five domain candidates by fit, quality, risk, and friction.",
        inputSchema: {
          type: "object",
          properties: {
            candidateIds: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
            },
            priority: {
              type: "string",
              enum: [
                "best-overall",
                "strongest-brand",
                "lowest-risk",
                "lowest-acquisition-friction",
                "strongest-category-clarity",
              ],
            },
          },
          required: ["candidateIds"],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async ({ candidateIds, priority = "best-overall" }) => {
          return postJson("/api/compare-candidates", { candidateIds, priority });
        },
      },
      { signal }
    );

    modelContext.registerTool(
      {
        name: "refine_domain_candidates",
        title: "Refine domain candidates",
        description: "Reruns and reranks candidate workspace using updated constraints.",
        inputSchema: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            onlyTlds: { type: "array", items: { type: "string" } },
            maxBudget: { type: "number", minimum: 0 },
            shorterNames: { type: "boolean" },
            excludeHyphens: { type: "boolean" },
            includeAuctions: { type: "boolean" },
            lessAiSounding: { type: "boolean" },
            morePremium: { type: "boolean" },
            moreExactMatch: { type: "boolean" },
          },
          required: ["requestId"],
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (payload) => {
          return postJson("/api/refine-candidates", payload);
        },
      },
      { signal }
    );

    modelContext.registerTool(
      {
        name: "shortlist_domain_candidate",
        title: "Shortlist domain candidate",
        description: "Adds one candidate to a reversible shortlist.",
        inputSchema: {
          type: "object",
          properties: { candidateId: { type: "string" } },
          required: ["candidateId"],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async ({ candidateId }) => postJson("/api/shortlist-candidate", { candidateId }),
      },
      { signal }
    );

    if (auctionCandidates.length > 0) {
      modelContext.registerTool(
        {
          name: "watch_domain_auction",
          title: "Watch domain auction",
          description: "Adds an active auction candidate to watchlist and returns refreshed auction status.",
          inputSchema: {
            type: "object",
            properties: { candidateId: { type: "string" } },
            required: ["candidateId"],
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async ({ candidateId }) => postJson("/api/watch-auction", { candidateId }),
        },
        { signal }
      );
    }

    modelContext.registerTool(
      {
        name: "open_domain_acquisition_path",
        title: "Open domain acquisition path",
        description: "Refreshes and opens the appropriate NameSilo handoff path for user confirmation.",
        inputSchema: {
          type: "object",
          properties: { candidateId: { type: "string" } },
          required: ["candidateId"],
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async ({ candidateId }) => postJson("/api/acquisition-path", { candidateId }),
      },
      { signal }
    );

    if (requestId) {
      window.__intentFetchRequestId = requestId;
    }
  }

  registerFetchTool();
  document.addEventListener("intent-fetch:workspace-updated", () => {
    registerWorkspaceTools(currentWorkspace());
  });
})();
