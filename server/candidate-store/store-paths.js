const fs = require("fs");
const path = require("path");
const { configureStorePaths } = require("./durable-candidates");
const { DEFAULT_BATCH_PATH, loadIndexNowBatch } = require("./index-now-batch");

const ROOT = path.resolve(__dirname, "..", "..");
const PRODUCT_RECORDS_DIR = path.join(ROOT, "data", "product-records");
const INDEX_NOW_BATCH_PATH = DEFAULT_BATCH_PATH;

function configureDefaultProductStore() {
  if (fs.existsSync(PRODUCT_RECORDS_DIR)) {
    configureStorePaths({ recordsDir: PRODUCT_RECORDS_DIR });
    return "product-records";
  }

  if (fs.existsSync(INDEX_NOW_BATCH_PATH)) {
    configureStorePaths({ indexNowBatchPath: INDEX_NOW_BATCH_PATH });
    loadIndexNowBatch({ refreshTtl: true });
    return "index-now-batch";
  }

  return "durable-map";
}

module.exports = {
  PRODUCT_RECORDS_DIR,
  INDEX_NOW_BATCH_PATH,
  configureDefaultProductStore,
};
