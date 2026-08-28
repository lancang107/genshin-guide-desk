/**
 * Validates version-scoped achievement intake archives.
 * Initial-list records deliberately cannot enter package reward totals.
 * Run: node scripts/validate-achievements.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CATEGORIES_PATH = path.join(DATA_DIR, "catalog", "achievement-categories.json");
const ARCHIVE_ROOT = path.join(DATA_DIR, "catalog", "achievements");
const SCHEMA_PATH = path.join(DATA_DIR, "schema", "achievement.schema.json");

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function validateItem(item, label, categoryIds, schema) {
  const errors = [];
  for (const field of schema.required) {
    if (!(field in item)) errors.push(`  [MISSING] ${label}: missing field "${field}"`);
  }
  for (const key of ["recordStatus", "availability", "completionType", "overlapPolicy"]) {
    const allowed = schema.properties[key]?.enum;
    if (allowed && !allowed.includes(item[key]))
      errors.push(`  [INVALID] ${label}: ${key} "${item[key]}" is not allowed`);
  }
  if (!categoryIds.has(item.gameCategoryId))
    errors.push(`  [INVALID REF] ${label}: unknown gameCategoryId "${item.gameCategoryId}"`);
  if (!Array.isArray(item.sourceEvidenceIds) || item.sourceEvidenceIds.length === 0)
    errors.push(`  [INVALID] ${label}: sourceEvidenceIds must be non-empty`);
  if (item.recordStatus === "initial-list" && item.rewardPrimogems !== null)
    errors.push(`  [INVALID] ${label}: initial-list records must keep rewardPrimogems null`);
  if (item.recordStatus === "initial-list" && item.overlapPolicy !== "unreviewed")
    errors.push(`  [INVALID] ${label}: initial-list records must keep overlapPolicy unreviewed`);
  return errors;
}

const categories = readJSON(CATEGORIES_PATH);
const schema = readJSON(SCHEMA_PATH);
const categoryIds = new Set(categories.categories.map((category) => category.id));
const errors = [];
let archiveCount = 0;

for (const country of fs.readdirSync(ARCHIVE_ROOT)) {
  const countryDir = path.join(ARCHIVE_ROOT, country);
  if (!fs.statSync(countryDir).isDirectory()) continue;
  for (const file of fs.readdirSync(countryDir).filter((name) => name.endsWith(".json"))) {
    const filePath = path.join(countryDir, file);
    const archive = readJSON(filePath);
    const label = `${country}/${file}`;
    const ids = new Set();
    for (const item of archive.items || []) {
      errors.push(...validateItem(item, `${label}/${item.id || "?"}`, categoryIds, schema));
      if (ids.has(item.id)) errors.push(`  [DUPLICATE] ${label}: duplicate id "${item.id}"`);
      ids.add(item.id);
    }
    if (archive.initialSummary?.reportedItemCount !== archive.items?.length)
      errors.push(`  [COUNT] ${label}: reportedItemCount does not match ${archive.items?.length || 0} item(s)`);
    const rewardVerification = archive.initialSummary?.rewardVerification;
    if (rewardVerification) {
      if (rewardVerification.status !== "confirmed-aggregate")
        errors.push(`  [INVALID] ${label}: rewardVerification.status must be confirmed-aggregate`);
      if (!Number.isInteger(rewardVerification.primogems) || rewardVerification.primogems < 0)
        errors.push(`  [INVALID] ${label}: rewardVerification.primogems must be a non-negative integer`);
      if (rewardVerification.primogems !== archive.initialSummary?.reportedPrimogems)
        errors.push(`  [TOTAL] ${label}: verified aggregate does not match reportedPrimogems`);
      if (!Array.isArray(rewardVerification.evidenceIds) || rewardVerification.evidenceIds.length === 0)
        errors.push(`  [INVALID] ${label}: rewardVerification.evidenceIds must be non-empty`);
    }
    archiveCount += archive.items?.length || 0;
    console.log(`  ${errors.length ? "FAIL" : "OK  "} ${label} (${archive.items?.length || 0} items)`);
  }
}

if (errors.length) {
  console.log(`\n${errors.length} achievement validation error(s):\n${errors.join("\n")}\n`);
  process.exit(1);
}
console.log(`\nAchievement intake validation passed (${archiveCount} items).\n`);
