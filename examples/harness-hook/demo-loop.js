#!/usr/bin/env node
/**
 * End-to-end harness loop using semantic-gate middleware (no simulated LLM).
 *
 * Run: npm run demo:harness
 */

const { createStore } = require('../../src/protocol/constraint-store');
const { createSemanticGate } = require('../harness-hook/semantic-gate');
const scenario = require('../quant/limit-buy/scenario');

const store = createStore();
store.load(require('../quant/constraints.json'));
const gate = createSemanticGate(store, { maxRetries: 2 });

async function main() {
  console.log('\n=== Harness Hook Demo ===\n');

  const { bundle, injection } = gate.bind({ aliases: scenario.MENTIONED });
  console.log('[bind]', bundle.map((u) => u.id).join(', '));
  console.log('[inject] systemPrefix:', injection.systemPrefix.map((u) => u.id).join(', '));

  const outcome = await gate.enforce(scenario.usages('draft'), {
    retry: (_feedback, n) => {
      console.log(`[retry ${n}] applying fixed profile`);
      return scenario.usages('fixed');
    },
  });

  console.log('[gate]', outcome.ok ? 'PASS' : 'FAIL', `attempts=${outcome.attempts}`);
  console.log('');
  process.exitCode = outcome.ok ? 0 : 1;
}

main();
