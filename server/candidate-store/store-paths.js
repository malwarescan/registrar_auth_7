const fs = require("fs");
const path = require("path");
const { configureStorePaths } = require("./durable-candidates");
const { DEFAULT_BATCH_PATH, loadIndexNowBatch } = require("./index-now-batch");
const { SNAPSHOT_PATH, loadCommittedSnapshot } = require("./auction-snapshot");

const ROOT = path.resolve(__dirname, "..", "..");
const PRODUCT_RECORDS_DIR = path.join(ROOT, "data", "product-records");
const INDEX_NOW_BATCH_PATH = DEFAULT_BATCH_PATH;

function configureDefaultProductStore() {
  if (fs.existsSync(PRODUCT_RECORDS_DIR)) {
    configureStorePaths({ recordsDir: PRODUCT_RECORDS_DIR });
    return "product-records";
  }

  // The committed NameSilo auction snapshot (replaced in memory by live API
  // data when NAMESILO_API_KEY is set).
  if (fs.existsSync(SNAPSHOT_PATH) && loadCommittedSnapshot()) {
    return "auction-snapshot";
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
  SNAPSHOT_PATH,
  configureDefaultProductStore,
};
