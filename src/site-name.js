// The site name is set once on the server (server/site-identity.js) and exposed
// to the browser through <meta property="og:site_name">.
export function getSiteName() {
  if (typeof document === "undefined") return "";
  const meta = document.querySelector('meta[property="og:site_name"]');
  return (meta && meta.getAttribute("content")) || "";
}
