(function candidatePageBootstrap() {
  const candidateNode = document.getElementById("decision-candidate-data");
  if (!candidateNode) return;

  let candidate;
  try {
    candidate = JSON.parse(candidateNode.textContent || "{}");
  } catch {
    return;
  }

  const status = document.querySelector(".candidate-status .badge");
  const openPath = document.getElementById("open-acquisition-path");
  const refreshBtn = document.getElementById("refresh-candidate");
  const shortlistBtn = document.getElementById("shortlist-candidate");
  const compareBtn = document.getElementById("compare-candidate");

  function isExpired() {
    const expiresAt = new Date(candidate.statusExpiresAt || "").getTime();
    if (!expiresAt || Number.isNaN(expiresAt)) return true;
    return Date.now() > expiresAt;
  }

  function applyStaleUi() {
    if (!isExpired()) return;
    if (status) status.textContent = "Refresh required";
    if (openPath) {
      openPath.setAttribute("aria-disabled", "true");
      openPath.setAttribute("href", "#");
    }
  }

  async function refreshStatus() {
    const response = await fetch(`/api/candidates/${encodeURIComponent(candidate.candidateId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Status refresh failed.");
    candidate = payload;
    if (status) {
      status.textContent = payload.status === "available" ? "Available" : payload.status === "auction-active" ? "Auction active" : "Refresh required";
    }
    if (openPath) {
      if (payload.acquisitionPath?.actionUrl && (payload.status === "available" || payload.status === "auction-active")) {
        openPath.removeAttribute("aria-disabled");
        openPath.setAttribute("href", payload.acquisitionPath.actionUrl);
      } else {
        openPath.setAttribute("aria-disabled", "true");
        openPath.setAttribute("href", "#");
      }
    }
    candidateNode.textContent = JSON.stringify(payload);
    return payload;
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      try {
        await refreshStatus();
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (shortlistBtn) {
    shortlistBtn.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/shortlist-candidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: candidate.candidateId }),
        });
        if (!response.ok) return;
        shortlistBtn.setAttribute("data-shortlisted", "true");
        shortlistBtn.textContent = "Shortlisted";
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (compareBtn) {
    compareBtn.addEventListener("click", async () => {
      const response = await fetch("/api/compare-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateIds: [candidate.candidateId], priority: "best-overall" }),
      });
      if (!response.ok) return;
      compareBtn.textContent = "Compared";
    });
  }

  if (openPath) {
    openPath.addEventListener("click", async (event) => {
      try {
        const handoff = await (await fetch("/api/acquisition-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: candidate.candidateId }),
        })).json();
        if (!handoff?.actionUrl) {
          event.preventDefault();
          return;
        }
        openPath.setAttribute("href", handoff.actionUrl);
      } catch {
        event.preventDefault();
      }
    });
  }

  applyStaleUi();
})();
