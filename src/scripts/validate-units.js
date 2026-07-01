#!/usr/bin/env node
/**
 * Validate ConstraintUnit JSON files against spec/constraint-unit.schema.json
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..', '..');
const SCHEMA_PATH = path.join(ROOT, 'spec', 'constraint-unit.schema.json');
const DEFAULT_FILES = [
  path.join(ROOT, 'examples', 'quant', 'constraints.json'),
];

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const unitSchema = { ...schema, $id: undefined };

const ajv = new Ajv({ allErrors: true, strict: false });
const validateUnit = ajv.compile(unitSchema);

function loadUnits(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.units)) return raw.units;
  throw new Error(`${filePath}: expected array or { units: [] }`);
}

function main() {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((f) => path.resolve(f))
    : DEFAULT_FILES;

  let failed = 0;
  for (const file of files) {
    const units = loadUnits(file);
    console.log(`\n${file} (${units.length} units)`);
    for (const unit of units) {
      if (validateUnit(unit)) {
        console.log(`  ✓ ${unit.id}`);
      } else {
        failed++;
        console.error(`  ✗ ${unit.id || '(no id)'}`);
        for (const err of validateUnit.errors || []) {
          console.error(`      ${err.instancePath || '/'} ${err.message}`);
        }
      }
    }
  }

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} unit(s) failed validation.\n`);
  } else {
    console.log('\nAll units valid.\n');
  }
}

main();
