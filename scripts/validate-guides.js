/**
 * Validates curated execution guides and their resource coverage.
 * Run: node scripts/validate-guides.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data/schema/one-dragon-guide.schema.json"), "utf8"));
const regions = JSON.parse(fs.readFileSync(path.join(root, "data/catalog/regions.json"), "utf8"));
const geography = new Map(regions.areas.map((area) => [area.id, area]));
const resourceIds = new Set();
const creators = new Map(JSON.parse(fs.readFileSync(path.join(root, "data/creators.json"), "utf8")).map((creator) => [creator.id, creator]));
for (const file of fs.readdirSync(path.join(root, "data/catalog/one-time-resources/snezhnaya"))) {
  if (!file.endsWith(".json")) continue;
  JSON.parse(fs.readFileSync(path.join(root, "data/catalog/one-time-resources/snezhnaya", file), "utf8")).forEach((item) => resourceIds.add(item.id));
}

const errors = [];
const guideDir = path.join(root, "data/catalog/guides");
for (const country of fs.readdirSync(guideDir)) {
  const countryDir = path.join(guideDir, country);
  for (const file of fs.readdirSync(countryDir).filter((name) => name.endsWith(".json"))) {
    const label = country + "/" + file;
    const guides = JSON.parse(fs.readFileSync(path.join(countryDir, file), "utf8"));
    const seen = new Set();
    for (const guide of guides) {
      for (const field of schema.required) if (!(field in guide)) errors.push(label + "/" + (guide.id || "?") + ": missing " + field);
      if (seen.has(guide.id)) errors.push(label + ": duplicate guide id " + guide.id);
      seen.add(guide.id);
      if (!geography.has(guide.areaId)) errors.push(label + "/" + guide.id + ": unknown areaId " + guide.areaId);
      if (!creators.has(guide.creatorId)) errors.push(label + "/" + guide.id + ": creatorId is not in the creator pool");
      for (const link of guide.guideLinks || []) {
        if (link.creatorId !== guide.creatorId) errors.push(label + "/" + guide.id + ": guide link creatorId mismatch");
        if (link.publisherVerification?.status !== "confirmed") errors.push(label + "/" + guide.id + ": publisher is not confirmed");
      }
      for (const id of (guide.coverage?.resourceIds || [])) if (!resourceIds.has(id)) errors.push(label + "/" + guide.id + ": unknown covered resource " + id);
      if (!guide.verification?.evidenceIds?.length) errors.push(label + "/" + guide.id + ": evidenceIds must not be empty");
    }
    console.log("  " + (errors.length ? "FAIL" : "OK") + "  " + label + " (" + guides.length + " guides)");
  }
}
if (errors.length) {
  console.error("\n" + errors.length + " guide error(s):\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\nAll guide checks passed.\n");
