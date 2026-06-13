#!/usr/bin/env node
const path = require("path");

const slug = process.argv[2];
if (!slug) {
  process.stderr.write("Usage: node scripts/promote-candidate.js <slug>\n");
  process.stderr.write("Example: node scripts/promote-candidate.js anudesk-com\n");
  process.exit(1);
}

const { configureDefaultProductStore } = require(path.join(
  __dirname,
  "..",
  "server",
  "candidate-store",
  "store-paths"
));
const { promoteCandidate, getDurableCandidateBySlug } = require(path.join(
  __dirname,
  "..",
  "server",
  "candidate-store",
  "durable-candidates"
));

configureDefaultProductStore();

try {
  const promoted = promoteCandidate(slug);
  process.stdout.write(`Promoted ${promoted.domain} (${promoted.slug})\n`);
  process.stdout.write(`Canonical: ${promoted.canonicalUrl}\n`);
  process.stdout.write(`Published at: ${promoted.publishedAt}\n`);
  const refreshed = getDurableCandidateBySlug(slug);
  if (!refreshed?.published) {
    process.stderr.write("Warning: durable record did not persist published flag.\n");
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
