/**
 * Reports rewards by currency and evidence status for each package.
 * Run: node scripts/report-package-rewards.js [version]
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const current = JSON.parse(fs.readFileSync(path.join(root, "data", "current.json"), "utf8"));
const version = process.argv[2] || current.version;
const versionDir = path.join(root, "data", "versions", version);
const sources = new Map(
  JSON.parse(fs.readFileSync(path.join(versionDir, "primogems.json"), "utf8")).map((item) => [item.id, item])
);

function emptyRewards() {
  return { primogems: 0, intertwinedFates: 0, acquaintFates: 0 };
}

function add(target, rewards) {
  for (const key of Object.keys(target)) target[key] += rewards[key] || 0;
}

function bucketFor(task, source) {
  if (task.availabilityStatus === "expired") return "expired";
  if (task.availabilityStatus === "conditional") return "conditional";
  if (task.availabilityStatus === "unconfirmed") return "unconfirmed";
  if (source.verification?.status === "pending") return "unconfirmed";
  if (source.verification?.status === "estimated") return "estimated";
  return "confirmed";
}

for (const filename of fs.readdirSync(path.join(versionDir, "packages")).filter((name) => name.endsWith(".json"))) {
  const pkg = JSON.parse(fs.readFileSync(path.join(versionDir, "packages", filename), "utf8"));
  const totals = {
    confirmed: emptyRewards(),
    estimated: emptyRewards(),
    conditional: emptyRewards(),
    unconfirmed: emptyRewards(),
    expired: emptyRewards()
  };

  for (const task of pkg.resourcePool) {
    const source = sources.get(task.sourceId);
    if (!source?.rewards) continue;
    add(totals[bucketFor(task, source)], source.rewards);
  }

  console.log(`\n${pkg.title}`);
  console.log(`  window: ${pkg.planWindow?.calculatedAt || "not set"} -> ${pkg.planWindow?.bannerEndsAt || "not set"}`);
  for (const [bucket, rewards] of Object.entries(totals)) {
    console.log(`  ${bucket}: ${rewards.primogems} primogems, ${rewards.intertwinedFates} intertwined fates, ${rewards.acquaintFates} acquaint fates`);
  }
}
