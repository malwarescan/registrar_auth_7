(function domainCandidateWebMcp() {
  const modelContext = document.modelContext;
  if (!modelContext?.registerTool) return;

  const candidateNode = document.getElementById("decision-candidate-data");
  if (!candidateNode) return;

  let candidate;
  try {
    candidate = JSON.parse(candidateNode.textContent || "{}");
  } catch {
    return;
  }
  const candidateId = candidate.candidateId;
  if (!candidateId) return;

  async function getJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  modelContext.registerTool({
    name: "get_domain_candidate_intelligence",
    title: "Get domain candidate intelligence",
    description:
      "Returns fit reasoning, buyer fit, tradeoffs, scores, status, acquisition path, and alternatives for this displayed candidate.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () => getJson(`/api/candidates/${encodeURIComponent(candidateId)}`),
  });

  modelContext.registerTool({
    name: "shortlist_displayed_domain_candidate",
    title: "Shortlist displayed domain candidate",
    description: "Adds the displayed domain candidate to a reversible shortlist.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      const result = await getJson("/api/shortlist-candidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      document.getElementById("shortlist-candidate")?.setAttribute("data-shortlisted", "true");
      return result;
    },
  });

  modelContext.registerTool({
    name: "refresh_displayed_domain_status",
    title: "Refresh displayed domain status",
    description: "Refreshes current NameSilo status and pricing signals for the displayed candidate.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: async () =>
      getJson(`/api/candidates/${encodeURIComponent(candidateId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
  });

  modelContext.registerTool({
    name: "prepare_displayed_domain_acquisition",
    title: "Prepare displayed domain acquisition",
    description:
      "Revalidates the displayed domain status and prepares NameSilo handoff. This does not purchase or register.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async () => {
      const result = await getJson("/api/acquisition-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      return { ...result, requiresUserConfirmation: true };
    },
  });
})();
