import React, { useEffect, useMemo, useRef, useState } from "react";
import Lightfall from "./components/Lightfall/Lightfall";
import BorderGlow from "./components/BorderGlow/BorderGlow";
import {
  buildDomainDetailLink,
  detectBriefSignals,
  fetchDomainCandidates,
  getCandidateAcquisitionPath,
  getCandidateFitScore,
  getCandidateMarketStatus,
  getCandidatePriceAmount,
  getCandidateReasonLine,
  getCandidateSlug,
  sortDecisionCandidates,
} from "./intent-fetch-api";
import SnatchLogo from "./components/SnatchLogo/SnatchLogo";
import "./IntentFetchPage.css";

const starterExamples = ["AI Receptionist", "Legal AI", "Cybersecurity SaaS", "Healthcare Startup"];
const inputPlaceholder = "Describe a startup, niche, or business idea…";
const SKELETON_COUNT = 4;
const REVEAL_STAGGER_MS = 120;

function resolveDataState(fetchPhase, isComposing) {
  if (fetchPhase === "searching") return "searching";
  if (fetchPhase === "revealing") return "revealing";
  if (fetchPhase === "complete") return "complete";
  if (fetchPhase === "empty") return "empty";
  if (fetchPhase === "error") return "error";
  if (isComposing) return "typing";
  return "idle";
}

function resolveLightfallProps(dataState) {
  if (dataState === "searching" || dataState === "revealing") {
    return { speed: 0.72, density: 0.82, glow: 0.95, streakCount: 8, opacity: 1 };
  }
  if (dataState === "complete" || dataState === "empty" || dataState === "error") {
    return { speed: 0.45, density: 0.58, glow: 0.7, streakCount: 6, opacity: 0.78 };
  }
  return { speed: 0.48, density: 0.48, glow: 0.58, streakCount: 5, opacity: 0.72 };
}

function CandidateCardSkeleton({ isBestMatch }) {
  return (
    <div
      className={`candidateOpportunity isSkeleton ${isBestMatch ? "isBest" : ""}`}
      aria-hidden="true"
    >
      <div className="candidateLeft">
        {isBestMatch && <span className="skeletonLine skeletonLine--label" />}
        <span className="skeletonLine skeletonLine--domain" />
        <span className="skeletonLine skeletonLine--reason" />
        <span className="skeletonLine skeletonLine--status" />
      </div>
      <div className="candidateRight">
        <span className="skeletonLine skeletonLine--price" />
        <span className="skeletonLine skeletonLine--path" />
        {isBestMatch && <span className="skeletonLine skeletonLine--cta" />}
      </div>
    </div>
  );
}

function CandidateCard({ candidate, index, intentContext, revealed, isBestMatch }) {
  const slug = getCandidateSlug(candidate);
  const fitScore = getCandidateFitScore(candidate);
  const price = getCandidatePriceAmount(candidate);
  const path = getCandidateAcquisitionPath(candidate);
  const marketStatus = getCandidateMarketStatus(candidate);
  const reason = getCandidateReasonLine(candidate);
  const detailHref = buildDomainDetailLink(slug, {
    intentId: intentContext?.intentId,
    intentSlug: intentContext?.intentSlug,
    rank: index + 1,
    fitScore,
  });

  return (
    <a
      href={detailHref}
      className={`candidateOpportunity ${isBestMatch ? "isBest" : ""} ${revealed ? "isRevealed" : ""}`}
      aria-label={`Open ${candidate.domain}, fit ${fitScore ?? "unknown"}`}
    >
      <div className="candidateLeft">
        {isBestMatch && <span className="bestLabel">SNATCH PICK</span>}
        <h3 className="candidateDomain">{candidate.domain}</h3>
        <p className="candidateReason">{reason}</p>
        <p className="candidateStatus">{marketStatus}</p>
      </div>
      <div className="candidateRight">
        <strong className="candidatePrice">{price}</strong>
        <span className="candidatePath">{path}</span>
        <span className="candidateReview">{isBestMatch ? "Open brief →" : "Review →"}</span>
      </div>
    </a>
  );
}

function ResultSlot({ index, candidate, intentContext, fetchPhase, visibleCount }) {
  const isBestMatch = index === 0;
  const isRevealed = index < visibleCount;
  const showCard =
    candidate &&
    (fetchPhase === "complete" || (fetchPhase === "revealing" && isRevealed));
  const showSkeleton =
    fetchPhase === "searching" ||
    (fetchPhase === "revealing" && candidate && !isRevealed);

  if (showCard) {
    return (
      <CandidateCard
        candidate={candidate}
        index={index}
        intentContext={intentContext}
        revealed={fetchPhase === "complete" || isRevealed}
        isBestMatch={isBestMatch}
      />
    );
  }

  if (showSkeleton) {
    return <CandidateCardSkeleton isBestMatch={isBestMatch} />;
  }

  return null;
}

