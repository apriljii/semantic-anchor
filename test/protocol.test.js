'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../src/protocol/constraint-store');
const { resolve } = require('../src/protocol/resolve');
const { verify, isSymbolUsage } = require('../src/protocol/verify');
const { createDispatcher } = require('../src/dispatch');
const { normalizeTscDiagnostics, parseTscTextOutput } = require('../src/adapters/tsc-environment');
const scenario = require('../examples/quant/limit-buy/scenario');

const constraints = require('../examples/quant/constraints.json');

function storeWithQuant() {
  const store = createStore();
  store.load(constraints);
  return store;
}

describe('resolve', () => {
  it('anchors alias to canonical id', () => {
    const store = storeWithQuant();
    const r = resolve(store, 'sym');
    assert.equal(r.status, 'resolved');
    assert.equal(r.id, 'ticker');
  });

  it('miss returns unresolved without error', () => {
    const store = storeWithQuant();
    const r = resolve(store, 'totallyUnknownField');
    assert.equal(r.status, 'unresolved');
    assert.ok(Array.isArray(r.candidates));
  });
});

describe('verify symbol/signature', () => {
  it('flags invented symbol calls when registry exists', () => {
    const store = storeWithQuant();
    const result = verify(store, {
      usages: [{ name: 'cancelAllOrders', kind: 'call' }],
    });
    assert.equal(result.ok, false);
    assert.ok(result.violations.some((v) => v.code === 'SYMBOL_NOT_FOUND'));
  });

  it('drifts alias symbol to canonical id', () => {
    const store = storeWithQuant();
    const result = verify(store, {
      usages: [{ name: 'placeOrder', kind: 'call' }],
    });
    assert.ok(result.violations.some((v) => v.code === 'NON_CANONICAL_NAME' && v.expected === 'submit_order'));
  });

  it('unknown field without symbol kind stays unverifiable', () => {
    const store = storeWithQuant();
    const result = verify(store, {
      usages: [{ name: 'randomField', value: 'x' }],
    });
    assert.equal(result.unverifiable.length, 1);
    assert.equal(result.unverifiable[0].code, 'NO_ANCHOR');
  });

  it('isSymbolUsage detects call kinds', () => {
    assert.equal(isSymbolUsage({ kind: 'call' }), true);
    assert.equal(isSymbolUsage({ call: true }), true);
    assert.equal(isSymbolUsage({ name: 'x' }), false);
  });
});

describe('tsc environment adapter', () => {
  it('normalizes diagnostics to ENV_TSC violations', () => {
    const v = normalizeTscDiagnostics([{ message: 'type error', code: 'TS2322', file: 'a.ts', line: 1 }]);
    assert.equal(v[0].code, 'ENV_TSC');
    assert.equal(v[0].severity, 'violation');
  });

  it('parses tsc stderr text', () => {
    const text = 'src/foo.ts(10,3): error TS2339: Property missing.';
    const parsed = parseTscTextOutput(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].line, 10);
    assert.equal(parsed[0].code, 'TS2339');
  });
});

describe('crash-test demo regression', () => {
  it('naive baseline ships more errors than protocol path', () => {
    const store = storeWithQuant();
    const call = createDispatcher(store);

    const naive = call('verify_usage', { usages: scenario.usages('naive') });
    assert.ok(naive.violations.length >= 8, `expected >=8 naive errors, got ${naive.violations.length}`);

    let usages = scenario.usages('draft');
    let result = call('verify_usage', { usages });
    let round = 0;
    while (!result.ok && round < 3) {
      round++;
      usages = scenario.usages('fixed');
      result = call('verify_usage', { usages });
    }
    assert.equal(result.violations.length, 0);
    assert.equal(result.ok, true);
  });
});

describe('derived constraints', () => {
  const { deriveFromTypescript } = require('../examples/derived/scan-typescript');
  const path = require('path');

  it('scans oms-api.ts into derived signature unit', () => {
    const file = path.join(__dirname, '../examples/quant/limit-buy/artifacts/oms-api.ts');
    const units = deriveFromTypescript(file);
    assert.equal(units.length, 1);
    assert.equal(units[0].id, 'submit_order');
    assert.equal(units[0].provenance, 'derived');
    assert.ok(units[0].members.some((m) => m.ref === 'ticker'));
  });

  it('bind splits declared vs derived injection slots', () => {
    const all = require('../examples/quant/constraints.json');
    const declaredOnly = { units: all.units.filter((u) => u.provenance !== 'derived') };
    const store = createStore();
    store.load(declaredOnly);
    const call = createDispatcher(store);
    const derived = deriveFromTypescript(
      path.join(__dirname, '../examples/quant/limit-buy/artifacts/oms-api.ts')
    );
    const bound = call('bind_constraints', {
      aliases: ['ticker', 'submit order'],
      extraConstraints: derived,
    });
    assert.ok(bound.injection.systemPrefix.every((u) => u.provenance === 'declared'));
    assert.ok(bound.injection.justInTime.some((u) => u.id === 'submit_order'));
  });
});

describe('harness semantic gate', () => {
  const { createSemanticGate } = require('../examples/harness-hook/semantic-gate');

  it('enforce retries until pass', async () => {
    const store = storeWithQuant();
    const gate = createSemanticGate(store);
    let retries = 0;
    const outcome = await gate.enforce(scenario.usages('draft'), {
      retry: () => {
        retries++;
        return scenario.usages('fixed');
      },
    });
    assert.equal(outcome.ok, true);
    assert.equal(retries, 1);
  });
});
