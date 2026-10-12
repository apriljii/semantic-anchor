#!/usr/bin/env node
/**
 * Broker derived constraints walkthrough.
 * Run: npm run demo:derived:broker
 */

const path = require('path');
const { createStore } = require('../../src/protocol/constraint-store');
const { createSemanticGate } = require('../harness-hook/semantic-gate');
const { deriveFromTypescript } = require('../derived/scan-typescript');
const scenario = require('../broker/settlement-record/scenario');
const fmt = require('./lib/format');

const API = path.join(__dirname, '../broker/settlement-record/artifacts/broker-api.ts');

async function run() {
  fmt.banner('Derived Constraints · Broker Settlement');

  const all = require('../broker/constraints.json');
  const store = createStore();
  store.load({ units: all.units.filter((u) => u.provenance !== 'derived') });
  const gate = createSemanticGate(store);

  const derived = deriveFromTypescript(API);
  fmt.log('Scanner', `derived ${derived.length} unit(s) from broker-api.ts`);
  fmt.jsonBlock(derived);

  const bound = gate.bind({
    aliases: [...scenario.MENTIONED, '录入清算'],
    extraConstraints: derived,
  });
  fmt.log('Bind', `systemPrefix=${bound.injection.systemPrefix.map((u) => u.id).join(', ')}`);
  fmt.log('Inject JIT', bound.injection.justInTime.map((u) => u.id).join(', '));

  const outcome = await gate.enforce(scenario.usages('draft'), {
    retry: () => scenario.usages('fixed'),
  });

  fmt.banner(outcome.ok ? 'PASS' : 'FAIL');
  console.log(`  attempts=${outcome.attempts}  violations=${outcome.result.summary.violations}\n`);
  if (!outcome.ok) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
