import { useLayoutEffect, useRef, useState } from "react";
import {
  WORDMARK_BASELINE_Y,
  WORDMARK_FALLBACK_VIEW_WIDTH,
  WORDMARK_FONT,
  WORDMARK_FONT_SIZE,
  WORDMARK_PERIOD_ANCHOR_X,
  WORDMARK_PERIOD_ANCHOR_Y,
  WORDMARK_PERIOD_RADIUS,
  WORDMARK_VIEWBOX_HEIGHT,
  computeWordmarkLayout,
} from "./wordmark-metrics";

export {
  WORDMARK_FONT,
  WORDMARK_FONT_SIZE,
  WORDMARK_BASELINE_Y,
  WORDMARK_PERIOD_RADIUS,
} from "./wordmark-metrics";

import { getSiteName } from "../../site-name";

/** Site-name wordmark; the period meshes to 3 loading dots, then merges back. */
export function SnatchWordmarkSvg({ className = "snatchLogoMark", title = getSiteName() }) {
  const textRef = useRef(null);
  const [layout, setLayout] = useState(null);

  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node) return;

    const measure = () => {
      const box = node.getBBox();
      setLayout(computeWordmarkLayout(box.x + box.width));
    };

    measure();

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(measure).catch(() => {});
    }
  }, []);

  const anchorX = layout?.anchorX ?? WORDMARK_PERIOD_ANCHOR_X;
  const anchorY = layout?.anchorY ?? WORDMARK_PERIOD_ANCHOR_Y;
  // Before the text is measured, size the view box from the name's length.
  const viewWidth = layout?.viewWidth ?? Math.max(WORDMARK_FALLBACK_VIEW_WIDTH, Math.ceil(String(title).length * 9.2 + 12));
  const viewBox = `0 0 ${viewWidth} ${WORDMARK_VIEWBOX_HEIGHT}`;

  return (
    <svg
      className={className}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <text
        ref={textRef}
        x="0"
        y={WORDMARK_BASELINE_Y}
        fill="currentColor"
        fontFamily={WORDMARK_FONT}
        fontSize={WORDMARK_FONT_SIZE}
        fontWeight="800"
        letterSpacing="-0.052em"
      >
        {title}
      </text>
      <g className="snatchLogoPeriodGroup" transform={`translate(${anchorX} ${anchorY})`}>
        <circle
          className="snatchLogoPeriod snatchLogoPeriod--lead"
          cx="0"
          cy="0"
          r={WORDMARK_PERIOD_RADIUS}
          fill="currentColor"
        />
        <circle
          className="snatchLogoPeriod snatchLogoPeriod--mid"
          cx="0"
          cy="0"
          r={WORDMARK_PERIOD_RADIUS}
          fill="currentColor"
        />
        <circle
          className="snatchLogoPeriod snatchLogoPeriod--trail"
          cx="0"
          cy="0"
          r={WORDMARK_PERIOD_RADIUS}
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
