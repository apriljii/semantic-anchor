#!/usr/bin/env node
/**
 * Multi-agent crash test (metrics only). For the narrated real-code walkthrough see:
 *   npm run demo:walkthrough
 */

const { createStore } = require('../../src/protocol/constraint-store');
const { createDispatcher } = require('../../src/dispatch');
const scenario = require('../quant/limit-buy/scenario');

const store = createStore();
store.load(require('../quant/constraints.json'));
const call = createDispatcher(store);

function shippedErrors(result) {
  return result.violations.length;
}

function runWithProtocol() {
  banner('WITH SemanticAnchor  (inject + gate + re-inject loop)');

  const bound = call('bind_constraints', { aliases: scenario.MENTIONED });
  log('Planner', `bind_constraints → ${bound.stats.resolved} resolved, ${bound.stats.unresolved} unresolved`);
  console.log('  inject.systemPrefix:', bound.injection.systemPrefix.map((u) => u.id).join(', '));

  let usages = scenario.usages('draft');
  let result = call('verify_usage', { usages });
  log('Gate', `pass=${result.ok}  violations=${result.summary.violations}`);
  console.log(indent(result.feedback));

  let round = 1;
  while (!result.ok && round <= 3) {
    round++;
    usages = scenario.usages('fixed');
    result = call('verify_usage', { usages });
    log('Gate', `retry ${round - 1}: pass=${result.ok}  violations=${result.summary.violations}`);
  }

  console.log(`\n  RESULT: shipped with ${shippedErrors(result)} semantic error(s) after ${round - 1} retry(ies).`);
  return shippedErrors(result);
}

function runNaive() {
  banner('NAIVE baseline  (prompt-only, no resolve / no gate)');
  const usages = scenario.usages('naive');
  const measure = call('verify_usage', { usages });
  log('Coder', 'emitted usages with no constraint guidance');
  console.log(indent(measure.feedback));
  console.log(`\n  RESULT: shipped with ${shippedErrors(measure)} semantic error(s) — nothing caught them.`);
  return shippedErrors(measure);
}

function banner(t) { console.log(`\n${'='.repeat(72)}\n  ${t}\n${'='.repeat(72)}`); }
function log(who, msg) { console.log(`  [${who}] ${msg}`); }
function indent(s) { return s.split('\n').map((l) => '    ' + l).join('\n'); }

console.log(`TASK: ${scenario.TASK}`);
console.log('  (Real code walkthrough: npm run demo:walkthrough)\n');

if (process.argv.includes('--naive')) {
  runNaive();
} else {
  const shipped = runWithProtocol();
  const naive = runNaive();
  banner('CRASH-TEST SUMMARY');
  console.log(`  prompt-only baseline : ${naive} semantic error(s) shipped`);
  console.log(`  with SemanticAnchor  : ${shipped} semantic error(s) shipped`);
  console.log('\n  See npm run demo:walkthrough for step-by-step code narrative.\n');
}
