const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "src/IntentFetchPage.css"), "utf8");
const jsx = fs.readFileSync(path.join(ROOT, "src/IntentFetchPage.jsx"), "utf8");

test("intent fetch stacks logo and hero inside hero-wrap", () => {
  const heroWrapBlock = jsx.match(/<section className="hero-wrap">[\s\S]*?<\/section>/);
  assert.ok(heroWrapBlock, "hero-wrap section exists");
  assert.match(heroWrapBlock[0], /className="site-header"/);
  assert.match(heroWrapBlock[0], /className="hero-card heroGlow/);
  assert.doesNotMatch(heroWrapBlock[0], /snatchRail/);
  assert.match(
    jsx,
    /<main className="page intentPage"[\s\S]*?<section className="hero-wrap">\s*<header className="site-header">/
  );
});

test("intent fetch layout lock css preserves brand+hero composition", () => {
  assert.match(css, /--logo-hero-gap:\s*48px/);
  assert.match(css, /--logo-width-idle:\s*390px/);
  assert.match(css, /\.intentPage\[data-state="complete"\] \.hero-wrap[\s\S]*?min-height:\s*auto/);
  assert.match(css, /\.intentPage\[data-state="complete"\] \.hero-wrap[\s\S]*?justify-content:\s*flex-start/);
  assert.match(css, /\.site-logo\s*\{[^}]*max-height:\s*none/s);
  assert.match(css, /\.hero-wrap\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.hero-wrap\s*\{[^}]*gap:\s*var\(--logo-hero-gap\)/s);
  assert.match(css, /\.hero-wrap\s*\{[^}]*width:\s*100vw/s);
  assert.match(css, /\.hero-wrap\s*\{[^}]*min-height:\s*100vh/s);
  assert.match(css, /\.hero-card\s*\{[^}]*width:\s*min\(1240px,\s*calc\(100vw - 220px\)\)/s);
  assert.match(css, /VIEWPORT CENTERLINE LOCK — DO NOT MODIFY/);
});

test("intent fetch hero polish lock preserves venture polish tokens", () => {
  assert.match(css, /HERO POLISH LOCK — DO NOT MODIFY/);
  assert.match(css, /--hero-radius:\s*28px/);
  assert.match(css, /--logo-hero-gap:\s*48px/);
  assert.match(css, /\.heroGlow\.border-glow-card[\s\S]*?0 40px 80px rgba\(7,\s*16,\s*31/s);
  assert.match(jsx, /Describe a startup, niche, or business idea/);
  assert.match(jsx, /AI Receptionist/);
  assert.doesNotMatch(jsx, /Intent-driven domain discovery/);
  assert.doesNotMatch(jsx, /heroOverlay/);
});

test("intent fetch idle hero breathing uses clamped height and vertical padding", () => {
  assert.match(
    css,
    /\.intentPage\[data-state="idle"\][\s\S]*?--hero-shell-h:\s*clamp\(440px,\s*50vh,\s*520px\)/
  );
  assert.match(
    css,
    /\.intentPage\[data-state="idle"\][\s\S]*?--hero-pad-bottom:\s*clamp\(64px,\s*7vw,\s*88px\)/
  );
  assert.match(
    css,
    /\.intentPage\[data-state="idle"\] \.hero-card[\s\S]*?min-height:\s*clamp\(440px,\s*50vh,\s*520px\)/
  );
  assert.match(
    css,
    /\.heroContent[\s\S]*?padding:\s*var\(--hero-pad-top\) var\(--hero-pad-x\) var\(--hero-pad-bottom\)/
  );
});

test("intent fetch layout hard lock selectors target hero-wrap children", () => {
  assert.match(css, /> section\.hero-wrap > header\.site-header/);
  assert.match(css, /> section\.hero-wrap > \.hero-card/);
  assert.doesNotMatch(css, /\.hero-wrap > \.snatchRail/);
});

test("intent fetch hero stack lock preserves internal rhythm and detected overflow", () => {
  assert.match(css, /HERO STACK LOCK — DO NOT MODIFY/);
  assert.match(css, /\.heroStack\s*\{[^}]*gap:\s*22px/s);
  assert.match(css, /\.detectedSlot--active[\s\S]*?min-height:\s*34px/);
  assert.match(
    css,
    /\.intentPage\[data-state="idle"\] \.heroContent[\s\S]*?justify-content:\s*flex-start/
  );
  assert.match(css, /\.commandShell[\s\S]*?z-index:\s*2[\s\S]*?0 18px 42px rgba\(7,\s*16,\s*31,\s*0\.16\)/s);
  assert.match(css, /\.commandInput[\s\S]*?background:\s*transparent[\s\S]*?line-height:\s*1\.25/s);
  assert.match(
    css,
    /\.intentPage\[data-state="complete"\] \.heroContent[\s\S]*?justify-content:\s*center[\s\S]*?align-items:\s*center/s
  );
  assert.match(css, /\.heroContent\.hasDetectedSignals \.heroPromoInner[\s\S]*?overflow:\s*visible/s);
  assert.match(css, /\.heroSuggestions[\s\S]*?margin:\s*auto auto 0/s);
  assert.match(
    css,
    /\.intentPage\[data-state="idle"\] \.intentHero[\s\S]*?height:\s*auto[\s\S]*?min-height:\s*var\(--hero-shell-h\)/
  );
  assert.match(jsx, /hasDetectedSignals/);
  assert.match(jsx, /<form[\s\S]*?className=\{`commandShell[\s\S]*?<\/form>[\s\S]*?heroSuggestions/);
});

test("intent fetch logo lock remains scoped to homepage composition", () => {
  assert.match(css, /--logo-width-idle:\s*390px/);
  assert.match(css, /--logo-width-compact:\s*240px/);
  assert.doesNotMatch(css, /body\.candidate-detail-page/);
  assert.doesNotMatch(css, /DOMAIN DETAIL PAGE LOCK/);
  assert.match(
    fs.readFileSync(path.join(ROOT, "src/components/SnatchLogo/SnatchWordmark.jsx"), "utf8"),
    /snatchLogoPeriodGroup/
  );
  assert.match(
    fs.readFileSync(path.join(ROOT, "src/components/SnatchLogo/SnatchWordmark.jsx"), "utf8"),
    /getBBox/
  );
});
