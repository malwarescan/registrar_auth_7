// Server-rendered informational pages: /methodology/ and /about/.
const { DEFAULT_PUBLIC_BASE_URL } = require("../public-url");
const { SITE_NAME, OPERATOR_NAME, orgId, websiteId, namesiloId, escapeHtml } = require("../site-identity");
const { renderPageDocument } = require("./site-layout");
const { MIN_OVERALL_SCORE } = require("../candidate-store/seo-tier");
const { DEFAULT_SITEMAP_FRESHNESS_HOURS } = require("../candidate-store/sitemap-freshness");
const { MAX_INDEXED_AUCTIONS, STRONG_SCORE, MIN_PRONOUNCEABILITY } = require("../candidate-store/indexing-policy");

const METHODOLOGY_PUBLISHED = "2026-11-05";
const METHODOLOGY_MODIFIED = "2026-11-05";

const PAGE_STYLES = `
      .info-main { max-width: 820px; margin: 0 auto; padding: 8px 20px 48px; font: 16px/1.65 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .info-main a { color: #0044ff; }
      .info-crumbs { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
      .info-main h1 { margin: 0 0 16px; font-size: 2rem; line-height: 1.2; }
      .info-main h2 { margin: 36px 0 12px; font-size: 1.35rem; }
      .info-main h3 { margin: 20px 0 6px; font-size: 1.05rem; }
      .info-lede { font-size: 1.08rem; color: #1f2937; }
      .info-meta { font-size: 13px; color: #6b7280; }
      .info-main table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
      .info-main th, .info-main td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
      .info-main th { background: #f3f4f6; }
      .info-table { overflow-x: auto; }
      .info-main dt { font-weight: 700; margin-top: 12px; }
      .info-main dd { margin: 2px 0 0; }`;

// Score definitions. Numbers mirror server/candidate-store/product-intelligence.js
// and server/domain-fetch/evaluate-quality.js; update both together.
const DOMAIN_PAGE_SCORES = [
  {
    name: "Brandability",
    weight: "22%",
    how: "Starts at 75. Loses 2 points per character beyond 12, 8 points for a hyphen and 20 points when the name repeats a few letters over and over. A name that reads as a random string is capped at 30.",
  },
  {
    name: "Pronounceability",
    weight: "18%",
    how: "Starts at 78. Loses 28 points when the name is hard to say (a run of six or more consonants, fewer than 20% or more than 80% vowels among its letters, or a random string) and 16 points for a letter repeated three times in a row. Names that mix in digits are capped at 55, names with no vowels at 30, and random strings at 25.",
  },
  {
    name: "TLD trust",
    weight: "20%",
    how: "A fixed value per extension: .com 96, .net 84, .co 78, .io 75, .ai 74, any other extension 62.",
  },
  {
    name: "Category clarity",
    weight: "15%",
    how: "Starts at 72. Loses 1.5 points per character beyond 14, 18 points for repetitive letters and 40 points for a random string.",
  },
  {
    name: "Acquisition signal",
    weight: "10%",
    how: "82 when the recorded bid is under $250, 58 when it is over $500, otherwise 68. Acquisition friction is 100 minus this value.",
  },
  {
    name: "Semantic fit",
    weight: "10%",
    how: "62 for names of 12 characters or fewer, 56 for longer names, minus 30 for a random string. On domain pages there is no brief to match against, so this only reflects how compact the name is.",
  },
  {
    name: "Risk-adjusted",
    weight: "5%",
    how: "The average of brandability, pronounceability and TLD trust, minus 6 points for each quality flag.",
  },
];

const QUALITY_FLAGS = [
  ["random-string", "Letters and digits that do not form a word or a recognisable number-plus-word, for example 09kybuo0c. Detected from digit/letter switching, letter pairs that rarely occur in names (such as q without u) and long consonant runs. Blocks indexing."],
  ["hard-to-pronounce", "Long consonant runs, too few or too many vowels, or a random string."],
  ["confusing-spelling", "Contains digits or a double hyphen, so a listener has to ask how it is spelled."],
  ["repeated-characters", "The same character three or more times in a row."],
  ["gibberish", "Very few distinct characters for the name's length. Blocks indexing."],
  ["excessive-length", "More than 22 characters. Blocks indexing."],
];

const GLOSSARY = [
  ["Domain finder", "The search tool at /experiments/intent-fetch/. You describe what you are building and it returns matching names."],
  ["Listing", "One expired-domain auction we recorded: one domain, one auction, one page at /domains/<name>."],
  ["Recorded bid", "The bid shown on NameSilo when we last checked. With no bids yet, this is the opening bid, not a price anyone has agreed to pay."],
  ["Ended", "The auction end time has passed. Ended listings are kept for reference, are not indexed and carry no offer."],
  ["Score", "A 0 to 100 signal from the rules on this page. Scores rank names against each other; they are not valuations."],
];

