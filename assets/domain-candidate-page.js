(function candidatePageBootstrap() {
  const candidateNode = document.getElementById("decision-candidate-data");
  if (!candidateNode) return;

  let candidate;
  try {
    candidate = JSON.parse(candidateNode.textContent || "{}");
  } catch {
    return;
  }

  const status = document.getElementById("candidate-status-badge") || document.querySelector(".candidate-status .badge");
  const openPath = document.getElementById("open-acquisition-path");
  const mobileBar = document.querySelector(".candidate-mobile-bar");
  const mobileBarCta = document.querySelector(".candidate-mobile-bar-cta");
  const refreshBtn = document.getElementById("refresh-candidate");
  const shortlistBtn = document.getElementById("shortlist-candidate");
  const compareBtn = document.getElementById("compare-candidate");
  const pageParams = new URLSearchParams(window.location.search);

  function isExpired() {
    const expiresAt = new Date(candidate.statusExpiresAt || "").getTime();
    if (!expiresAt || Number.isNaN(expiresAt)) return true;
    return Date.now() > expiresAt;
  }

  function applyStaleUi() {
    if (!isExpired()) return;
    if (status) status.textContent = "Availability needs refresh";
    if (openPath) {
      openPath.setAttribute("aria-disabled", "true");
      openPath.setAttribute("href", "#");
    }
    if (mobileBarCta) {
      mobileBarCta.setAttribute("aria-disabled", "true");
      mobileBarCta.setAttribute("href", "#");
    }
  }

  function buildAcquireHref() {
    const params = new URLSearchParams();
    params.set("domain", candidate.domain);
    params.set("candidate_id", candidate.candidateId);
    params.set("source", "domain-detail");
    const intentId = pageParams.get("intent_id") || candidate.sessionIntent?.intentId;
    if (intentId) params.set("intent_id", intentId);
    const rank = pageParams.get("rank") || candidate.sessionIntent?.rank;
    const fit = pageParams.get("fit") || candidate.sessionIntent?.fitScore || candidate.scores?.overall;
    if (rank != null && rank !== "") params.set("rank", String(rank));
    if (fit != null && fit !== "") params.set("fit", String(fit));
    return `/out/acquire?${params.toString()}`;
  }

  function syncAcquireHref() {
    const href = buildAcquireHref();
    if (openPath && openPath.getAttribute("aria-disabled") !== "true") {
      openPath.setAttribute("href", href);
    }
    if (mobileBarCta && mobileBarCta.getAttribute("aria-disabled") !== "true") {
      mobileBarCta.setAttribute("href", href);
    }
  }

  function setAcquireDisabled(disabled) {
    [openPath, mobileBarCta].forEach((node) => {
      if (!node) return;
      if (disabled) {
        node.setAttribute("aria-disabled", "true");
        node.setAttribute("href", "#");
      } else {
        node.removeAttribute("aria-disabled");
      }
    });
  }

  function setupMobileBar() {
    if (!mobileBar || !mobileBarCta) return;
    const acquirePanel = document.querySelector(".productActionBlock") || document.querySelector(".productHeroStage");
    if (!acquirePanel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const showBar = !entry.isIntersecting;
        mobileBar.hidden = !showBar;
        mobileBar.classList.toggle("is-visible", showBar);
        mobileBar.setAttribute("aria-hidden", showBar ? "false" : "true");
      },
      { threshold: 0.12 }
    );
    observer.observe(acquirePanel);
  }

  async function refreshStatus() {
    const response = await fetch(`/api/candidates/${encodeURIComponent(candidate.candidateId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Status refresh failed.");
    candidate = {
      ...payload,
      sessionIntent: candidate.sessionIntent,
    };
    if (status) {
      status.textContent =
        payload.status === "available"
          ? "Available now"
          : payload.status === "auction-active"
          ? "Auction active"
          : "Availability needs refresh";
    }
    const actionable = payload.status === "available" || payload.status === "auction-active";
    if (actionable) {
      setAcquireDisabled(false);
      syncAcquireHref();
    } else {
      setAcquireDisabled(true);
    }
    candidateNode.textContent = JSON.stringify({
      ...candidate,
      sessionIntent: candidate.sessionIntent,
    });
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
    openPath.addEventListener("click", handleAcquireClick);
  }
  if (mobileBarCta) {
    mobileBarCta.addEventListener("click", handleAcquireClick);
  }

  async function handleAcquireClick(event) {
    const target = event.currentTarget;
    if (target.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    try {
      await refreshStatus();
      if (target.getAttribute("aria-disabled") === "true") return;
    } catch (error) {
      console.error(error);
    }
    window.location.href = buildAcquireHref();
  }

  applyStaleUi();
  syncAcquireHref();
  setupMobileBar();
})();
