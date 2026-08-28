const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const sourceLinks = read("data/catalog/source-links.json");
const sources = new Map(read("data/versions/7.0/primogems.json").map((item) => [item.id, item]));
const resources = new Map();
for (const region of fs.readdirSync(path.join(root, "data/catalog/one-time-resources"))) {
  const dir = path.join(root, "data/catalog/one-time-resources", region);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    read(`data/catalog/one-time-resources/${region}/${file}`).forEach((item) => resources.set(item.id, item));
  }
}

const errors = [];
const owners = new Map();
for (const [sourceId, resourceIds] of Object.entries(sourceLinks)) {
  const label = `source-links/${sourceId}`;
  if (!sources.has(sourceId)) errors.push(`${label}: unknown primogems source`);
  if (!Array.isArray(resourceIds) || !resourceIds.length) errors.push(`${label}: must map to at least one resource`);
  for (const resourceId of resourceIds || []) {
    if (!resources.has(resourceId)) errors.push(`${label}: unknown resource ${resourceId}`);
    if (owners.has(resourceId)) errors.push(`${label}: ${resourceId} is also mapped by ${owners.get(resourceId)}`);
    owners.set(resourceId, sourceId);
  }
}
const uncovered = [...resources.keys()].filter((id) => !owners.has(id));
if (uncovered.length) errors.push(`uncovered catalog resources: ${uncovered.join(", ")}`);

if (errors.length) {
  console.error(errors.map((error) => `  [INVALID] ${error}`).join("\n"));
  process.exit(1);
}
console.log(`  OK  source-links.json (${Object.keys(sourceLinks).length} groups, ${owners.size} resources)`);
