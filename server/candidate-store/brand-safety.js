// Small brand-safety filter applied to every auction before it enters the
// store. A name that fails is not given a page at all: adult terms, slurs,
// gambling, piracy, look-alikes of well-known brands and throwaway test names.
// The lists are short and deliberately conservative; a false positive only
// costs one page for a name we would never promote anyway.

// Matched anywhere in the name (the label without its extension).
const ANYWHERE = {
  adult: [
    "porn", "xxx", "sex", "fuck", "pussy", "milf", "hentai", "nude", "naked", "escort", "slut", "whore",
    "boob", "tits", "dildo", "fetish", "bdsm", "camgirl", "onlyfans", "erotic", "orgasm", "horny", "blowjob",
    "nsfw", "upskirt", "incest", "shemale", "stripclub", "hooker", "asshole", "bitch",
  ],
  slur: ["nigger", "nigga", "faggot", "retard", "tranny", "kike", "chink", "wetback", "raghead", "spastic"],
  gambling: [
    "casino", "poker", "slots", "gambl", "betting", "sportsbook", "lottery", "lotto", "jackpot", "roulette",
    "baccarat", "blackjack", "togel", "bocai", "betway", "bet365", "1xbet", "sabong", "pachinko",
  ],
  piracy: [
    "torrent", "warez", "keygen", "nulled", "movies", "putlocker", "fmovies", "gomovies", "soap2day",
    "solarmovie", "primewire", "vumoo", "kissanime", "gogoanime", "9anime", "iptv", "freemovie", "watchfree",
    "streamfree", "pirate", "123movie", "xiaoshuo", "manhwa", "mangafree",
  ],
  drugs: ["cannabis", "weed", "marijuana", "viagra", "kratom", "steroid", "opioid", "cocaine"],
};

// Matched only as the whole name or at its start/end; these are too short or
// too common inside innocent words ("alphabet", "cumulus") to match anywhere.
const EDGE = {
  adult: ["dick", "gay", "lust", "babes", "jav"],
  gambling: ["slot", "bingo", "dafa"],
  piracy: ["movie", "anime", "crack"],
  drugs: ["cialis"],
};

// Terms that need context to avoid blocking ordinary words: "anal" but not
// "analytics" or "canal", "cock" but not "cockpit" or "peacock".
const PATTERNS = [
  { category: "adult", term: "anal", pattern: /^anal(?![oy])|anal(sex|porn|video|tube|fuck|toy)/ },
  { category: "gambling", term: "judi", pattern: /^judi(?!th|ci|o)/ },
  { category: "drugs", term: "meth", pattern: /^meth(?!od|yl|ane|ane)|meth$/ },
  { category: "adult", term: "cock", pattern: /^cock(?!pit|tail|roach|atoo|er|le)|[^ae]cock$/ },
  { category: "adult", term: "cum", pattern: /^cum(?!b|in|ul|mi)|[^l]cum$/ },
  {
    category: "gambling",
    term: "bet",
    pattern: /^bets?$|^bets?(win|online|club|king|vip|live|zone|star|sport|pro|now|hub|plus|max|arena)|(win|vip|sport|sports|live|online|king|club|mega|super|lucky|max)bets?$/,
  },
];

// Brands whose names should not be auctioned under a look-alike. Containing the
// brand, or being one edit away from it, blocks the name.
const BRANDS = [
  "google", "gmail", "youtube", "facebook", "instagram", "whatsapp", "messenger", "amazon", "apple", "icloud",
  "iphone", "microsoft", "outlook", "office365", "windows", "xbox", "paypal", "netflix", "ebay", "twitter",
  "tiktok", "linkedin", "walmart", "costco", "target", "wellsfargo", "chase", "citibank", "bankofamerica",
  "coinbase", "binance", "metamask", "kraken", "namesilo", "godaddy", "namecheap", "cloudflare", "openai",
  "chatgpt", "anthropic", "claude", "yahoo", "adobe", "samsung", "nike", "adidas", "disney", "spotify", "steam",
  "roblox", "fortnite", "telegram", "snapchat", "pinterest", "reddit", "dropbox", "zoom", "shopify", "stripe",
  "visa", "mastercard", "amex", "fedex", "dhl", "usps", "ups", "irs", "tesla", "uber", "airbnb", "booking",
];
// Common words that happen to be brand names are only blocked as exact or
// look-alike matches, never when merely contained ("targetpractice" is fine,
// "targett" is not).
const GENERIC_BRANDS = new Set([
  "apple", "target", "chase", "windows", "kraken", "steam", "zoom", "stripe", "visa", "booking", "claude",
  "messenger", "uber", "adobe", "amex", "usps",
]);

