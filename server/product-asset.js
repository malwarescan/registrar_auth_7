const fs = require("fs");
const path = require("path");
const { getMetadataBaseUrl } = require("./public-url");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_OG_ASSET_PATH = "/assets/domain-og-default.png";

function productAssetFilePath(slug, assetsDir) {
  const dir = assetsDir || path.join(ROOT, "domain-assets");
  return path.join(dir, `${slug}.png`);
}

function hasLocalProductAsset(slug, assetsDir) {
  if (!slug) return false;
  return fs.existsSync(productAssetFilePath(slug, assetsDir));
}

function resolveLocalProductAssetPath(slug, assetsDir) {
  const specific = productAssetFilePath(slug, assetsDir);
  if (fs.existsSync(specific)) return specific;
  return path.join(ROOT, DEFAULT_OG_ASSET_PATH.replace(/^\//, ""));
}

function resolveProductOgImageUrl(slug, options = {}) {
  const metadataBase = getMetadataBaseUrl(options).replace(/\/+$/, "");
  if (hasLocalProductAsset(slug, options.assetsDir)) {
    return `${metadataBase}/domain-assets/${slug}.png`;
  }
  return `${metadataBase}${DEFAULT_OG_ASSET_PATH}`;
}

module.exports = {
  DEFAULT_OG_ASSET_PATH,
  productAssetFilePath,
  hasLocalProductAsset,
  resolveLocalProductAssetPath,
  resolveProductOgImageUrl,
};
