/**
 * validate-data.js
 *
 * Validates all JSON data files in data/versions/{version}/ against their schemas.
 * Run: node scripts/validate-data.js [version]
 * If version is omitted, reads data/current.json for the active version.
 *
 * Dependencies: none (uses a lightweight inline validator).
 * For full schema validation, install ajv: npm install ajv ajv-formats
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const SCHEMA_DIR = path.join(DATA_DIR, "schema");

function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function getVersion() {
  const arg = process.argv[2];
  if (arg) return arg;
  const current = readJSON(path.join(DATA_DIR, "current.json"));
  return current.version;
}

// --- Lightweight checks (replace with ajv for production) ---

function checkRequired(obj, schema, filePath) {
  const errors = [];
  if (!schema.required) return errors;
  for (const field of schema.required) {
    if (!(field in obj)) {
      errors.push(`  [MISSING] ${filePath}: missing required field "${field}"`);
    }
  }
  return errors;
}

function checkEnum(obj, schema, key, filePath) {
  const errors = [];
  if (!schema.properties || !schema.properties[key]) return errors;
  const prop = schema.properties[key];
  if (prop.enum && obj[key] && !prop.enum.includes(obj[key])) {
    errors.push(
      `  [INVALID] ${filePath}: "${key}" must be one of [${prop.enum.join(", ")}], got "${obj[key]}"`
    );
  }
  return errors;
}

function validateFile(filePath, schemaName) {
  const errors = [];
  let data;
  try {
    data = readJSON(filePath);
  } catch (e) {
    return [`  [PARSE ERROR] ${filePath}: ${e.message}`];
  }

  let schema;
  try {
    schema = readJSON(path.join(SCHEMA_DIR, schemaName));
  } catch (e) {
    return [`  [SCHEMA MISSING] ${schemaName}: ${e.message}`];
  }

  errors.push(...checkRequired(data, schema, filePath));
  return errors;
}

function validateObject(obj, schemaName, label) {
  let schema;
  try {
    schema = readJSON(path.join(SCHEMA_DIR, schemaName));
  } catch (e) {
    return [`  [SCHEMA MISSING] ${schemaName}: ${e.message}`];
  }

  return checkRequired(obj, schema, label);
}

function findDuplicateIds(items, label) {
  const errors = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== "object" || !item.id) continue;
    if (seen.has(item.id)) {
      errors.push(`  [DUPLICATE] ${label}: duplicate id "${item.id}"`);
    }
    seen.add(item.id);
  }
  return errors;
}

function validateVersion(version) {
  const versionDir = path.join(DATA_DIR, "versions", version);
  const allErrors = [];

  console.log(`\n=== Validating version ${version} ===\n`);

  // meta.json
  const metaPath = path.join(versionDir, "meta.json");
  if (fs.existsSync(metaPath)) {
    const errs = validateFile(metaPath, "version-meta.schema.json");
    if (errs.length === 0) console.log(`  OK  meta.json`);
    else { console.log(`  FAIL meta.json`); allErrors.push(...errs); }
  } else {
    console.log(`  SKIP meta.json (not found)`);
  }

  // primogems.json
  const primoPath = path.join(versionDir, "primogems.json");
  let primogemsSources = [];
  if (fs.existsSync(primoPath)) {
    let data;
    try {
      data = readJSON(primoPath);
      const arr = Array.isArray(data) ? data : [data];
      primogemsSources = arr;
      let ok = true;
      for (const [index, item] of arr.entries()) {
        const errs = validateObject(item, "primogems-source.schema.json", `${primoPath}[${index}]`);
        if (!item.rewards || !Number.isInteger(item.rewards.primogems) ||
            !Number.isInteger(item.rewards.intertwinedFates) ||
            !Number.isInteger(item.rewards.acquaintFates)) {
          errs.push(`  [MISSING] ${primoPath}[${index}]: rewards must split primogems, intertwinedFates, and acquaintFates`);
        }
        if (!item.verification?.status) {
          errs.push(`  [MISSING] ${primoPath}[${index}]: verification.status is required for publishable version data`);
        }
        if (errs.length > 0) { ok = false; allErrors.push(...errs); }
      }
      const duplicateErrs = findDuplicateIds(arr, primoPath);
      if (duplicateErrs.length > 0) { ok = false; allErrors.push(...duplicateErrs); }
      if (ok) console.log(`  OK  primogems.json (${arr.length} sources)`);
      else console.log(`  FAIL primogems.json`);
    } catch {
      console.log(`  FAIL primogems.json (parse error)`);
    }
  } else {
    console.log(`  SKIP primogems.json (not found)`);
  }

  // packages/
  const pkgDir = path.join(versionDir, "packages");
  if (fs.existsSync(pkgDir)) {
    const pkgFiles = fs.readdirSync(pkgDir).filter((f) => f.endsWith(".json"));
    const sourceIds = new Set(primogemsSources.map((source) => source.id));
    const characterIds = fs.existsSync(path.join(versionDir, "characters"))
      ? new Set(fs.readdirSync(path.join(versionDir, "characters")).filter((d) =>
          fs.statSync(path.join(versionDir, "characters", d)).isDirectory()
        ))
      : new Set();

    for (const f of pkgFiles) {
      const pkgPath = path.join(pkgDir, f);
      const errs = validateFile(pkgPath, "guide-package.schema.json");
      try {
        const pkg = readJSON(pkgPath);
        if (!pkg.planWindow?.calculatedAt || !pkg.planWindow?.bannerEndsAt ||
            !Number.isInteger(pkg.planWindow?.remainingDays)) {
          errs.push(`  [MISSING] ${pkgPath}: planWindow must record the calculation date and remaining banner days`);
        }
        for (const task of pkg.resourcePool || []) {
          if (!sourceIds.has(task.sourceId)) {
            errs.push(`  [INVALID REF] ${pkgPath}: unknown sourceId "${task.sourceId}"`);
          }
        }
        for (const characterId of pkg.materialPlan?.characterIds || []) {
          if (!characterIds.has(characterId)) {
            errs.push(`  [INVALID REF] ${pkgPath}: unknown characterId "${characterId}"`);
          }
        }
      } catch (e) {
        errs.push(`  [PARSE ERROR] ${pkgPath}: ${e.message}`);
      }
      if (errs.length === 0) console.log(`  OK  packages/${f}`);
      else { console.log(`  FAIL packages/${f}`); allErrors.push(...errs); }
    }
  } else {
    console.log(`  SKIP packages/ (not found)`);
  }

  // characters/
  const charDir = path.join(versionDir, "characters");
  if (fs.existsSync(charDir)) {
    const charDirs = fs.readdirSync(charDir).filter((d) =>
      fs.statSync(path.join(charDir, d)).isDirectory()
    );
    for (const d of charDirs) {
      const matPath = path.join(charDir, d, "materials.json");
      if (fs.existsSync(matPath)) {
        const errs = validateFile(matPath, "character-materials.schema.json");
        if (errs.length === 0) console.log(`  OK  characters/${d}/materials.json`);
        else { console.log(`  FAIL characters/${d}/materials.json`); allErrors.push(...errs); }
      }
    }
  } else {
    console.log(`  SKIP characters/ (not found)`);
  }

  // creators.json
  const creatorPath = path.join(DATA_DIR, "creators.json");
  if (fs.existsSync(creatorPath)) {
    let data;
    try {
      data = readJSON(creatorPath);
      const arr = Array.isArray(data) ? data : [data];
      let ok = true;
      for (const item of arr) {
        const errs = checkRequired(item, readJSON(path.join(SCHEMA_DIR, "creator.schema.json")), creatorPath);
        if (errs.length > 0) { ok = false; allErrors.push(...errs); }
      }
      if (ok) console.log(`  OK  creators.json (${arr.length} creators)`);
      else console.log(`  FAIL creators.json`);
    } catch {
      console.log(`  FAIL creators.json (parse error)`);
    }
  }

  return allErrors;
}

// --- Main ---
const version = getVersion();
const errors = validateVersion(version);

if (errors.length === 0) {
  console.log(`\nAll checks passed for version ${version}.\n`);
  process.exit(0);
} else {
  console.log(`\n${errors.length} error(s) found:\n`);
  for (const e of errors) console.log(e);
  console.log("");
  process.exit(1);
}
