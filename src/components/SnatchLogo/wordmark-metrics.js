export const WORDMARK_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', system-ui, sans-serif";

export const WORDMARK_FONT_SIZE = 16.25;
export const WORDMARK_BASELINE_Y = 13.6;
/** Matches typographic period weight (~0.09em radius at 800 weight). */
export const WORDMARK_PERIOD_RADIUS = 1.45;
export const WORDMARK_PERIOD_GAP = 0.75;
export const WORDMARK_VIEWBOX_HEIGHT = 18;
/** Horizontal spacing between thinking dots (em). */
export const WORDMARK_PERIOD_SPREAD = 0.24;

/** Fallback anchor when getBBox is unavailable (static HTML). */
export const WORDMARK_PERIOD_ANCHOR_X = 56.2;
export const WORDMARK_PERIOD_ANCHOR_Y = 12.3;
export const WORDMARK_FALLBACK_VIEW_WIDTH = 66;

export function computeWordmarkLayout(textEndX) {
  const anchorX = textEndX + WORDMARK_PERIOD_GAP + WORDMARK_PERIOD_RADIUS;
  const anchorY = WORDMARK_BASELINE_Y - WORDMARK_PERIOD_RADIUS + 0.12;
  const spreadUnits = WORDMARK_PERIOD_SPREAD * WORDMARK_FONT_SIZE * 2;
  const viewWidth = Math.ceil(anchorX + WORDMARK_PERIOD_RADIUS + spreadUnits + 1.5);
  return { anchorX, anchorY, viewWidth };
}
