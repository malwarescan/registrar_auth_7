function tokenize(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function inferPreferredTlds(intentFlags, constraints) {
  if (Array.isArray(constraints?.preferredTlds) && constraints.preferredTlds.length) {
    return constraints.preferredTlds.map((tld) => String(tld).toLowerCase());
  }
  if (intentFlags.isAi) return [".com", ".ai", ".io"];
  if (intentFlags.isCyber) return [".com", ".net", ".io"];
  if (intentFlags.isLuxury) return [".com", ".co"];
  if (intentFlags.isLocalFood) return [".com", ".net", ".co"];
  return [".com", ".net", ".co", ".io", ".ai"];
}

function parseLocation(tokens) {
  if (tokens.includes("brooklyn")) return "Brooklyn, New York";
  if (tokens.includes("orange") && tokens.includes("county")) return "Orange County";
  if (tokens.includes("florida")) return "Florida, United States";
  if (tokens.includes("nyc")) return "New York City, New York";
  if (tokens.includes("bogota")) return "Bogota, Colombia";
  return undefined;
}

function interpretBrief(brief, constraints = {}) {
  const tokens = tokenize(brief);
  const isLocalFood = tokens.some((t) => ["pizza", "slice", "delivery", "restaurant"].includes(t));
  const isCyber = tokens.some((t) => ["cyber", "security", "threat", "breach", "defense"].includes(t));
  const isAi = tokens.some((t) => ["ai", "agent", "assistant", "automation", "copilot"].includes(t));
  const isLuxury = tokens.some((t) => ["emerald", "jewelry", "jewellery", "luxury", "gem", "muzo"].includes(t));
  const isLocalDental = tokens.some((t) => ["dentist", "dental", "orthodontist", "orthodontic", "clinic", "smile"].includes(t));
  const isLocalService = tokens.some((t) =>
    ["plumber", "plumbing", "roofing", "hvac", "electrician", "cleaning", "landscaping", "contractor", "dentist", "dental"].includes(t)
  );

  let businessType = "digital business";
  let productCategory = "General";
  let targetBuyer = ["business buyers"];
  let desiredTone = ["clear", "trustworthy", "memorable"];
  let requiredConcepts = tokens.slice(0, 6);
  let adjacentConcepts = [];
  let excludedConcepts = ["gibberish", "random-strings", "unrelated-cities"];

  if (isLocalDental) {
    businessType = "local dental practice";
    productCategory = "Local healthcare";
    targetBuyer = ["local patients", "family dental patients", "cosmetic dentistry patients"];
    desiredTone = ["trustworthy", "professional", "local", "clean", "friendly"];
    requiredConcepts = ["dentist", "dental", "clinic", "smile", "orangecounty", "oc"];
    adjacentConcepts = ["care", "family", "tooth", "teeth", "oral", "local", "book"];
  } else if (isLocalFood) {
    businessType = "local pizza delivery";
    productCategory = "Food delivery";
    targetBuyer = ["local delivery customers", "neighborhood residents", "restaurant customers"];
    desiredTone = ["local", "fast", "appetizing", "trustworthy", "memorable"];
    requiredConcepts = ["pizza", "slice", "pie", "delivery", "local", "brooklyn", "bk"];
    adjacentConcepts = ["oven", "crust", "door", "now", "fast", "neighborhood"];
  } else if (isLuxury) {
    businessType = "luxury jewelry brand";
    productCategory = "Luxury jewelry";
    targetBuyer = ["luxury jewelry buyers", "collectors", "emerald customers"];
    desiredTone = ["premium", "heritage", "rare", "trustworthy", "collectible"];
    requiredConcepts = ["emerald", "gemstone", "jewel", "atelier", "maison", "colombian", "muzo"];
    adjacentConcepts = ["vault", "reserve", "collection", "heirloom", "gallery", "andes"];
  } else if (isCyber) {
    businessType = "cybersecurity software";
    productCategory = "Cybersecurity";
    targetBuyer = ["security teams", "SOC analysts", "enterprise buyers"];
    desiredTone = ["defensive", "credible", "technical", "trusted"];
    requiredConcepts = ["cyber", "security", "threat", "defense", "monitor"];
    adjacentConcepts = ["watch", "shield", "intel", "radar", "secure"];
  } else if (isAi) {
    businessType = "ai software";
    productCategory = "AI product";
    targetBuyer = ["operations teams", "small business owners", "automation buyers"];
    desiredTone = ["modern", "practical", "professional", "trustworthy"];
    requiredConcepts = ["ai", "agent", "assistant", "automation", "desk"];
    adjacentConcepts = ["copilot", "ops", "workflow", "smart", "voice"];
  } else if (isLocalService) {
    businessType = "local service business";
    productCategory = "Local services";
    targetBuyer = ["local residents", "homeowners", "neighborhood customers"];
    desiredTone = ["trustworthy", "local", "clear", "practical"];
    requiredConcepts = tokens.filter((t) => t.length >= 3).slice(0, 6);
    adjacentConcepts = ["local", "service", "care", "trusted", "home"];
  }

  const intentFlags = { isLocalFood, isCyber, isAi, isLuxury };
  const location = parseLocation(tokens);
  const preferredTlds = inferPreferredTlds(intentFlags, constraints);

  return {
    businessType,
    productCategory,
    location,
    targetBuyer,
    desiredTone,
    preferredTlds,
    budget: constraints?.maxBudget,
    requiredConcepts: [...new Set(requiredConcepts)],
    adjacentConcepts: [...new Set(adjacentConcepts)],
    excludedConcepts,
  };
}

function buildStrategy(brief, intentModel) {
  return {
    primaryIntent: intentModel.businessType,
    buyer: intentModel.targetBuyer[0] || "buyers",
    category: intentModel.productCategory,
    location: intentModel.location,
    namingConcepts: [...intentModel.requiredConcepts, ...intentModel.adjacentConcepts].slice(0, 12),
  };
}

module.exports = {
  tokenize,
  interpretBrief,
  buildStrategy,
};
