#!/usr/bin/env node
/**
 * Demo: environment adjudicator (tsc) wired into verify_usage.
 *
 * Run: node examples/adapters/tsc-demo.js
 */

const path = require('path');
const { createStore } = require('../../src/protocol/constraint-store');
const { createDispatcher } = require('../../src/dispatch');
const { createTscAdjudicator, normalizeTscDiagnostics } = require('../../src/adapters/tsc-environment');
const scenario = require('../quant/limit-buy/scenario');

const store = createStore();
store.load(require('../quant/constraints.json'));
const call = createDispatcher(store);

// Pre-captured diagnostics (what tsc would emit for naive.ts calling omsClient.placeOrder)
const sampleDiagnostics = normalizeTscDiagnostics([
  {
    file: 'artifacts/naive.ts',
    line: 18,
    code: 'TS2339',
    message: "Property 'placeOrder' does not exist on type 'OmsClient'. Did you mean 'submitOrder'?",
  },
]);

const usages = scenario.usages('naive');
const contractOnly = call('verify_usage', { usages });
const withEnv = call('verify_usage', {
  usages,
  environment: createTscAdjudicator({ diagnostics: sampleDiagnostics }),
});

console.log('=== verify_usage: contract only ===');
console.log(`  violations=${contractOnly.summary.violations}  hardFailures=${contractOnly.summary.hardFailures}`);
console.log('\n=== verify_usage: contract + tsc environment ===');
console.log(`  violations=${withEnv.summary.violations}  hardFailures=${withEnv.summary.hardFailures}`);
console.log('\n  Environment violations:');
for (const v of withEnv.violations.filter((x) => x.code === 'ENV_TSC')) {
  console.log(`    [ENV_TSC] ${v.message}`);
}
console.log('\n  → Same structured shape as contract violations; harness re-injects once.\n');
