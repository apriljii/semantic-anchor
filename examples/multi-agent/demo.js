#!/usr/bin/env node
/**
 * Multi-agent demo: how a constraint bundle is PASSED between agents and how
 * verify_usage CATCHES what injection alone misses.
 *
 *   Planner Agent  --bind_constraints-->  bundle  --pass-->  Coder Agent
 *   Coder Agent    --generate-->          usages  --verify--> gate
 *   gate violation --re-inject-->         Coder Agent retries --> converge
 *
 * Run:
 *   node examples/multi-agent/demo.js          # WITH SemanticAnchor (inject + gate + loop)
 *   node examples/multi-agent/demo.js --naive  # WITHOUT it (prompt-only baseline)
 *
 * Scenario: classic quant limit-buy order submission (ticker / side / qty / account).
 */

const path = require('path');
const { createStore } = require('../../src/protocol/constraint-store');
const { createDispatcher } = require('../../src/dispatch');

const store = createStore();
store.load(require('../../examples/quant/constraints.json'));
const call = createDispatcher(store);

const TASK =
  'Implement a limit buy order submission: ticker symbol, order side, quantity, and trading account id.';
const MENTIONED = ['ticker symbol', 'order side', 'quantity', 'account'];

function coderAgent({ bundle, feedback }) {
  // Typical LLM guesses in quant OMS code: sym/long/qty drift, lowercase ticker, account leaked.
  let usages = [
    { name: 'sym', value: 'aapl' },
    { name: 'side', value: 'long' },
    { name: 'qty', value: 100 },
    { name: 'account', value: 'ACC12345678', masked: false },
  ];

  if (bundle) {
    const canon = Object.fromEntries(bundle.map((u) => [u.label || u.id, u.id]));
    usages = [
      { name: canon['Ticker Symbol'] || 'ticker', value: 'aapl' },
      { name: canon['Order Side'] || 'order_side', value: 'long' },
      { name: canon['Order Quantity'] || 'quantity', value: 100 },
      { name: canon['Trading Account ID'] || 'account_id', value: 'ACC12345678', masked: false },
    ];
  }

  if (feedback) {
    usages = usages.map((u) => {
      if (/ticker|sym/i.test(u.name)) return { ...u, value: 'AAPL' };
      if (/order_side|side/i.test(u.name)) return { ...u, value: 'buy' };
      if (/account/i.test(u.name)) return { ...u, masked: true };
      return u;
    });
  }
  return usages;
}

function shippedErrors(result) {
  return result.violations.length;
}

function runWithProtocol() {
  banner('WITH SemanticAnchor  (inject + gate + re-inject loop)');

  const bound = call('bind_constraints', { aliases: MENTIONED });
  log('Planner', `bind_constraints → ${bound.stats.resolved} resolved, ${bound.stats.unresolved} unresolved`);
  console.log('  inject.systemPrefix:', bound.injection.systemPrefix.map((u) => u.id).join(', '));

  let usages = coderAgent({ bundle: bound.bundle });
  let result = call('verify_usage', { usages });
  log('Gate', `pass=${result.ok}  violations=${result.summary.violations}  unverifiable=${result.summary.unverifiable}`);
  console.log(indent(result.feedback));

  let round = 1;
  while (!result.ok && round <= 3) {
    round++;
    usages = coderAgent({ bundle: bound.bundle, feedback: result.feedback });
    result = call('verify_usage', { usages });
    log('Gate', `retry ${round - 1}: pass=${result.ok}  violations=${result.summary.violations}`);
  }

  console.log(`\n  RESULT: shipped with ${shippedErrors(result)} semantic error(s) after ${round - 1} retry(ies).`);
  return shippedErrors(result);
}

function runNaive() {
  banner('NAIVE baseline  (prompt-only, no resolve / no gate)');
  const usages = coderAgent({});
  const measure = call('verify_usage', { usages });
  log('Coder', 'emitted usages with no constraint guidance');
  console.log(indent(measure.feedback));
  console.log(`\n  RESULT: shipped with ${shippedErrors(measure)} semantic error(s) — nothing caught them.`);
  return shippedErrors(measure);
}

function banner(t) { console.log(`\n${'='.repeat(72)}\n  ${t}\n${'='.repeat(72)}`); }
function log(who, msg) { console.log(`  [${who}] ${msg}`); }
function indent(s) { return s.split('\n').map((l) => '    ' + l).join('\n'); }

console.log(`TASK: ${TASK}`);
if (process.argv.includes('--naive')) {
  runNaive();
} else {
  const shipped = runWithProtocol();
  const naive = runNaive();
  banner('CRASH-TEST SUMMARY');
  console.log(`  prompt-only baseline : ${naive} semantic error(s) shipped`);
  console.log(`  with SemanticAnchor  : ${shipped} semantic error(s) shipped`);
  console.log('\n  Conclusion: a structured contract + an environment gate converges the agent');
  console.log('  to zero shipped semantic errors. Injection raised the floor; the gate guaranteed it.\n');
}
