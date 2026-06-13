import React from "react";
import { createRoot } from "react-dom/client";
import IntentFetchPage from "./IntentFetchPage";

const mountNode = document.getElementById("intent-fetch-root");
if (mountNode) {
  createRoot(mountNode).render(<IntentFetchPage />);
}
