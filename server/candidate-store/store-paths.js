const fs = require("fs");
const path = require("path");
const { configureStorePaths } = require("./durable-candidates");

const ROOT = path.resolve(__dirname, "..", "..");
const PRODUCT_RECORDS_DIR = path.join(ROOT, "data", "product-records");

function configureDefaultProductStore() {
  if (fs.existsSync(PRODUCT_RECORDS_DIR)) {
    configureStorePaths({ recordsDir: PRODUCT_RECORDS_DIR });
  }
}

module.exports = {
  PRODUCT_RECORDS_DIR,
  configureDefaultProductStore,
};