const TEST_NAME = /^(test|tests|testing|tester|demo|sample|example|temp|tmp|dummy|staging|asdf|qwerty|foo|foobar|abc|xyz)[-_]?\d*$/;
const TEST_FRAGMENT = /(test\d|\dtest|^test[-_]|asdf|qwerty|lorem|ipsum)/;

const LEET = { 0: "o", 1: "l", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b" };

function labelOf(domain) {
  const safe = String(domain || "").toLowerCase().trim();
  const idx = safe.indexOf(".");
  return idx === -1 ? safe : safe.slice(0, idx);
}

function deleteVariants(word) {
  const out = new Set();
  for (let i = 0; i < word.length; i += 1) out.add(word.slice(0, i) + word.slice(i + 1));
  return out;
}

// True when a and b are within one insertion, deletion, substitution or
// adjacent swap of each other.
function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length === 1) return true;
    return diffs.length === 2 && diffs[1] === diffs[0] + 1 && a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return deleteVariants(longer).has(shorter);
}

function matchesEdge(compact, term) {
  return compact === term || compact.startsWith(term) || compact.endsWith(term);
}

function brandLookalike(compact) {
  const deLeet = compact.replace(/[0134578]/g, (digit) => LEET[digit]);
  const letters = deLeet.replace(/[^a-z]/g, "");
  const mostlyLetters = compact.replace(/[^a-z]/g, "").length >= compact.length * 0.7;
  for (const brand of BRANDS) {
    if (!GENERIC_BRANDS.has(brand) && brand.length >= 4 && letters.includes(brand)) return brand;
    if (letters === brand) return brand;
    // Look-alike check only for names that are mostly letters to begin with,
    // so a number such as 3521242 is not read as "tesla".
    if (mostlyLetters && !GENERIC_BRANDS.has(brand) && brand.length >= 5 && withinOneEdit(letters, brand)) return brand;
  }
  return null;
}

// Returns { safe: true } or { safe: false, category, term }.
function checkBrandSafety(domain) {
  const label = labelOf(domain);
  const compact = label.replace(/[^a-z0-9]/g, "");
  if (!compact) return { safe: false, category: "invalid", term: "" };

  for (const [category, terms] of Object.entries(ANYWHERE)) {
    const term = terms.find((t) => compact.includes(t));
    if (term) return { safe: false, category, term };
  }
  for (const [category, terms] of Object.entries(EDGE)) {
    const term = terms.find((t) => matchesEdge(compact, t));
    if (term) return { safe: false, category, term };
  }
  for (const { category, term, pattern } of PATTERNS) {
    if (pattern.test(compact)) return { safe: false, category, term };
  }
  // "365bet", "bet88": numbered betting brands.
  if (/\d+bet|bet\d+/.test(compact)) return { safe: false, category: "gambling", term: "bet" };
  const brand = brandLookalike(compact);
  if (brand) return { safe: false, category: "brand-typosquat", term: brand };
  if (TEST_NAME.test(compact) || TEST_FRAGMENT.test(label)) return { safe: false, category: "test-name", term: compact };
  return { safe: true };
}

function isBrandSafe(domain) {
  return checkBrandSafety(domain).safe;
}

module.exports = {
  BRANDS,
  checkBrandSafety,
  isBrandSafe,
  withinOneEdit,
};