function renderScoreTable(rows) {
  return `<div class="info-table"><table><thead><tr><th scope="col">Score</th><th scope="col">Weight in overall</th><th scope="col">How it is calculated</th></tr></thead><tbody>${rows
    .map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong></td><td>${escapeHtml(row.weight)}</td><td>${escapeHtml(row.how)}</td></tr>`)
    .join("")}</tbody></table></div>`;
}

function renderMethodologyPage(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const baseUrl = metadataBaseUrl;
  const canonical = `${baseUrl}/methodology/`;
  const title = `How ${SITE_NAME} Scores Expired Domains`;
  const description = `How ${SITE_NAME} scores expired-domain auction names: what each score measures, its weight in the overall score, where the auction data comes from, when a page is indexed and the known limits.`;

  const body = `    <main class="info-main">
      <p class="info-crumbs"><a href="/">Home</a> › Methodology</p>
      <article>
        <h1>How ${escapeHtml(SITE_NAME)} scores expired domains</h1>
        <p class="info-lede">Every name gets an overall score from 0 to 100, built from seven simple rules about the name itself, its extension and its recorded bid. The rules are fixed and published below. They help you sort a long list quickly; they do not tell you what a domain is worth.</p>
        <p class="info-meta">Published ${escapeHtml(METHODOLOGY_PUBLISHED)}. Updated ${escapeHtml(METHODOLOGY_MODIFIED)}.</p>

        <h2>Where the data comes from</h2>
        <p>Auction records come from NameSilo's public expired-domain auction listings, read through NameSilo's auction API (every auction NameSilo lists as active). For each auction we store the domain, the opening and current bid, the number of bids, the year the domain was first registered, the end time and the NameSilo auction link. We do not run auctions, hold domains or take bids; bidding happens on NameSilo.</p>
        <p>When the site is connected to NameSilo's API the data is re-fetched every 6 hours; otherwise the site serves the last fetched copy. Either way, the status shown on a page or in a feed is recalculated from the auction end time every time it is served, so an auction whose end time has passed always shows as ended. The current data and its fetch time are described on the <a href="/data/">data page</a>.</p>
        <p>Before anything is published we leave out adult, gambling, piracy, drug, brand look-alike (for example a name one letter away from a famous brand) and test names. Those names get no page at all.</p>

        <h2>Scores on domain pages</h2>
        <p>Each score is clamped to the range 20 to 97. The overall score is the weighted sum below.</p>
        ${renderScoreTable(DOMAIN_PAGE_SCORES)}
        <p>Buyer fit (50 plus a tenth of brandability) is shown on pages but is not part of the overall score.</p>

        <h2>Scores in the domain finder</h2>
        <p>The <a href="/experiments/intent-fetch/">domain finder</a> also knows what you asked for, so semantic fit, buyer fit and category clarity there depend on how many of your brief's key terms (worth 14, 11 and 12 points each) and related terms (8, 7 and 7 points) the name contains. Its overall score weights semantic fit 30%, buyer fit 20%, brandability 20%, pronounceability 10%, category clarity 10%, TLD trust 8%, acquisition signal 7% and risk 5%. A name is only shown when semantic fit is at least 60, brandability and pronounceability at least 55, category clarity at least 50, and it is not flagged as gibberish or a random string.</p>

        <h2>Quality flags</h2>
        <dl>${QUALITY_FLAGS.map(([flag, meaning]) => `<dt><code>${escapeHtml(flag)}</code></dt><dd>${escapeHtml(meaning)}</dd>`).join("")}</dl>

        <h2>Categories and use cases</h2>
        <p>A name gets a category (such as Fintech or E-commerce) only when it contains a recognised term as a whole word, or at the start or end of the name: "legalai" signals Legal tech and AI software. Names with no recognised term get no category at all rather than a made-up one.</p>

        <h2>When a domain page is indexed</h2>
        <p>NameSilo's expired-domain auctions last only a few days, so we do not ask search engines to index thousands of pages that will soon be gone. A domain page asks to be indexed only when all of these hold, and the same rule decides whether it is listed in the sitemap:</p>
        <ul>
          <li>the auction has not ended and the record was checked within the last ${DEFAULT_SITEMAP_FRESHNESS_HOURS} hours;</li>
          <li>the name is 4 to 15 letters (no digits or hyphens), on .com, .net, .org, .co, .io, .ai, .app or .dev;</li>
          <li>the name splits into one or two common English words (three words only if the auction already has a bid);</li>
          <li>pronounceability is at least ${MIN_PRONOUNCEABILITY}, the overall score is at least ${MIN_OVERALL_SCORE}, and the auction either has a bid or scores at least ${STRONG_SCORE};</li>
          <li>the name has no quality flag at all;</li>
          <li>it is among the best ${MAX_INDEXED_AUCTIONS} such names in the current data (auctions with bids first).</li>
        </ul>
        <p>Every other domain page is marked noindex,follow. Ended auctions show "Auction ended" with the end date, carry no offer in their structured data, are noindex and leave the sitemap. The lasting pages are the <a href="/auctions">auction lists</a>, which keep their addresses while the auctions in them change.</p>

        <h2>Known limitations</h2>
        <ul>
          <li>Scores look only at the name, the extension and the bid. They do not check trademarks, backlinks, spam history or traffic; see <a href="/guides/how-to-check-an-expired-domain-before-bidding">how to check an expired domain before bidding</a>.</li>
          <li>Bids are as recorded at the last check and can be out of date within minutes. Always confirm on NameSilo.</li>
          <li>Category matching is a short word list in English. Names in other languages usually get no category.</li>
          <li>The random-string check is a heuristic and can miss some random names or flag an unusual real one.</li>
        </ul>

        <h2>Terms used on this site</h2>
        <dl>${GLOSSARY.map(([term, meaning]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(meaning)}</dd>`).join("")}</dl>
      </article>
    </main>`;

  return renderPageDocument({
    title: `${title} | ${SITE_NAME}`,
    description,
    canonical,
    robots: "index,follow",
    ogType: "article",
    baseUrl,
    nodes: [
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        headline: `How ${SITE_NAME} scores expired domains`,
        description,
        url: canonical,
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical, isPartOf: { "@id": websiteId(baseUrl) }, breadcrumb: { "@id": `${canonical}#breadcrumbs` } },
        about: { "@type": "Thing", name: "Domain name valuation", sameAs: "https://en.wikipedia.org/wiki/Domain_name_speculation" },
        isBasedOn: { "@id": namesiloId(baseUrl) },
        datePublished: METHODOLOGY_PUBLISHED,
        dateModified: METHODOLOGY_MODIFIED,
        author: { "@id": orgId(baseUrl) },
        publisher: { "@id": orgId(baseUrl) },
        image: `${baseUrl}/assets/domain-og-default.png`,
        inLanguage: "en",
      },
      {
        "@type": "DefinedTermSet",
        "@id": `${canonical}#glossary`,
        name: `${SITE_NAME} glossary`,
        hasDefinedTerm: GLOSSARY.map(([term, meaning]) => ({ "@type": "DefinedTerm", name: term, description: meaning })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
          { "@type": "ListItem", position: 2, name: "Methodology", item: canonical },
        ],
      },
    ],
    styles: PAGE_STYLES,
    body,
    currentPath: "/methodology/",
  });
}

