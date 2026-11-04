const { SITE_NAME, escapeHtml } = require("./site-identity");

const WORDMARK_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', system-ui, sans-serif";


// Width estimated from the name length (static HTML cannot measure text).
const WORDMARK_VIEW_WIDTH = Math.ceil(SITE_NAME.length * 9.2 + 4);

const SNATCH_WORDMARK_SVG_HTML = `<svg class="snatchLogoMark" viewBox="0 0 ${WORDMARK_VIEW_WIDTH} 18" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(SITE_NAME)}">
      <title>${escapeHtml(SITE_NAME)}</title>
      <text x="0" y="13.6" fill="currentColor" font-family="${WORDMARK_FONT}" font-size="16.25" font-weight="800" letter-spacing="-0.052em">${escapeHtml(SITE_NAME)}</text>
    </svg>`;

// Standalone logo file for schema.org Organization.logo and og images.
function renderSiteLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORDMARK_VIEW_WIDTH} 18" role="img" aria-label="${escapeHtml(SITE_NAME)}">
  <title>${escapeHtml(SITE_NAME)}</title>
  <text x="0" y="13.6" fill="#07101f" font-family="${WORDMARK_FONT}" font-size="16.25" font-weight="800" letter-spacing="-0.052em">${escapeHtml(SITE_NAME)}</text>
</svg>
`;
}

function renderSnatchLogoAnchor(href = "/") {
  return `<a href="${href}" class="snatchLogo snatchBrand site-logo" aria-label="${escapeHtml(SITE_NAME)} home">${SNATCH_WORDMARK_SVG_HTML}</a>`;
}

module.exports = {
  renderSnatchLogoAnchor,
  renderSiteLogoSvg,
  SNATCH_WORDMARK_SVG_HTML,
};
