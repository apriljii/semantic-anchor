#!/usr/bin/env node
/**
 * Walkthrough: declared bind + derived extraConstraints + harness gate middleware.
 *
 * Run: npm run demo:derived
 */

const path = require('path');
const { createStore } = require('../../src/protocol/constraint-store');
const { createSemanticGate } = require('../harness-hook/semantic-gate');
const { deriveFromTypescript } = require('../derived/scan-typescript');
const scenario = require('../quant/limit-buy/scenario');
const fmt = require('../walkthrough/lib/format');

const OMS_API = path.join(__dirname, '../quant/limit-buy/artifacts/oms-api.ts');

function main() {
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}

async function run() {
  fmt.banner('Derived Constraints + Harness Gate');

  // Store with declared units only (exclude derived signature for demo clarity)
  const all = require('../quant/constraints.json');
  const declaredOnly = {
    units: all.units.filter((u) => u.provenance !== 'derived'),
  };

  const store = createStore();
  store.load(declaredOnly);
  const gate = createSemanticGate(store);

  fmt.step(1, 'Harness · scan TypeScript → derived ConstraintUnits');
  const derived = deriveFromTypescript(OMS_API);
  fmt.log('Scanner', `derived ${derived.length} unit(s) from oms-api.ts`);
  fmt.jsonBlock(derived);

  fmt.step(2, 'Planner · bind with extraConstraints (declared + derived)');
  const bound = gate.bind({
    aliases: [...scenario.MENTIONED, 'submit order'],
    extraConstraints: derived,
  });
  fmt.log('Bind', `${bound.stats.resolved} resolved · systemPrefix=${bound.injection.systemPrefix.length} · justInTime=${bound.injection.justInTime.length}`);
  console.log(`  ${fmt.colors.YELLOW}systemPrefix (declared):${fmt.colors.RESET} ${bound.injection.systemPrefix.map((u) => u.id).join(', ')}`);
  console.log(`  ${fmt.colors.YELLOW}justInTime (derived):${fmt.colors.RESET} ${bound.injection.justInTime.map((u) => u.id).join(', ')}`);

  fmt.step(3, 'Harness gate · draft usages → feedback → retry');
  const outcome = await gate.enforce(scenario.usages('draft'), {
    retry: (feedback, attempt) => {
      fmt.log('Retry', `attempt ${attempt} — model reads feedback`);
      console.log(fmt.indent(feedback.split('\n').slice(0, 4).join('\n') + '\n    ...'));
      return scenario.usages('fixed');
    },
  });

  fmt.banner('Outcome');
  if (outcome.ok) {
    console.log(`  ${fmt.colors.GREEN}✓ Gate passed after ${outcome.attempts} retry(ies)${fmt.colors.RESET}`);
    console.log(`  violations=${outcome.result.summary.violations}\n`);
  } else {
    console.log(`  ${fmt.colors.RED}✗ Gate failed after ${outcome.attempts ?? '?'} attempt(s)${fmt.colors.RESET}\n`);
    if (outcome.result?.feedback) console.log(fmt.indent(outcome.result.feedback));
    process.exitCode = 1;
  }
}

main();