function renderAboutPage(metadataBaseUrl = DEFAULT_PUBLIC_BASE_URL) {
  const baseUrl = metadataBaseUrl;
  const canonical = `${baseUrl}/about/`;
  const description = `${SITE_NAME} is run by ${OPERATOR_NAME}. It lists ${OPERATOR_NAME} expired-domain auctions, scores the names and publishes guides on buying expired domains.`;
  const body = `    <main class="info-main">
      <p class="info-crumbs"><a href="/">Home</a> › About</p>
      <h1>About ${escapeHtml(SITE_NAME)}</h1>
      <p class="info-lede">${escapeHtml(SITE_NAME)} is run by <a href="https://www.namesilo.com" rel="noopener">${escapeHtml(OPERATOR_NAME)}</a>. It helps you find expired domains on auction: describe what you are building, see matching names with their recorded bids and scores, and read short guides before you bid.</p>
      <h2>What is on the site</h2>
      <ul>
        <li><a href="/experiments/intent-fetch/">Domain finder</a>: search current ${escapeHtml(OPERATOR_NAME)} expired-domain auctions by what you are building.</li>
        <li><a href="/guides">Guides</a>: how auctions and backorders work, what to check, and how to set a maximum bid.</li>
        <li><a href="/methodology/">Methodology</a>: exactly how every score is calculated.</li>
        <li><a href="/data/">Data</a>: the auction records as free downloads.</li>
      </ul>
      <h2>How bidding works</h2>
      <p>The auctions listed here are ${escapeHtml(OPERATOR_NAME)} expired-domain auctions. Bids are placed on ${escapeHtml(OPERATOR_NAME)}, not on this site. Because the site is run by ${escapeHtml(OPERATOR_NAME)}, the guides say which rules are ${escapeHtml(OPERATOR_NAME)}'s and which apply to other platforms, and cite each platform's own help pages.</p>
    </main>`;
  return renderPageDocument({
    title: `About ${SITE_NAME}: Run by ${OPERATOR_NAME} | ${SITE_NAME}`,
    description,
    canonical,
    robots: "index,follow",
    ogType: "website",
    baseUrl,
    nodes: [
      {
        "@type": "AboutPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: `About ${SITE_NAME}`,
        description,
        isPartOf: { "@id": websiteId(baseUrl) },
        publisher: { "@id": orgId(baseUrl) },
        mainEntity: { "@id": orgId(baseUrl) },
        breadcrumb: { "@id": `${canonical}#breadcrumbs` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${baseUrl}/` },
          { "@type": "ListItem", position: 2, name: "About", item: canonical },
        ],
      },
    ],
    styles: PAGE_STYLES,
    body,
    currentPath: "/about/",
  });
}

module.exports = {
  renderMethodologyPage,
  renderAboutPage,
};
