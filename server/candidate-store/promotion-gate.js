const {
  validateIndexNowEligibility,
  MIN_OVERALL_SCORE,
  isGraphComplete,
  resolveAcquisitionUrl,
} = require("./seo-tier");

function validatePromotionGate(record, now = Date.now(), options = {}) {
  return validateIndexNowEligibility(record, now, options);
}

module.exports = {
  validatePromotionGate,
  validateIndexNowEligibility,
  MIN_OVERALL_SCORE,
  isGraphComplete,
  resolveAcquisitionUrl,
};
