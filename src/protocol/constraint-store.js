/**
 * ConstraintStore — loads ConstraintUnits and builds the resolve index.
 *
 * Migrated & abstracted from field-registry's `data-loader.js` (alias/synonym index)
 * and `services/field-service.js` (resolveAlias). Two deliberate changes for the
 * open-world agent setting:
 *
 *   1. Domain-agnostic: a unit is a ConstraintUnit (spec/constraint-unit.schema.json),
 *      not a financial field. No `systems` / `domain` / maskRule financial specifics.
 *
 *   2. Miss semantics flipped: in the closed-world registry a miss is an anomaly
 *      (→ suggest_field flywheel). Here a miss is NORMAL — most of an unbounded prompt
 *      has no pre-declared constraint. resolve() returns { status: 'unresolved' } and
 *      lets verify_usage be the safety net, instead of erroring.
 */

const fs = require('fs');
const path = require('path');

function createStore() {
  /** @type {Record<string, object>} id -> ConstraintUnit */
  const units = {};
  /** @type {Record<string, string>} normalized alias -> id */
  const aliasIndex = {};

  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function indexUnit(unit) {
    units[unit.id] = unit;
    // The id itself and the label are resolvable aliases.
    aliasIndex[norm(unit.id)] = unit.id;
    if (unit.label) aliasIndex[norm(unit.label)] = unit.id;
    for (const a of unit.aliases || []) aliasIndex[norm(a)] = unit.id;
    // Cross-context mapping names are resolvable too (best-effort).
    for (const m of unit.mappings || []) {
      if (m && m.name) aliasIndex[norm(m.name)] = unit.id;
    }
  }

  /** Load an array of ConstraintUnits (or a {units:[...]} bundle). */
  function load(data) {
    const list = Array.isArray(data) ? data : data && data.units ? data.units : [];
    for (const unit of list) {
      if (unit && unit.id) indexUnit(unit);
    }
    return list.length;
  }

  /** Load every *.json under a directory as constraint sources. */
  function loadDir(dir) {
    let count = 0;
    if (!fs.existsSync(dir)) return count;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      count += load(raw);
    }
    return count;
  }

  return {
    units,
    aliasIndex,
    norm,
    load,
    loadDir,
    /** Register a single unit at runtime (e.g. derived from AST during bind). */
    register(unit) {
      if (unit && unit.id) indexUnit(unit);
      return unit;
    },
    get(id) {
      return units[id] || null;
    },
    all() {
      return Object.values(units);
    },
    /** Units that form the project's symbol/signature registry (derived or declared). */
    symbols() {
      return Object.values(units).filter((u) =>
        ['symbol', 'signature', 'endpoint'].includes(u.kind || '')
      );
    },
    hasSymbolRegistry() {
      return Object.values(units).some((u) =>
        ['symbol', 'signature', 'endpoint'].includes(u.kind || '')
      );
    },
    size() {
      return Object.keys(units).length;
    },
  };
}

module.exports = { createStore };
