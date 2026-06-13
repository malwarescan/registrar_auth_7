const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const appCss = fs.readFileSync(path.join(ROOT, "assets/app.css"), "utf8");
const homeCss = fs.readFileSync(path.join(ROOT, "src/IntentFetchPage.css"), "utf8");
const homeJsx = fs.readFileSync(path.join(ROOT, "src/IntentFetchPage.jsx"), "utf8");
const detailPageJs = fs.readFileSync(path.join(ROOT, "server/candidate-detail-page.js"), "utf8");

function extractCandidatePageTemplate() {
  const fnStart = detailPageJs.indexOf("function renderCandidatePageHtml");
  assert.ok(fnStart >= 0, "renderCandidatePageHtml exists");
  const returnStart = detailPageJs.indexOf("return `<!DOCTYPE html>", fnStart);
  const returnEnd = detailPageJs.indexOf("</html>`;", returnStart);
  assert.ok(returnStart >= 0 && returnEnd > returnStart, "candidate page template exists");
  return detailPageJs.slice(returnStart, returnEnd + "</html>`;".length);
}

const candidateTemplate = extractCandidatePageTemplate();

test("detail page container and header lock", () => {
  assert.match(appCss, /DOMAIN DETAIL PAGE LOCK — DO NOT MODIFY/);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.domainPageMain[\s\S]*?max-width:\s*1120px[\s\S]*?margin:\s*0 auto/s
  );
  assert.match(appCss, /--detail-content-max:\s*1120px/);
  assert.match(appCss, /--detail-page-gutter:\s*32px/);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.site-header[\s\S]*?height:\s*var\(--detail-header-h\)/s
  );
  assert.match(appCss, /--detail-header-h:\s*clamp\(96px,\s*10vh,\s*120px\)/);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.site-header[\s\S]*?place-items:\s*center/s
  );
  assert.match(
    appCss,
    /body\.candidate-detail-page \.site-logo[\s\S]*?width:\s*200px[\s\S]*?max-width:\s*220px[\s\S]*?overflow:\s*visible/s
  );
});

test("detail page evidence card system lock", () => {
  assert.match(appCss, /\.evidenceList[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(
    appCss,
    /\.evidenceItem[\s\S]*?padding:\s*18px 18px 18px 16px[\s\S]*?border-radius:\s*18px/s
  );
  assert.match(appCss, /\.evidenceMark[\s\S]*?border-radius:\s*999px/s);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.domainPageMain[\s\S]*?padding:\s*0 var\(--detail-page-gutter\) 64px/s
  );
  assert.match(appCss, /--detail-section-gap:\s*32px/);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.productEvidence > \.detailContent[\s\S]*?gap:\s*var\(--detail-section-gap\)/s
  );
});

test("detail page CTA and alternatives layout lock", () => {
  assert.match(appCss, /\.productActionBlock[\s\S]*?display:\s*flex[\s\S]*?gap:\s*12px/s);
  assert.match(
    appCss,
    /\.productPrimaryCta[\s\S]*?max-width:\s*420px[\s\S]*?height:\s*64px[\s\S]*?border-radius:\s*18px/s
  );
  assert.match(
    appCss,
    /\.alternativesList[\s\S]*?border:\s*1px solid rgba\(190,\s*205,\s*230,\s*0\.68\)[\s\S]*?border-radius:\s*20px/s
  );
  assert.match(appCss, /\.domainPage \.alternativeRow[\s\S]*?padding:\s*22px 24px/s);
  assert.match(
    appCss,
    /body\.candidate-detail-page \.domainPageMain \.snatchRail[\s\S]*?margin:\s*0[\s\S]*?padding:\s*0/s
  );
});

test("detail candidate template avoids snatchRail offsets", () => {
  assert.match(candidateTemplate, /class="domainPageMain"/);
  assert.match(candidateTemplate, /class="productHeroStage"/);
  assert.match(candidateTemplate, /class="detailContent"/);
  assert.match(candidateTemplate, /class="productEvidence"/);
  assert.match(candidateTemplate, /class="productActionBlock"/);
  assert.match(candidateTemplate, /class="productAlternativesBlock"/);
  assert.match(candidateTemplate, /alternativesHtml/);
  assert.match(candidateTemplate, /summaryStripHtml/);
  assert.match(candidateTemplate, /decisionCardHtml/);
  assert.match(candidateTemplate, /evidenceList--report/);
  assert.doesNotMatch(candidateTemplate, /productHeroStage[\s\S]*?snatchRail/);
  assert.doesNotMatch(candidateTemplate, /productEvidence[\s\S]*?snatchRail/);
});

test("detail page mobile stack lock avoids horizontal overflow patterns", () => {
  assert.match(
    appCss,
    /@media \(max-width: 900px\)[\s\S]*?body\.candidate-detail-page[\s\S]*?--detail-page-gutter:\s*24px/s
  );
  assert.match(
    appCss,
    /@media \(max-width: 900px\)[\s\S]*?\.evidenceList[\s\S]*?grid-template-columns:\s*1fr/s
  );
  assert.match(
    appCss,
    /@media \(max-width: 900px\)[\s\S]*?body\.candidate-detail-page \.domainPageMain[\s\S]*?padding:\s*0 var\(--detail-page-gutter\) 56px/s
  );
  assert.match(
    appCss,
    /@media \(max-width: 900px\)[\s\S]*?\.domainPage \.alternativeRow[\s\S]*?padding:\s*18px 16px/s
  );
});

test("homepage intent fetch lock remains isolated from detail page css", () => {
  assert.match(homeCss, /VIEWPORT CENTERLINE LOCK — DO NOT MODIFY/);
  assert.match(homeCss, /HERO POLISH LOCK — DO NOT MODIFY/);
  assert.match(homeCss, /HERO STACK LOCK — DO NOT MODIFY/);
  assert.doesNotMatch(homeCss, /DOMAIN DETAIL PAGE LOCK/);
  assert.doesNotMatch(homeCss, /productHeroStage/);
  assert.doesNotMatch(homeCss, /productAlternativesBlock/);
  assert.doesNotMatch(homeJsx, /domainPageMain/);
  assert.doesNotMatch(homeJsx, /productEvidence/);
});

test("layout freeze systems remain isolated across homepage and detail page", () => {
  assert.match(appCss, /DOMAIN DETAIL PAGE LOCK — DO NOT MODIFY/);
  assert.doesNotMatch(appCss, /HERO STACK LOCK — DO NOT MODIFY/);
  assert.doesNotMatch(appCss, /VIEWPORT CENTERLINE LOCK — DO NOT MODIFY/);
  assert.match(homeCss, /HERO STACK LOCK — DO NOT MODIFY/);
  assert.doesNotMatch(homeCss, /DOMAIN DETAIL PAGE LOCK — DO NOT MODIFY/);
});
