// Decision guides served at /guides/<slug>. Facts are general and sourced;
// platform-specific rules are attributed to the platform that publishes them.

const PUBLISHED = "2026-11-04";
const MODIFIED = "2026-11-04";

const SOURCES = {
  icannRenewal: {
    label: "ICANN Compliance: Renewal / Redemption (0-45 day renewal window, 30-day redemption period)",
    url: "https://icann-nsp.my.site.com/compliance/s/renewal-redemption",
  },
  icannErrp: {
    label: "ICANN Expired Registration Recovery Policy (ERRP)",
    url: "https://www.icann.org/en/resources/registrars/consensus-policies/errp",
  },
  namesiloFaq: {
    label: "NameSilo: Expired Domain Auction FAQ",
    url: "https://www.namesilo.com/Support/Expired-Domain-Auction-Frequently-Asked-Questions",
  },
  godaddyTimeline: {
    label: "GoDaddy Help: Timeline for GoDaddy Auctions expired domains",
    url: "https://www.godaddy.com/help/timeline-for-godaddy-auctions-expired-domains-42743",
  },
  godaddyTypes: {
    label: "GoDaddy Help: Listing types for GoDaddy Auctions",
    url: "https://www.godaddy.com/help/listing-types-for-godaddy-auctions-1525",
  },
  dropcatch: {
    label: "DropCatch: How it works (backorders cost $59, charged only on success)",
    url: "https://www.dropcatch.com/hiw/overview",
  },
  dropcatchAuctions: {
    label: "DropCatch: Public auctions (3-5 days, proxy bidding)",
    url: "https://www.dropcatch.com/hiw/auctions",
  },
  dynadotGuide: {
    label: "Dynadot: Domain backordering guide (updated 1 June 2026)",
    url: "https://www.dynadot.com/hub/aftermarket/guide-to-domain-backorders",
  },
  icannExpiryFaq: {
    label: "ICANN: FAQs for registrants, domain name renewals and expiration (30-day redemption, 5-day pending delete)",
    url: "https://www.icann.org/resources/pages/domain-name-renewal-expiration-faqs-2018-12-07-en",
  },
  catchclubResolved: {
    label: "NameSilo: How multiple domain backorders are resolved (catch.club, 15 January 2026)",
    url: "https://www.namesilo.com/blog/en/domain-backorder/how-multiple-backorders-are-resolved",
  },
  catchclubHiw: {
    label: "catch.club: How it works (powered by NameSilo)",
    url: "https://catch.club/how-it-works/",
  },
  godaddyBackorderEnd: {
    label: "GoDaddy: GoDaddy phases out domain backorders (8 August 2024)",
    url: "https://www.godaddy.com/resources/news/godaddy-phases-out-domain-backorders",
  },
  namecomBackorder: {
    label: "Name.com: Placing a backorder on a domain (updated 30 July 2025)",
    url: "https://www.name.com/support/articles/205934737-placing-a-backorder-on-a-domain",
  },
  googleSpam: {
    label: "Google Search Central: Spam policies (expired domain abuse)",
    url: "https://developers.google.com/search/docs/essentials/spam-policies",
  },
  googleMarch2024: {
    label: "Google: March 2024 core update and new spam policies",
    url: "https://blog.google/products-and-platforms/products/search/google-search-update-march-2024/",
  },
  muellerHistory: {
    label: "Search Engine Journal: Google's John Mueller on domains with bad history",
    url: "https://www.searchenginejournal.com/google-explains-what-to-do-if-youve-acquired-a-domain-with-bad-history/279375/",
  },
  sedoAgreement: {
    label: "Sedo Domain Marketplace Agreement (seller-set reserve price)",
    url: "https://sedo.com/us/about-us/policies/domain-marketplace-agreement/",
  },
  wayback: {
    label: "Internet Archive Wayback Machine",
    url: "https://web.archive.org/",
  },
  icannLookup: {
    label: "ICANN Lookup (registration data / RDAP)",
    url: "https://lookup.icann.org/",
  },
  uspto: {
    label: "USPTO Trademark Search",
    url: "https://tmsearch.uspto.gov/",
  },
};

