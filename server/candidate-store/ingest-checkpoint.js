const fs = require("fs");
const path = require("path");

const DEFAULT_CHECKPOINT_PATH = path.resolve(__dirname, "..", "..", "data", "ingest-checkpoint.json");

function createEmptyCheckpoint(options = {}) {
  const now = new Date().toISOString();
  return {
    source: options.source || "namesilo-auction",
    lastCompletedPage: 0,
    pageSize: options.pageSize || 200,
    startedAt: now,
    updatedAt: now,
    recordsSeen: 0,
    recordsWritten: 0,
    duplicateCount: 0,
    errorCount: 0,
  };
}

function loadCheckpoint(checkpointPath = DEFAULT_CHECKPOINT_PATH) {
  if (!fs.existsSync(checkpointPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint, checkpointPath = DEFAULT_CHECKPOINT_PATH) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function updateCheckpoint(checkpoint, patch, checkpointPath = DEFAULT_CHECKPOINT_PATH) {
  const next = {
    ...checkpoint,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveCheckpoint(next, checkpointPath);
  return next;
}

module.exports = {
  DEFAULT_CHECKPOINT_PATH,
  createEmptyCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  updateCheckpoint,
};
