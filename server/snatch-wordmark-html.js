const WORDMARK_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', system-ui, sans-serif";

const WORDMARK_PERIOD_ANCHOR_X = 56.2;
const WORDMARK_PERIOD_ANCHOR_Y = 12.3;
const WORDMARK_PERIOD_RADIUS = 1.45;
const WORDMARK_VIEWBOX = "0 0 66 18";

const SNATCH_WORDMARK_SVG_HTML = `<svg class="snatchLogoMark" viewBox="${WORDMARK_VIEWBOX}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="snatch">
      <title>snatch</title>
      <text x="0" y="13.6" fill="currentColor" font-family="${WORDMARK_FONT}" font-size="16.25" font-weight="800" letter-spacing="-0.052em">snatch</text>
      <g class="snatchLogoPeriodGroup" transform="translate(${WORDMARK_PERIOD_ANCHOR_X} ${WORDMARK_PERIOD_ANCHOR_Y})">
        <circle class="snatchLogoPeriod snatchLogoPeriod--lead" cx="0" cy="0" r="${WORDMARK_PERIOD_RADIUS}" fill="currentColor"></circle>
        <circle class="snatchLogoPeriod snatchLogoPeriod--mid" cx="0" cy="0" r="${WORDMARK_PERIOD_RADIUS}" fill="currentColor"></circle>
        <circle class="snatchLogoPeriod snatchLogoPeriod--trail" cx="0" cy="0" r="${WORDMARK_PERIOD_RADIUS}" fill="currentColor"></circle>
      </g>
    </svg>`;

function renderSnatchLogoAnchor(href = "/experiments/intent-fetch/") {
  return `<a href="${href}" class="snatchLogo snatchBrand site-logo" aria-label="snatch home">${SNATCH_WORDMARK_SVG_HTML}</a>`;
}

module.exports = {
  renderSnatchLogoAnchor,
  SNATCH_WORDMARK_SVG_HTML,
};