const GUIDES = [
  {
    slug: "what-is-a-domain-backorder",
    modified: "2026-11-09",
    question: "How does a domain backorder work?",
    title: "How Does a Domain Backorder Work? Costs, Auctions and Refunds (2026)",
    description:
      "A domain backorder asks a drop-catching service to register a name the moment the registry deletes it. See the expiry timeline, what DropCatch and NameSilo's catch.club charge, what happens when several people backorder, and when you pay nothing.",
    answer: [
      "A domain backorder is a request you place with a drop-catching service to register a domain name the moment the registry deletes it. For a .com name whose owner stops paying, deletion comes at the end of a fixed sequence that ICANN describes: after any renewal window the registrar allows, a deleted name spends 30 days in the redemption period, when only the previous owner can restore it, and then 5 days in pending delete. The registry then releases the name and drop-catching services race to register it in the first moments. If you are the only person who backordered the name with a service and that service catches it, you pay the service's price: DropCatch lists $59 per backorder, and NameSilo's catch.club charges a 20% commission plus the domain's registration cost (prices checked 9 November 2026). If several people backordered the same name with the same service, the name goes to an auction among them. At DropCatch, catch.club and Dynadot you pay nothing if the catch fails. A domain backorder is not a reservation: the owner can still renew, the registrar can sell the name in its own expired-domain auction before deletion, and a rival drop-catcher can catch it first.",
      "Disclosure: URL Snatcher is run by NameSilo. NameSilo also runs the catch.club backorder service and NameSilo's expired-domain auctions, both mentioned on this page.",
    ],
    sections: [
      {
        heading: "How much does a domain backorder cost?",
        lead: [
          "A domain backorder at DropCatch costs $59, and DropCatch charges the $59 only if it secures the domain; DropCatch does not require a subscription. NameSilo's backorder service, catch.club, charges the standard 20% backorder commission plus the domain's registration cost when it catches a name for a single backorder holder, according to NameSilo's own guide published 15 January 2026. Dynadot says placing a backorder is free and you pay only if Dynadot catches the domain; Dynadot's backorder guide does not list a fixed .com price.",
          "Name.com allows only one backorder per domain name, and only for a domain that already has a set drop date (Name.com help page updated 30 July 2025). GoDaddy no longer sells backorders; the GoDaddy section below gives the dates.",
          "The backorder price is the floor, not the final price. When other people backordered the same domain, the domain backorder becomes an auction and you pay your winning bid.",
        ],
        table: {
          headers: ["Service", "Backorder price (checked 9 November 2026)", "If the catch fails", "If several people backorder"],
          rows: [
            ["DropCatch", "$59, charged only on success", "No charge", "Public auction among DropCatch users"],
            ["catch.club (NameSilo)", "20% commission plus registration cost", "No charge; prefunded balance returned", "Closed auction among catch.club backorder holders"],
            ["Dynadot", "Shown per domain; free to place", "No charge", "Dynadot backorder auction"],
            ["GoDaddy", "Stopped selling backorders (see the GoDaddy section)", "Not applicable", "Not applicable"],
          ],
        },
        sources: ["dropcatch", "catchclubResolved", "dynadotGuide", "namecomBackorder"],
        checked: "9 November 2026",
      },
      {
        heading: "Can I still backorder a domain at GoDaddy?",
        lead: [
          "No. GoDaddy stopped selling new domain backorders on August 8, 2024, and existing GoDaddy backorders expired on August 8, 2025. GoDaddy now tells buyers to watch GoDaddy Auctions or use GoDaddy's Domain Broker Services for a specific domain. GoDaddy said the vast majority of its backorders were no longer capturing names and were being converted into GoDaddy Auction purchases. To backorder a domain today you need a drop-catching service such as DropCatch, Dynadot or NameSilo's catch.club.",
        ],
        sources: ["godaddyBackorderEnd"],
        checked: "9 November 2026",
      },
      {
        heading: "Do I get my money back if a domain backorder fails?",
        lead: [
          "At DropCatch, catch.club and Dynadot, a failed domain backorder costs nothing, because each charges only when it catches the name. DropCatch states you are only charged if it secures the domain. catch.club asks you to prefund your account with enough to cover the possible backorder fee, and NameSilo states that you only pay if catch.club successfully catches the domain; otherwise the balance stays yours. If catch.club catches a name but you lose the follow-up auction, NameSilo states that losing bidders pay nothing and their backorder fees are refunded or credited to their accounts.",
          "A domain backorder fails most often because the owner renewed the name, the registrar sold it in an expired-domain auction before deletion, or another drop-catching service registered it first. With catch.club, NameSilo states you have no recourse if a competitor's catching service captures the domain.",
        ],
        sources: ["dropcatch", "catchclubResolved", "dynadotGuide"],
        checked: "9 November 2026",
      },
      {
        heading: "How long do redemption and pending delete last before a domain drops?",
        lead: [
          "A deleted .com domain spends 30 days in the redemption period and then 5 days in pending delete before it drops, so a backordered domain drops about 35 days after the registrar deletes it. ICANN describes both periods and says that after pending delete the name is released for registration on a first-come, first-served basis. Before deletion, the registrar may keep the expired name for its own renewal window and auction. The full sequence for a generic domain such as .com is:",
        ],
        ordered: [
          "Expiration and renewal window: the registrant can still renew. ICANN Compliance describes a registrar-set window of 0 to 45 days.",
          "Registrar expired-domain auction (optional): many registrars auction the expired name during the renewal window. GoDaddy lists expired domains 26 days after expiration for 10 days; NameSilo's auction window is in the NameSilo section below.",
          "Redemption period: only the previous registrant can restore the deleted name, usually for a redemption fee.",
          "Pending delete: nobody can register or restore the name.",
          "Drop: the registry releases the name, and drop-catching services race to register it. A domain backorder acts only at this step.",
        ],
        sources: ["icannExpiryFaq", "icannRenewal", "godaddyTimeline"],
        checked: "9 November 2026",
      },
      {
        heading: "What happens if several people backorder the same domain?",
        lead: [
          "When several people backorder the same domain at the same service and the service catches it, the domain goes to an auction among those backorder holders instead of to the first person who asked. At DropCatch, a caught domain with more than one backorder goes to a public auction open to any verified DropCatch auction user. DropCatch auctions are open for 3-5 days, end at 1 p.m. Mountain Time and never end on weekends; a bid in the last 5 minutes resets the end time to 5 minutes later, and the winner pays the second-highest bid plus one bid increment.",
          "At NameSilo's catch.club, a caught domain with several backorders goes to a closed auction that only catch.club users who placed backorders can join. NameSilo states these private auctions typically run for three to seven days, start at the basic backorder fee plus registration cost, and that the winner pays the winning bid plus the registration fee and the 20% commission. At Dynadot, several backorders trigger a Dynadot backorder auction whose starting bid is the backorder price.",
        ],
        sources: ["dropcatchAuctions", "catchclubResolved", "dynadotGuide"],
        checked: "9 November 2026",
      },
      {
        heading: "Can the owner keep the domain after I backorder it?",
        lead: [
          "Yes. A domain backorder does not stop the current owner from renewing during the renewal window or restoring the name during the 30-day redemption period, and a backorder only acts if the name actually drops. Many expiring names never reach the drop because the registrar sells them in its own expired-domain auction first.",
        ],
        sources: ["icannExpiryFaq"],
        checked: "9 November 2026",
      },
      {
        heading: "Should I place a backorder or bid in an expired-domain auction?",
        lead: [
          "Bid in the registrar's expired-domain auction when the name is listed there, and place a domain backorder only for a name that is not sold before deletion. A registrar auction sells the name before deletion and keeps its original creation date; a domain backorder registers the name after deletion as a new registration. The guide to how expired domain auctions work covers registrar auction rules in full.",
        ],
        table: {
          headers: ["Route", "When it applies", "What you pay", "Main risk"],
          rows: [
            ["Domain backorder (drop-catch)", "The name survives every earlier stage and the registry deletes it", "The service's backorder price, or your winning bid if others backordered too", "Many valuable names are renewed or sold in a registrar auction before they drop"],
            ["Registrar expired-domain auction", "The current registrar auctions the name before deleting it", "Winning bid plus a renewal", "The original owner can still renew and cancel the auction during part of the window"],
            ["Hand registration", "The name drops and nobody catches it", "The standard registration fee", "Only realistic for names no one else is watching"],
          ],
        },
        sources: ["namesiloFaq"],
        checked: "9 November 2026",
      },
      {
        heading: "Does NameSilo offer domain backorders?",
        lead: [
          "Yes. NameSilo's dedicated backorder platform is catch.club, and the catch.club site says it is powered by NameSilo. catch.club says it works with over 10 major drop-catch platforms, covers .com, .org, .net, .tv and more, and manages a caught domain for the first 60 days before delivering it to your account. NameSilo also sells expiring names before they drop through NameSilo expired-domain auctions. NameSilo expired-domain auctions run from 5 days after expiration until day 41 of expiration; the original owner can still renew up to, but not including, day 31, which cancels the auction; and the winner pays the bid plus a 1-year renewal.",
          "Where another service may suit you better: DropCatch publishes one flat $59 price per caught domain, so if you want to know your exact cost before placing a single uncontested backorder, DropCatch states it up front, while catch.club's fee is a commission on top of the registration cost.",
        ],
        sources: ["catchclubResolved", "catchclubHiw", "namesiloFaq", "dropcatch"],
        checked: "9 November 2026",
      },
    ],
    checklist: [
      "Find out who the current registrar is with ICANN Lookup. If that registrar runs expired-domain auctions, watch that auction first; a domain backorder elsewhere only matters if the name is not sold there.",
      "Check the status codes: redemptionPeriod or pendingDelete mean the drop is close; a recent expiry means the name may still be renewed or auctioned.",
      "Confirm the service charges only on success and whether you must prefund your account before placing the backorder.",
      "Decide your maximum before placing the backorder. If others backorder the same name, you will be in an auction and the backorder price is not your final price.",
      "For a valuable name, consider backorders at more than one drop-catcher, since each catches with its own registrar connections. Only do this where each one charges only on success.",
    ],
    whenNot: [
      "The domain is not near expiry. A backorder on a name the owner renews every year can sit for years and never trigger.",
      "The name is in a registrar auction you can bid on directly. Bid there; the backorder only helps if that auction fails.",
      "You need the name by a fixed date, such as a product launch. A domain backorder gives no timing guarantee; contact the owner or choose another name.",
      "The name contains a trademark you do not own. Catching it does not protect you from a UDRP complaint.",
    ],
    mistakes: [
      "Treating a domain backorder as a reservation or a guarantee.",
      "Assuming the backorder price is the final price when other people backordered the same name.",
      "Using a service that charges up front, then paying for names that are never caught.",
      "Ignoring the registrar's own auction, where many expiring names are sold before they ever drop.",
    ],
    nextStep:
      "Look up the domain's registrar and status in ICANN Lookup. If the name is listed in that registrar's expired-domain auction, bid there; if it is in redemption or pending delete, place a backorder with a service that charges only on success and write down your maximum bid before any follow-up auction starts.",
    faqs: [
      {
        q: "Is a domain backorder a guarantee that I get the domain?",
        a: "No. A domain backorder only gives a service permission to try to register the name when it drops. The owner can renew, the registrar can sell the name first, or another drop-catcher can win the race.",
      },
      {
        q: "Can I backorder the same domain at more than one service?",
        a: "Yes. Each drop-catching service races separately, so backorders at several services raise your chance of a catch. Use only services that charge on success, or you may pay more than once.",
      },
      {
        q: "Does a domain caught by a backorder keep its original age?",
        a: "No. A domain caught after it drops is a new registration with a new creation date. A domain bought in a registrar expired-domain auction before deletion keeps its creation date.",
      },
    ],
    sources: ["icannExpiryFaq", "icannRenewal", "dropcatch", "dropcatchAuctions", "catchclubResolved", "catchclubHiw", "dynadotGuide", "godaddyBackorderEnd", "namecomBackorder", "namesiloFaq", "godaddyTimeline", "icannLookup"],
    related: ["how-do-expired-domain-auctions-work", "how-to-check-an-expired-domain-before-bidding", "what-is-a-reserve-price-in-a-domain-auction"],
  },
  {
    slug: "how-do-expired-domain-auctions-work",
    question: "How do expired domain auctions work?",
    title: "How Do Expired Domain Auctions Work? Timeline, Rules and Costs",
    description:
      "Expired domain auctions sell names the owner did not renew, before the registrar deletes them. See the timeline at NameSilo and GoDaddy, what you actually pay, and the rules that cancel or extend auctions.",
    answer: [
      "When a domain expires and the owner does not renew it, many registrars auction it during the post-expiration window instead of letting it drop. The highest bidder at the end gets the domain, usually paying the winning bid plus a renewal, but the original owner can still renew during part of that window, which cancels the auction.",
      "Timelines, minimum bids, payment rules and transfer times are set by each platform, so read the rules of the specific auction before you bid.",
    ],
    sections: [
      {
        heading: "Timeline at two registrars (as each publishes it)",
        table: {
          headers: ["Step", "NameSilo", "GoDaddy"],
          rows: [
            ["Auction listed", "From 5 days after expiration", "26 days after expiration, for 10 days"],
            ["Owner can still renew", "Up to (not including) day 31; renewal cancels the auction", "Days 26-29 regardless of bids; days 30-36 only if there is no active bid"],
            ["Auction ends", "Day 41 of expiration", "If unsold, moves to a 5-day Closeout (price drops daily) from day 37; all auctions end day 43"],
            ["What the winner pays", "Bid plus a 1-year renewal, deducted from account funds", "Payment due within 48 hours of winning"],
            ["Delivery", "Domain moved to your account; creation date unchanged", "Typically transferred within 15 days of payment"],
            ["Bid limits", "Each auction has a maximum bid; you need account funds to cover bid plus renewal", "See platform bidding rules"],
          ],
        },
        paragraphs: [
          "If nobody wins, the registrar generally deletes the name. It then goes through the 30-day redemption period and, for .com, a pending-delete period of about 5 days before it drops and drop-catch backorders come into play.",
        ],
      },
      {
        heading: "How bidding usually works",
        list: [
          "Proxy (maximum) bidding: you enter the most you are willing to pay and the system bids for you in increments. Your maximum is not shown to others.",
          "Late-bid extensions: many platforms add time when a bid arrives in the final minutes, so placing a bid at the last second does not always end the auction. Check the platform's rule.",
          "Funds and verification: platforms commonly require a verified account, funds on deposit, or a card on file before you can bid. NameSilo requires account funds or credit covering the bid plus the renewal.",
          "Binding bids: a winning bid is normally an obligation to pay. NameSilo says failing to pay can remove credit and, if repeated, bar you from its marketplace.",
        ],
      },
    ],
    checklist: [
      "Read the auction's rules page: end time and time zone, renewal cancellation window, extension rule, payment deadline, and transfer timing.",
      "Add the renewal (and any transfer fee) to your bid when deciding your maximum.",
      "Vet the domain's history and trademark risk before bidding, not after winning.",
      "Set one maximum bid you are comfortable losing at, enter it, and do not raise it in the closing minutes.",
      "Plan for cancellation: if the owner renews, your winning position disappears.",
    ],
    whenNot: [
      "You cannot pay within the platform's deadline. Unpaid wins can cost you account standing.",
      "The name matches someone else's trademark. Winning the auction does not give you rights against a UDRP or court claim.",
      "You need the name on a specific date. Renewals, cancellations and transfer windows make timing uncertain.",
    ],
    mistakes: [
      "Forgetting that the price shown excludes the renewal fee.",
      "Bidding early on a name still inside the owner's renewal window and treating it as a sure thing.",
      "Assuming every platform follows the same timeline. NameSilo's auctions start around day 5; GoDaddy's start around day 26.",
      "Raising your maximum repeatedly in the final minutes because of a late-bid extension.",
    ],
    nextStep:
      "Pick one auction you are considering, open its rules page, and fill in five things: end time, renewal-cancellation window, total cost (bid plus renewal), payment deadline, and your maximum bid. If any of the five is unclear, do not bid yet.",
    faqs: [
      {
        q: "How long does an expired domain auction last?",
        a: "It depends on the platform. NameSilo's expired-domain auctions run until day 41 after expiration; GoDaddy lists expired domains for 10 days starting 26 days after expiration, followed by a 5-day Closeout for unsold names.",
      },
      {
        q: "Can I lose a domain I am winning?",
        a: "Yes. If the original owner renews during the platform's renewal window, the auction is cancelled. NameSilo states it cancels the auction and notifies bidders when a domain is renewed.",
      },
      {
        q: "Do I pay anything besides my bid?",
        a: "Usually a renewal. NameSilo charges the winning bid plus a 1-year renewal. Check each platform for renewal, transfer or buyer fees.",
      },
      {
        q: "Does the domain keep its original creation date?",
        a: "At NameSilo, yes: the domain moves to your account and the creation date stays the same, because it was never deleted. A domain caught after it drops is a new registration with a new creation date.",
      },
    ],
    sources: ["namesiloFaq", "godaddyTimeline", "godaddyTypes", "icannRenewal", "icannErrp"],
    related: ["what-is-a-domain-backorder", "how-to-estimate-a-fair-bid-for-an-expired-domain", "should-i-bid-on-a-domain-with-low-bid-count"],
  },
  {
    slug: "how-to-check-an-expired-domain-before-bidding",
    question: "How do you check an expired domain before bidding?",
    title: "How to Check an Expired Domain Before Bidding: 8-Point Checklist",
    description:
      "Before you bid on an expired domain, check its archive history, backlinks, search index status, trademark risk, blocklists and registration data. A step-by-step checklist with red flags and pass/fail criteria.",
    answer: [
      "Check what the domain was used for (Wayback Machine), who links to it and with what anchor text, whether it has trademark or blocklist problems, and what the auction will really cost you including renewal. Walk away if you find spam, adult, gambling or pharma history unrelated to your plans, manipulative links, or a trademark match.",
      "Most of these checks take a few minutes with free tools, and they are much cheaper than buying a domain you cannot use.",
    ],
    sections: [
      {
        heading: "The checks, in order",
        table: {
          headers: ["Check", "How", "Pass", "Red flag"],
          rows: [
            ["Past content", "Wayback Machine snapshots across several years", "A real site in a topic close to yours", "Spam, adult, casino, pharma, scraped content, or a parked page network"],
            ["Ownership changes", "Archive snapshots for sudden topic or language switches", "One consistent use", "Repeated switches, especially to a new language or niche, often a sign of prior expired-domain reuse"],
            ["Backlinks", "Any backlink tool; read the top linking pages yourself", "Editorial links from relevant sites", "Anchors in foreign languages or for casino/pharma terms, comment or forum spam, sudden link spikes"],
            ["Search index", "Search site:example.com", "Pages indexed or nothing indexed", "Indexed spam pages from a recent owner"],
            ["Trademark", "USPTO and relevant national trademark searches", "No live mark in a related class", "A live mark that matches or nearly matches"],
            ["Blocklists and email", "Safe Browsing status and common spam blocklists", "Not listed", "Listed: email and browser warnings may follow you"],
            ["Registration data", "ICANN Lookup (RDAP): status, registrar, dates", "Status matches the auction stage", "Status that contradicts the listing"],
            ["Total cost", "Auction rules page", "Bid plus renewal under your maximum", "Fees you had not counted"],
          ],
        },
      },
      {
        heading: "Why this matters for SEO buyers",
        paragraphs: [
          "Since March 2024 Google's spam policies name expired domain abuse: buying an expired domain and repurposing it mainly to manipulate rankings with content of little value. Google's examples include affiliate content on a former government site and casino content on a former school site. Buying an expired domain is not itself a violation; using it as a ranking shortcut for unrelated content is.",
          "Google's John Mueller has said that a short period of bad history usually settles down over time, but a long history of abuse may mean it is better to start over with a different domain.",
        ],
      },
    ],
    checklist: [
      "Wayback Machine: view at least one snapshot per year of the domain's life.",
      "Read the top 20 linking pages, not just a metric score.",
      "Search the name on the trademark database of each market you will sell in.",
      "Check RDAP status and registrar to confirm the auction stage.",
      "Write down the total cost (bid plus renewal plus any transfer fee) before bidding.",
    ],
    whenNot: [
      "Skip the deep backlink audit if you only want the name as a brand and do not care about its search history, but still check trademark and blocklists.",
      "Do not bid if any check is a hard fail (trademark match, long spam history, blocklisted) no matter how cheap the name is.",
    ],
    mistakes: [
      "Relying on a single third-party authority score instead of looking at the actual links and archive.",
      "Checking only the homepage snapshot and missing years of spam on inner pages.",
      "Skipping trademark checks on a name that sounds generic.",
      "Assuming a domain is clean because the current site is a parking page.",
    ],
    nextStep:
      "Open the Wayback Machine for the domain and step through one snapshot per year. If the history is clean and relevant, continue with the backlink, trademark and blocklist checks above; if not, drop the name now.",
    faqs: [
      {
        q: "What is the single most important check?",
        a: "The archive history. It shows quickly whether the domain hosted spam, adult, gambling or unrelated content, which is the most common reason an expired domain is a bad buy.",
      },
      {
        q: "Can Google penalize a domain because of its past owner?",
        a: "Google's documented concern is how a domain is used now: its expired domain abuse policy targets repurposing an expired domain mainly to manipulate rankings. Separately, John Mueller has said a short bad history tends to settle over time, while a long one may justify starting over.",
      },
      {
        q: "Do I need paid SEO tools?",
        a: "Not for a first pass. The Wayback Machine, a site: search, ICANN Lookup and a trademark database are free. Paid backlink tools help if you are buying for the domain's links.",
      },
    ],
    sources: ["wayback", "googleSpam", "googleMarch2024", "muellerHistory", "icannLookup", "uspto"],
    related: ["do-expired-domains-keep-their-backlinks", "how-to-estimate-a-fair-bid-for-an-expired-domain", "expired-domain-vs-new-domain"],
  },
  {
    slug: "do-expired-domains-keep-their-backlinks",
    question: "Do expired domains keep their backlinks?",
    title: "Do Expired Domains Keep Their Backlinks? What Survives and What Doesn't",
    description:
      "Links on other sites keep pointing to an expired domain until those sites remove them, but whether they still help you is not guaranteed. What survives, what decays, and how to judge links before you bid.",
    answer: [
      "Yes, the links themselves usually stay: they live on other people's websites and keep pointing to the domain until those sites edit or remove them. Whether those links still help your rankings is a separate question that Google does not answer publicly, and Google's spam policies treat reusing an expired domain mainly to exploit its past reputation as abuse.",
      "Treat backlinks as a bonus for a domain you would want anyway, not as the reason to buy it.",
    ],
    sections: [
      {
        heading: "What survives and what doesn't",
        table: {
          headers: ["Item", "Usually survives?", "Notes"],
          rows: [
            ["The link on the other site", "Yes, until that site changes it", "Some site owners remove or update links when a domain goes dead or changes topic"],
            ["Links to inner pages", "The link stays, but the page is gone", "Links to URLs that now return 404 send visitors and crawlers to an error page unless you rebuild or redirect them"],
            ["Referral traffic", "Partly", "Real visitors still click links on pages that still get traffic"],
            ["Ranking value", "Not guaranteed", "Google does not publish how it treats links to a domain that changed hands or changed topic"],
            ["Creation date", "Only if sold before deletion", "A registrar auction keeps the original creation date; a name caught after it drops is a new registration"],
          ],
        },
      },
    ],
    checklist: [
      "Are the linking sites still live and still showing the link?",
      "Are the linking pages topically related to what you will publish?",
      "Do the links point to the homepage or to inner pages you can realistically rebuild?",
      "Is the anchor text natural (brand name, URL, descriptive) rather than commercial or foreign-language spam?",
      "Would you still want this domain if the links were worth nothing?",
    ],
    whenNot: [
      "Do not buy an expired domain for its links if you plan to publish unrelated content on it. That is the pattern Google's expired domain abuse policy describes.",
      "Do not pay a premium for link metrics alone; the metrics come from third-party tools, not from Google.",
      "Do not redirect an unrelated expired domain to your site hoping to pass its links. It mixes the problems of both.",
    ],
    mistakes: [
      "Counting links from pages that have since been deleted.",
      "Trusting a single authority metric without reading the linking pages.",
      "Leaving old inner URLs returning 404 when relevant replacements could be rebuilt or redirected.",
      "Assuming the old site's rankings will return once the domain is back online.",
    ],
    nextStep:
      "Export the domain's top linking pages, open the 20 strongest, and mark each as live, relevant and natural. Only count links that pass all three when deciding what the domain is worth to you.",
    faqs: [
      {
        q: "How long do backlinks last after a domain expires?",
        a: "There is no fixed period. The link stays until the linking site edits its page. Some remove dead links quickly, others never do.",
      },
      {
        q: "Will Google count the old backlinks for my new site?",
        a: "Google does not say. What it does document is that repurposing an expired domain mainly to manipulate rankings with low-value content violates its spam policies, so plan for the links to be worth little unless your site continues the domain's original topic.",
      },
      {
        q: "Should I 301 redirect old URLs?",
        a: "Redirect old URLs only to pages that genuinely replace them. Pointing everything to your homepage, or to unrelated content, does not recreate what those links were linking to.",
      },
    ],
    sources: ["googleSpam", "googleMarch2024", "muellerHistory", "namesiloFaq", "wayback"],
    related: ["how-to-check-an-expired-domain-before-bidding", "expired-domain-vs-new-domain", "how-to-estimate-a-fair-bid-for-an-expired-domain"],
  },
  {
    slug: "should-i-bid-on-a-domain-with-low-bid-count",
    question: "Should I bid on a domain with a low bid count?",
    title: "Should I Bid on a Domain With a Low Bid Count? A Decision Guide",
    description:
      "A low bid count is normal for expired-domain auctions and is not a warning sign by itself. See bid counts across the NameSilo expired-domain auctions in our latest data, then use a short checklist to decide whether a quiet auction is a bargain or a pass.",
    answer: [
      "Yes, if the domain passes your own checks and fits a real use. A low bid count is normal in expired-domain auctions, where most names get no bids at all, so it tells you little about quality by itself. What it does tell you is that you are unlikely to face a bidding war, so bid what the name is worth to you and no more.",
      "The risk is not the bid count; it is buying a name nobody wants for a good reason, such as spam history or a trademark problem.",
    ],
    dataSection: "bid-count",
    sections: [
      {
        heading: "Low bid count: what it can mean",
        table: {
          headers: ["Reason nobody is bidding", "How to tell", "Bid?"],
          rows: [
            ["The name is ordinary and abundant", "Long, hyphenated, made-up or hard to spell", "Only if it fits your own project, and only near the minimum"],
            ["The name has a problem others found", "Spam history in the archive, trademark match, blocklisting", "No"],
            ["It is early in the auction", "Days remain; most bidding on many platforms happens near the end", "Set a maximum now or watch it"],
            ["It is a niche name few people are looking for", "Clear meaning, clean history, fits your use", "Yes, this is the bargain case"],
            ["The owner might still renew", "Auction is still inside the renewal window", "Bid, but expect possible cancellation"],
          ],
        },
      },
    ],
    checklist: [
      "Would you use this name, or sell it to a specific type of buyer you can name?",
      "Does it pass the archive, trademark and blocklist checks?",
      "Is the total (bid plus renewal) less than the cost of the next-best alternative, including hand-registering a different name?",
      "Is there time left in the auction for others to enter? Decide your maximum accordingly.",
    ],
    whenNot: [
      "You are buying only because it is cheap. Renewals recur every year, and a portfolio of unused cheap names adds up.",
      "The low bid count follows something another buyer would have spotted, like a trademark or spam history.",
      "You plan to resell but cannot name who would buy it.",
    ],
    mistakes: [
      "Reading a low bid count as proof of hidden value, or as proof of hidden problems. It is neither.",
      "Bidding early with a high maximum, which can attract attention without benefit.",
      "Forgetting that renewal costs often exceed the purchase price of a minimum-bid domain within a year or two.",
    ],
    nextStep:
      "Run the domain through the before-bidding checklist, then set a single maximum equal to what you would pay for the next-best alternative minus the renewal, and enter it once.",
    faqs: [
      {
        q: "Is a domain with zero bids a bad domain?",
        a: "Not necessarily. In the NameSilo auction data on this page, the large majority of auctions had no bids, so zero bids is the default state, not a warning sign. Judge the name on its history, fit and trademark risk instead.",
      },
      {
        q: "Will bidding early drive the price up?",
        a: "It can make the auction visible to other watchers on platforms that show bid counts. With proxy bidding, an early maximum bid is not revealed, but the current price and bid count are.",
      },
      {
        q: "What should I bid on a no-bid domain?",
        a: "If it fits your use and passes your checks, the minimum or close to it is usually reasonable. Set your maximum at what the name is worth to you, not at what others might pay.",
      },
    ],
    sources: ["namesiloFaq", "godaddyTimeline", "wayback", "uspto"],
    related: ["how-to-estimate-a-fair-bid-for-an-expired-domain", "how-to-check-an-expired-domain-before-bidding", "how-do-expired-domain-auctions-work"],
  },
  {
    slug: "what-is-a-reserve-price-in-a-domain-auction",
    question: "What is a reserve price in a domain auction?",
    title: "What Is a Reserve Price in a Domain Auction? Reserve vs. No-Reserve",
    description:
      "A reserve price is the seller's minimum: if bidding ends below it, the domain does not sell. How reserves work, how they differ from starting bids and registrar expired auctions, and how to bid on a reserve auction.",
    answer: [
      "A reserve price is the minimum amount a seller will accept in an auction. If the highest bid at the end is below the reserve, the seller does not have to sell, and the auction ends without a sale. Reserves are usually hidden; you typically see only whether the reserve has been met.",
      "Reserves are common in seller-listed aftermarket auctions. Registrar expired-domain auctions are different: the registrar sets the starting bid, and some, like NameSilo, set a maximum bid instead.",
    ],
    sections: [
      {
        heading: "Reserve price vs. related terms",
        table: {
          headers: ["Term", "Who sets it", "Visible?", "Effect"],
          rows: [
            ["Reserve price", "Seller", "Usually hidden; status shows met or not met", "No sale if bidding ends below it"],
            ["Starting (minimum) bid", "Seller or platform", "Yes", "Lowest allowed first bid"],
            ["No-reserve auction", "Seller", "Yes", "Sells to the highest bidder at any price"],
            ["Maximum bid (NameSilo expired auctions)", "Platform", "Yes", "A bid at the maximum cannot be outbid; it is a ceiling, not a floor"],
            ["Your proxy maximum", "You", "Hidden from others", "System bids for you up to this amount"],
          ],
        },
      },
      {
        heading: "How reserve auctions play out",
        list: [
          "Bidding below the reserve is allowed, but a winning bid below it does not create a sale.",
          "Sellers sometimes negotiate with the top bidder after a reserve is not met. Whether the platform allows this varies.",
          "Sedo's marketplace agreement, for example, asks sellers to set a reasonable minimum price at which they will sell at auction, which it calls the reserve price.",
        ],
      },
    ],
    checklist: [
      "Is the auction reserve, no-reserve, or a registrar expired-domain auction? The listing should say.",
      "If reserve not met, decide whether you are willing to bid to the point of meeting it at all.",
      "Set your maximum from your own valuation, not from guesses about the hidden reserve.",
      "Read the platform's rule on what happens after a reserve is not met.",
    ],
    whenNot: [
      "Do not chase the reserve just to find out what it is; you may end up committed above your value.",
      "Avoid reserve auctions entirely if you need a guaranteed outcome by a deadline. Buy-now listings are clearer.",
    ],
    mistakes: [
      "Confusing a starting bid with a reserve.",
      "Assuming a high bid count means the reserve will be met.",
      "Raising your bid at the end only to see 'reserve met' without considering whether the price is still sensible.",
    ],
    nextStep:
      "Before bidding, write down your own maximum. If the auction ends below the reserve and the platform lets you contact the seller, make one offer at or below that number.",
    faqs: [
      {
        q: "Can I see the reserve price?",
        a: "Usually not. Most platforms show only whether the reserve has been met. Some sellers disclose it voluntarily.",
      },
      {
        q: "Do expired-domain auctions have reserves?",
        a: "Registrar expired-domain auctions are run by the registrar rather than a seller, so they generally use a published starting bid. NameSilo's expired auctions use a maximum bid that caps the price instead.",
      },
      {
        q: "What happens if the reserve is not met?",
        a: "The domain does not sell through the auction. Depending on the platform, the seller may relist it, set a buy-now price, or negotiate with the high bidder.",
      },
    ],
    sources: ["sedoAgreement", "namesiloFaq", "godaddyTypes"],
    related: ["how-do-expired-domain-auctions-work", "how-to-estimate-a-fair-bid-for-an-expired-domain", "should-i-bid-on-a-domain-with-low-bid-count"],
  },
  {
    slug: "expired-domain-vs-new-domain",
    question: "Should you use an expired domain or a new domain for a new website?",
    title: "Expired Domain vs. New Domain for a New Website: Which Should You Choose?",
    description:
      "For most new websites a new domain is the safer default. Compare cost, risk, branding and SEO for expired vs. new domains, and see the specific cases where an expired domain is worth it.",
    answer: [
      "For most new websites, register a new domain: it is cheaper, has no unknown history, and lets you pick the exact brand you want. Choose an expired domain when the name itself is clearly better than anything you can register, or when the old site was in the same topic as yours and you will continue serving that audience.",
      "Do not choose an expired domain only for its backlinks or past rankings; Google does not guarantee those carry over, and using one mainly as a ranking shortcut is against its spam policies.",
    ],
    sections: [
      {
        heading: "Side-by-side comparison",
        table: {
          headers: ["Factor", "Expired domain", "New domain"],
          rows: [
            ["Upfront cost", "Auction price plus renewal; competitive names can be expensive", "Standard registration fee"],
            ["History risk", "Possible spam, penalties, blocklisting, or trademark disputes", "None"],
            ["Brand choice", "Limited to what is available at auction", "Any available name"],
            ["Existing links and traffic", "Possibly, if the old site was real and relevant", "None; you build from zero"],
            ["Search value", "Not guaranteed; depends on relevance and how you use it", "Depends entirely on what you publish"],
            ["Time to acquire", "Days to weeks (auction end, payment, transfer)", "Minutes"],
            ["Due diligence needed", "Archive, backlinks, trademark, blocklists", "Trademark check"],
          ],
        },
      },
    ],
    checklist: [
      "Is the expired name clearly better (shorter, clearer, more memorable) than your best new option?",
      "Was the old site in your topic, and will you serve the same kind of visitor?",
      "Did it pass archive, backlink, trademark and blocklist checks?",
      "Is the total cost justified even if the links turn out to be worth nothing?",
    ],
    whenNot: [
      "You plan to publish content unrelated to the domain's past. That is the pattern Google calls expired domain abuse.",
      "You need to launch immediately and the auction will not close for days.",
      "The best expired option is only marginally better than a name you can register today.",
    ],
    mistakes: [
      "Paying a premium for third-party authority metrics.",
      "Skipping due diligence because the domain looks clean on its current parking page.",
      "Choosing a worse brand name for its backlinks.",
      "Expecting the old site's traffic to return without rebuilding the content that earned it.",
    ],
    nextStep:
      "List your top three new-domain options and your best expired-domain option. If the expired name does not clearly beat all three on brand and relevance, register the new domain.",
    faqs: [
      {
        q: "Do expired domains rank faster?",
        a: "Sometimes a relevant expired domain with real links gets crawled and noticed sooner, but Google does not guarantee any carry-over, and the outcome depends mostly on what you publish.",
      },
      {
        q: "Is it against Google's rules to buy an expired domain?",
        a: "No. Google's policy targets expired domain abuse: repurposing an expired domain primarily to manipulate rankings with low-value content. Continuing a relevant, useful site on a bought domain is not what the policy describes.",
      },
      {
        q: "Does an expired domain keep its age?",
        a: "If you buy it in a registrar auction before deletion, the original creation date usually stays (NameSilo confirms this for its auctions). If it is deleted and re-registered, it starts with a new creation date.",
      },
    ],
    sources: ["googleSpam", "googleMarch2024", "muellerHistory", "namesiloFaq"],
    related: ["do-expired-domains-keep-their-backlinks", "how-to-check-an-expired-domain-before-bidding", "how-to-estimate-a-fair-bid-for-an-expired-domain"],
  },
  {
    slug: "how-to-estimate-a-fair-bid-for-an-expired-domain",
    question: "How do you estimate a fair bid for an expired domain?",
    title: "How to Estimate a Fair Bid for an Expired Domain: A Simple Formula",
    description:
      "Set your maximum bid from the cheaper of two numbers: what the domain is worth to you, and what comparable names actually sold for. A step-by-step method, opening bids from NameSilo's current auctions, and the costs most bidders forget.",
    answer: [
      "Set your maximum bid at the lower of two numbers: what the domain is worth to you compared with your next-best option, and what comparable domains have actually sold for. Then subtract the renewal and any fees, because the bid is not the whole cost.",
      "Decide this number before the auction ends and do not raise it in the final minutes.",
    ],
    dataSection: "opening-bids",
    sections: [
      {
        heading: "The method",
        ordered: [
          "Value to you: what would you pay for the next-best alternative? That might be a different expired name, a buy-now listing, or the cost of hand-registering a new name and building the brand from scratch.",
          "Market check: look up actual sold prices (not asking prices) for names with a similar length, structure, keyword and extension. Asking prices and automated appraisals tend to run high.",
          "Adjust for history: subtract value for any yellow flags from the before-bidding checks. A hard fail (trademark, long spam history) means zero.",
          "Subtract costs: renewal (NameSilo, for example, charges the bid plus a 1-year renewal), any buyer or transfer fees, and what you will spend restoring content or redirects.",
          "Your maximum = the lower of steps 1 and 2, after steps 3 and 4.",
        ],
      },
      {
        heading: "Worked example (illustrative numbers)",
        table: {
          headers: ["Step", "Amount"],
          rows: [
            ["Value to you vs. next-best option", "$300"],
            ["Comparable sold prices (wholesale end)", "$180"],
            ["Lower of the two", "$180"],
            ["Minus renewal and fees", "-$15"],
            ["Maximum bid", "$165"],
          ],
        },
        paragraphs: ["The numbers above are an example of the calculation, not market prices."],
      },
    ],
    checklist: [
      "Do you have at least three comparable sold prices, not asking prices?",
      "Have you named a specific next-best alternative?",
      "Have you included renewal and fees?",
      "Did the domain pass the archive and trademark checks?",
    ],
    whenNot: [
      "Do not set your bid from an automated appraisal alone.",
      "Do not anchor on the current bid; it reflects other bidders, not value.",
      "Do not bid if you cannot name either a use or a buyer for the domain.",
    ],
    mistakes: [
      "Using asking prices as comparables.",
      "Forgetting renewal costs, which recur every year.",
      "Raising the maximum during a late-bid extension.",
      "Paying a premium for third-party SEO metrics without checking the links behind them.",
    ],
    nextStep:
      "Fill in the five-step method for one domain you are watching, write the resulting maximum in your notes, and enter it as your proxy bid once.",
    faqs: [
      {
        q: "Are automated domain appraisals accurate?",
        a: "Treat them as a rough starting point. They are not sales, and they often run above what names actually sell for at auction.",
      },
      {
        q: "Should I bid the minimum?",
        a: "On many expired-domain auctions the minimum is where most names stay. If the name fits your use and passes your checks, bidding your real maximum once is better than inching up.",
      },
      {
        q: "What extra costs should I include?",
        a: "Renewal (often charged with the win), any buyer or transfer fees on the platform, and the cost of rebuilding or redirecting content if you want the old links to land somewhere useful.",
      },
    ],
    sources: ["namesiloFaq", "godaddyTimeline", "googleSpam"],
    related: ["should-i-bid-on-a-domain-with-low-bid-count", "what-is-a-reserve-price-in-a-domain-auction", "how-to-check-an-expired-domain-before-bidding"],
  },
];

function getGuide(slug) {
  return GUIDES.find((guide) => guide.slug === slug) || null;
}

function listGuideSlugs() {
  return GUIDES.map((guide) => guide.slug);
}

module.exports = {
  GUIDES,
  SOURCES,
  PUBLISHED,
  MODIFIED,
  getGuide,
  listGuideSlugs,
};
