import React from "react";
import { SnatchWordmarkSvg } from "./SnatchWordmark";
import "./SnatchLogo.css";

export default function SnatchLogo({ href = "/experiments/intent-fetch/", className = "" }) {
  return (
    <a href={href} className={`snatchLogo snatchBrand ${className}`.trim()} aria-label="snatch home">
      <SnatchWordmarkSvg />
    </a>
  );
}