function EmptyState({ onSuggestion }) {
  return (
    <div className="emptyCard">
      <h2 className="emptyCardTitle">No qualified candidates</h2>
      <p className="emptyCardBody">Try a broader category, fewer constraints, or another TLD.</p>
      <div className="emptyCardActions">
        <button type="button" className="emptyChip" onClick={() => onSuggestion("Broaden brief")}>
          Broaden brief
        </button>
        <button type="button" className="emptyChip" onClick={() => onSuggestion(".com only")}>
          Try .com only
        </button>
        <button type="button" className="emptyChip" onClick={() => onSuggestion("Include auctions")}>
          Include auctions
        </button>
      </div>
    </div>
  );
}

export default function IntentFetchPage() {
  const [brief, setBrief] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [fetchPhase, setFetchPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [intentContext, setIntentContext] = useState(null);
  const [resultAnnouncement, setResultAnnouncement] = useState("");
  const [showSkeletonDelayed, setShowSkeletonDelayed] = useState(false);
  const inputRef = useRef(null);
  const fetchTokenRef = useRef(0);
  const revealTimerRef = useRef(null);

  const isComposing = fetchPhase === "idle" && brief.trim().length > 0;
  const dataState = resolveDataState(fetchPhase, isComposing);

  useEffect(() => {
    document.body.dataset.state = dataState;
    return () => {
      delete document.body.dataset.state;
    };
  }, [dataState]);

  const detectedSignals = useMemo(() => detectBriefSignals(brief), [brief]);
  const showDetected =
    detectedSignals.length > 0 &&
    (dataState === "idle" || dataState === "typing" || dataState === "searching");
  const isBusy = fetchPhase === "searching" || fetchPhase === "revealing";
  const canSubmit = brief.trim().length > 0 && !isBusy;
  const showCandidates = fetchPhase === "revealing" || fetchPhase === "complete";
  const showSkeletons = fetchPhase === "searching" && showSkeletonDelayed;
  const showResults =
    fetchPhase === "searching" ||
    showCandidates ||
    fetchPhase === "empty" ||
    fetchPhase === "error";
  const lightfallProps = resolveLightfallProps(dataState);
  const resultSlotCount = showSkeletons
    ? SKELETON_COUNT
    : showCandidates
    ? candidates.length
    : 0;

  function clearRevealTimer() {
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }

  function startReveal(total) {
    clearRevealTimer();
    setVisibleCount(0);
    setFetchPhase("revealing");

    let count = 0;
    revealTimerRef.current = window.setInterval(() => {
      count += 1;
      setVisibleCount(count);
      if (count >= total) {
        clearRevealTimer();
        setFetchPhase("complete");
        setResultAnnouncement(`${total} candidate${total === 1 ? "" : "s"} surfaced.`);
      }
    }, REVEAL_STAGGER_MS);
  }

  useEffect(() => () => clearRevealTimer(), []);

  useEffect(() => {
    if (fetchPhase !== "searching") {
      setShowSkeletonDelayed(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowSkeletonDelayed(true), 100);
    return () => window.clearTimeout(timer);
  }, [fetchPhase]);

  function handleExampleClick(example) {
    setBrief(example);
    inputRef.current?.focus();
  }

  function handleEmptySuggestion(label) {
    if (label === "Broaden brief") {
      setBrief((current) => (current.trim() ? `${current.trim()} software platform` : "Software platform"));
    } else if (label === ".com only") {
      setBrief((current) => `${current.trim()} .com`.trim());
    } else if (label === "Include auctions") {
      setBrief((current) => current.trim() || "Include auctions");
    }
    setFetchPhase("idle");
    inputRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    const token = ++fetchTokenRef.current;
    const query = brief.trim();

    clearRevealTimer();
    setFetchPhase("searching");
    setErrorMessage("");
    setCandidates([]);
    setVisibleCount(0);
    setResultAnnouncement("");

    try {
      const result = await fetchDomainCandidates(query);
      if (token !== fetchTokenRef.current) return;

      const sorted = sortDecisionCandidates(result.decisionCandidates || []);
      setIntentContext({
        intentId: result.intent_id,
        intentSlug: result.intent_slug,
      });
      setCandidates(sorted);

      if (!sorted.length) {
        setFetchPhase("empty");
        setResultAnnouncement("No qualified candidates.");
        return;
      }

      startReveal(sorted.length);
    } catch (error) {
      if (token !== fetchTokenRef.current) return;
      setFetchPhase("error");
      setErrorMessage(error instanceof Error ? error.message : "Surface failed.");
    }
  }

  const submitLabel =
    fetchPhase === "searching" || fetchPhase === "revealing" ? "Surfacing" : "Surface";
  const buttonDisabled = !brief.trim() || isBusy;

  return (
    <main className="page intentPage" data-state={dataState}>
      <section className="hero-wrap">
        <header className="site-header">
          <SnatchLogo className="site-logo" />
        </header>

        <BorderGlow
          edgeSensitivity={26}
          glowColor="245 85 78"
          backgroundColor="#080A24"
          borderRadius={30}
          glowRadius={0}
          glowIntensity={0}
          coneSpread={18}
          animated={false}
          colors={["#8EA7FF", "#C084FC", "#38BDF8"]}
          fillOpacity={0}
          className="hero-card heroGlow ifEntranceHero"
        >
          <section className="intentHero heroCard" aria-label="Intent fetch">
            <div className="heroVisual" aria-hidden="true">
              <Lightfall
                colors={["#A6C8FF", "#7C5CFF", "#FF9FFC"]}
                backgroundColor="#080A24"
                streakWidth={0.85}
                streakLength={1.05}
                twinkle={dataState === "idle" || dataState === "typing" ? 0.32 : 0.45}
                zoom={2.35}
                backgroundGlow={dataState === "idle" || dataState === "typing" ? 0.38 : 0.55}
                mouseInteraction={dataState === "idle" || dataState === "typing"}
                mouseStrength={0.45}
                mouseRadius={0.75}
                mouseDampening={0.18}
                {...lightfallProps}
              />
            </div>

            <div className={`heroContent intentHeroContent${showDetected ? " hasDetectedSignals" : ""}`}>
              <div className="heroStack">
                <div className="heroPromo">
                  <div className="heroPromoInner">
                    <h1 className="heroHeadline">
                      Find domains that
                      <br />
                      match intent.
                    </h1>
                    <p className="heroSubcopy">
                      Surface qualified candidates from a brief — live auctions and available names.
                    </p>
                  </div>
                </div>

                <div
                  className={`detectedSlot${brief.trim() ? " detectedSlot--active" : ""}`}
                  aria-live="polite"
                >
                  {showDetected && (
                    <div className="detectedBlock heroAux">
                      <span className="detectedLabel">Detected</span>
                      <div className="detectedChips">
                        {detectedSignals.map((signal) => (
                          <span key={signal} className="detectedChip">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form
                  className={`commandShell inputShell ${inputFocused ? "focused" : ""} ${
                    isBusy ? "inputShell--locked" : ""
                  }`}
                  onSubmit={handleSubmit}
                >
                  <label htmlFor="intentBrief" className="ifSrOnly">
                    Business brief
                  </label>
                  <input
                    ref={inputRef}
                    id="intentBrief"
                    className="commandInput intentInput"
                    type="text"
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={inputPlaceholder}
                    maxLength={2000}
                    autoComplete="off"
                    disabled={isBusy}
                  />
                  <button
                    type="submit"
                    className={`commandButton fetchButton ${isBusy ? "isSurfacing fetchButton--busy" : ""}`}
                    disabled={buttonDisabled}
                    aria-label="Surface domain candidates"
                  >
                    {submitLabel}
                  </button>
                </form>

                <div className="heroSuggestions ifSuggestions" aria-label="Try an example brief">
                  {starterExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="heroSuggestion"
                      onClick={() => handleExampleClick(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </BorderGlow>
      </section>

        <section className={`resultsSurface snatchRail ${showResults ? "resultsSurface--active" : ""}`}>
        <div className="resultsSurfaceInner">
          <section className="ifWorkspace" aria-live="polite" aria-atomic="true">
          <p className="ifSrOnly">{resultAnnouncement}</p>

          {fetchPhase === "error" && (
            <p className="ifResultsError" role="alert">
              {errorMessage}
            </p>
          )}

          {fetchPhase === "empty" && <EmptyState onSuggestion={handleEmptySuggestion} />}

          {(fetchPhase === "complete" || fetchPhase === "revealing") && candidates.length > 0 && (
            <p className="resultsCount">
              {candidates.length} candidate{candidates.length === 1 ? "" : "s"} surfaced
              {brief.trim() ? ` for ${brief.trim()}` : ""}
            </p>
          )}

          <div className="candidateList">
            {Array.from({ length: resultSlotCount }, (_, index) => (
              <ResultSlot
                key={candidates[index]?.candidateId || candidates[index]?.domain || `slot-${index}`}
                index={index}
                candidate={candidates[index]}
                intentContext={intentContext}
                fetchPhase={fetchPhase}
                visibleCount={visibleCount}
              />
            ))}
          </div>

          {fetchPhase === "idle" && !brief.trim() && (
            <p className="ifSrOnly">Describe a product to surface domain candidates.</p>
          )}
          </section>
        </div>
        </section>
      </main>
  );
}
