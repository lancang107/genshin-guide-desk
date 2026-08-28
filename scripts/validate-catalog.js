/**
 * validate-catalog.js
 *
 * Validates all JSON files in data/catalog/one-time-resources/ against
 * one-time-resource.schema.json. Also checks for duplicate IDs and
 * prerequisite reference integrity (warns on missing prerequisites).
 *
 * Run: node scripts/validate-catalog.js
 * Dependencies: none
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SCHEMA_DIR = path.join(DATA_DIR, "schema");
const CATALOG_DIR = path.join(DATA_DIR, "catalog", "one-time-resources");
const REGIONS_PATH = path.join(DATA_DIR, "catalog", "regions.json");
const CREATORS_PATH = path.join(DATA_DIR, "creators.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const schema = readJSON(path.join(SCHEMA_DIR, "one-time-resource.schema.json"));
const validKinds = new Set(schema.properties.kind.enum);
const validDifficulty = new Set(schema.properties.difficulty.enum);
const validGranularity = new Set(schema.properties.completionGranularity.enum);
const validStatus = new Set(schema.properties.verification.properties.status.enum);
const validMethod = new Set(schema.properties.rewardMethod.enum);
const requiredFields = schema.required;
const creators = new Map(readJSON(CREATORS_PATH).map((creator) => [creator.id, creator]));

function validateResource(item, label, geography) {
  const errors = [];
  for (const field of requiredFields) {
    if (!(field in item)) errors.push(`  [MISSING] ${label}: missing field "${field}"`);
  }
  if (item.kind && !validKinds.has(item.kind))
    errors.push(`  [INVALID] ${label}: kind "${item.kind}" not in enum`);
  if (item.difficulty && !validDifficulty.has(item.difficulty))
    errors.push(`  [INVALID] ${label}: difficulty "${item.difficulty}" not in enum`);
  if (item.completionGranularity && !validGranularity.has(item.completionGranularity))
    errors.push(`  [INVALID] ${label}: completionGranularity "${item.completionGranularity}" not in enum`);
  if (item.verification?.status && !validStatus.has(item.verification.status))
    errors.push(`  [INVALID] ${label}: verification.status "${item.verification.status}" not in enum`);
  if (item.rewardMethod && !validMethod.has(item.rewardMethod))
    errors.push(`  [INVALID] ${label}: rewardMethod "${item.rewardMethod}" not in enum`);
  const em = item.estimatedMinutes;
  if (em) {
    if (typeof em.min !== "number" || typeof em.typical !== "number" || typeof em.max !== "number")
      errors.push(`  [INVALID] ${label}: estimatedMinutes must have min/typical/max as numbers`);
    else if (em.min > em.typical || em.typical > em.max)
      errors.push(`  [INVALID] ${label}: estimatedMinutes must be ascending (min <= typical <= max)`);
  }
  if (item.rewards) {
    if (typeof item.rewards.primogems !== "number")
      errors.push(`  [INVALID] ${label}: rewards.primogems must be a number`);
    if (typeof item.rewards.intertwinedFates !== "number")
      errors.push(`  [INVALID] ${label}: rewards.intertwinedFates must be a number`);
    if (typeof item.rewards.acquaintFates !== "number")
      errors.push(`  [INVALID] ${label}: rewards.acquaintFates must be a number`);
  }
  if (item.verification && !Array.isArray(item.verification.evidenceIds))
    errors.push(`  [INVALID] ${label}: verification.evidenceIds must be an array`);
  if (item.verification && item.verification.evidenceIds?.length === 0)
    errors.push(`  [INVALID] ${label}: verification.evidenceIds must have at least 1 entry`);
  for (const link of item.guideLinks || []) {
    if (link.kind === "creator" && !link.creatorId)
      errors.push(`  [INVALID SOURCE] ${label}: creator links require creatorId`);
    if (link.creatorId && !creators.has(link.creatorId))
      errors.push(`  [INVALID SOURCE] ${label}: unknown creatorId "${link.creatorId}"`);
    if (link.kind === "creator" && link.publisherVerification?.status !== "confirmed")
      errors.push(`  [INVALID SOURCE] ${label}: creator links require confirmed publisherVerification`);
    if (link.kind === "creator" && link.publisherVerification?.creatorId !== link.creatorId)
      errors.push(`  [INVALID SOURCE] ${label}: publisherVerification creatorId mismatch`);
  }
  if (item.countryId && !geography.countryIds.has(item.countryId))
    errors.push(`  [INVALID REF] ${label}: unknown countryId "${item.countryId}"`);
  if (item.areaId) {
    const area = geography.areas.get(item.areaId);
    if (!area) errors.push(`  [INVALID REF] ${label}: unknown areaId "${item.areaId}"`);
    else if (item.countryId && area.countryId !== item.countryId)
      errors.push(`  [INVALID REF] ${label}: areaId "${item.areaId}" does not belong to countryId "${item.countryId}"`);
  }
  const allowedCoverageAreaIds = new Set([item.areaId, ...(item.coverageAreaIds || [])].filter(Boolean));
  if (item.coverageAreaIds) {
    if (!Array.isArray(item.coverageAreaIds) || item.coverageAreaIds.length === 0)
      errors.push(`  [INVALID] ${label}: coverageAreaIds must be a non-empty array when provided`);
    for (const areaId of item.coverageAreaIds || []) {
      const area = geography.areas.get(areaId);
      if (!area) errors.push(`  [INVALID REF] ${label}: unknown coverage area "${areaId}"`);
      else if (item.countryId && area.countryId !== item.countryId)
        errors.push(`  [INVALID REF] ${label}: coverage area "${areaId}" does not belong to countryId "${item.countryId}"`);
    }
  }
  if (item.subregionId) {
    const subregion = geography.subregions.get(item.subregionId);
    if (!subregion) errors.push(`  [INVALID REF] ${label}: unknown subregionId "${item.subregionId}"`);
    else if (item.areaId && subregion.areaId !== item.areaId)
      errors.push(`  [INVALID REF] ${label}: subregionId "${item.subregionId}" does not belong to areaId "${item.areaId}"`);
  }
  if (item.coverageSubregionIds) {
    if (!Array.isArray(item.coverageSubregionIds) || item.coverageSubregionIds.length === 0) {
      errors.push(`  [INVALID] ${label}: coverageSubregionIds must be a non-empty array when provided`);
    }
    for (const subregionId of item.coverageSubregionIds || []) {
      const subregion = geography.subregions.get(subregionId);
      if (!subregion) errors.push(`  [INVALID REF] ${label}: unknown coverage subregion "${subregionId}"`);
      else if (allowedCoverageAreaIds.size && !allowedCoverageAreaIds.has(subregion.areaId))
        errors.push(`  [INVALID REF] ${label}: coverage subregion "${subregionId}" does not belong to areaId or coverageAreaIds`);
    }
  }
  if (["chest-route", "oculus-route"].includes(item.kind)) {
    if (!item.geographyStatus)
      errors.push(`  [MISSING] ${label}: ${item.kind} requires geographyStatus`);
    if (item.geographyStatus === "confirmed" && !item.subregionId && !item.coverageSubregionIds?.length)
      errors.push(`  [MISSING] ${label}: confirmed ${item.kind} requires subregionId or coverageSubregionIds`);
    if (item.geographyStatus === "needs-geocoding" && item.subregionId)
      errors.push(`  [INVALID] ${label}: needs-geocoding ${item.kind} must not claim a subregionId`);
  }
  return errors;
}

function validateCatalog() {
  const allErrors = [];
  const allIds = new Set();
  const allItems = [];
  const regionData = readJSON(REGIONS_PATH);
  const geography = {
    countryIds: new Set((regionData.countries || []).map((item) => item.id)),
    areas: new Map((regionData.areas || []).map((item) => [item.id, item])),
    subregions: new Map((regionData.subregions || []).map((item) => [item.id, item]))
  };

  console.log("\n=== Validating one-time resource catalog ===\n");

  if (!fs.existsSync(CATALOG_DIR)) {
    console.log("  SKIP catalog directory not found");
    return [];
  }

  const regions = fs.readdirSync(CATALOG_DIR).filter((d) =>
    fs.statSync(path.join(CATALOG_DIR, d)).isDirectory()
  );

  let totalResources = 0;

  for (const region of regions) {
    const regionDir = path.join(CATALOG_DIR, region);
    const files = fs.readdirSync(regionDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      const filePath = path.join(regionDir, file);
      const label = `${region}/${file}`;
      let data;
      try {
        data = readJSON(filePath);
      } catch (e) {
        allErrors.push(`  [PARSE ERROR] ${label}: ${e.message}`);
        continue;
      }
      const arr = Array.isArray(data) ? data : [data];
      let fileErrors = 0;
      for (const item of arr) {
        const errs = validateResource(item, `${label}/${item.id || "?"}`, geography);
        fileErrors += errs.length;
        allErrors.push(...errs);
        if (item.id) {
          if (allIds.has(item.id))
            allErrors.push(`  [DUPLICATE] ${label}: duplicate id "${item.id}"`);
          allIds.add(item.id);
        }
        allItems.push(item);
        totalResources++;
      }
      if (fileErrors === 0) {
        console.log(`  OK  ${label} (${arr.length} resources)`);
      } else {
        console.log(`  FAIL ${label} (${fileErrors} error(s))`);
      }
    }
  }

  // Check prerequisite references (warn only)
  const CROSS_REGION_PREREQUISITES = new Set([
    "mondstadt-archon-act3" // 跨地区前置：至冬第七章第一幕要求完成蒙德魔神任务序章第三幕；蒙德目录暂未录入。
  ]);
  const warnings = [];
  for (const item of allItems) {
    if (!item.prerequisiteIds) continue;
    for (const prereq of item.prerequisiteIds) {
      if (!allIds.has(prereq) && !CROSS_REGION_PREREQUISITES.has(prereq)) {
        warnings.push(`  [WARN] ${item.id}: prerequisite "${prereq}" not found in catalog (may be cross-region or version data)`);
      }
    }
  }

  console.log(`\nTotal resources: ${totalResources}`);
  console.log(`Regions: ${regions.join(", ")}`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} prerequisite warning(s):`);
    for (const w of warnings) console.log(w);
  }

  return allErrors;
}

const errors = validateCatalog();
if (errors.length === 0) {
  console.log("\nAll catalog checks passed.\n");
  process.exit(0);
} else {
  console.log(`\n${errors.length} error(s) found:\n`);
  for (const e of errors) console.log(e);
  console.log("");
  process.exit(1);
}
