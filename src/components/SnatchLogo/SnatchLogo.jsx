import React from "react";
import { SnatchWordmarkSvg } from "./SnatchWordmark";
import "./SnatchLogo.css";
import { getSiteName } from "../../site-name";

export default function SnatchLogo({ href = "/", className = "" }) {
  return (
    <a href={href} className={`snatchLogo snatchBrand ${className}`.trim()} aria-label={`${getSiteName()} home`.trim()}>
      <SnatchWordmarkSvg title={getSiteName() || undefined} />
    </a>
  );
}
