#!/usr/bin/env node
/**
 * Real-scenario walkthrough: quant limit-buy order submission.
 *
 * Shows the full story with actual TypeScript artifacts a Coder Agent would emit:
 *   task → bind bundle → naive code → gate → draft code → feedback → fixed code
 *
 * Run: npm run demo:walkthrough
 */

const path = require('path');
const { createStore } = require('../../src/protocol/constraint-store');
const { createDispatcher } = require('../../src/dispatch');
const scenario = require('../quant/limit-buy/scenario');
const fmt = require('./lib/format');

const store = createStore();
store.load(require('../quant/constraints.json'));
const call = createDispatcher(store);

function compactBundle(bundle) {
  return bundle.map((u) => ({
    id: u.id,
    kind: u.kind,
    type: u.type,
    provenance: u.provenance,
    constraints: u.constraints,
    values: u.values,
  }));
}

function showVerify(role, usages) {
  const result = call('verify_usage', { usages });
  fmt.log(role, `verify_usage → pass=${result.ok}  violations=${result.summary.violations}`);
  if (result.feedback) console.log(fmt.indent(result.feedback));
  fmt.verdict(result.ok, result.summary.violations);
  return result;
}

function main() {
  fmt.banner('SemanticAnchor Walkthrough · Limit Buy on AAPL');

  console.log(`  ${fmt.colors.YELLOW}Scenario${fmt.colors.RESET}`);
  console.log(fmt.indent(scenario.TASK));

  // ── Step 1: Planner binds constraints ──
  fmt.step(1, 'Planner · bind_constraints (抛锚)');
  const bound = call('bind_constraints', { aliases: scenario.MENTIONED });
  fmt.log('Planner', `${bound.stats.resolved} resolved, ${bound.stats.unresolved} unresolved`);
  fmt.log('Inject', 'systemPrefix ids: ' + bound.injection.systemPrefix.map((u) => u.id).join(', '));
  console.log(`  ${fmt.colors.YELLOW}Bundle passed to Coder Agent:${fmt.colors.RESET}`);
  fmt.jsonBlock(compactBundle(bound.bundle));

  // ── Step 2: Naive baseline (no protocol in the loop) ──
  fmt.step(2, 'Naive Coder · prompt-only (无 bind / 无 gate 循环)');
  fmt.codeBlock(scenario.readArtifact('naive'), {
    title: 'Generated code (examples/quant/limit-buy/artifacts/naive.ts)',
    annotations: scenario.ANNOTATIONS.naive,
  });
  fmt.log('Harness', 'Pipeline ships without calling verify in the loop.');
  const naiveUsages = scenario.usages('naive');
  const naiveMeasure = call('verify_usage', { usages: naiveUsages });
  fmt.log('Post-mortem', `If we measure after ship: ${naiveMeasure.summary.violations} semantic error(s)`);
  console.log(fmt.indent(naiveMeasure.feedback));
  console.log(`  ${fmt.colors.RED}→ ${naiveMeasure.summary.violations} errors would reach production. Nothing caught them.${fmt.colors.RESET}\n`);

  // ── Step 3: With protocol — first generation ──
  fmt.step(3, 'Protocol Coder · after bundle inject (命名收敛，值仍错)');
  fmt.codeBlock(scenario.readArtifact('draft'), {
    title: 'Generated code (artifacts/draft.ts)',
    annotations: scenario.ANNOTATIONS.draft,
  });
  const draftResult = showVerify('Gate', scenario.usages('draft'));

  // ── Step 4: Retry from structured feedback ──
  fmt.step(4, 'Coder retry · reads structured feedback (Gate 回注)');
  console.log(fmt.indent('Fix: AAPL · buy · mask account_id in logs'));
  fmt.codeBlock(scenario.readArtifact('fixed'), {
    title: 'Generated code (artifacts/fixed.ts)',
  });
  const fixedResult = showVerify('Gate', scenario.usages('fixed'));

  // ── Summary ──
  fmt.banner('Summary');
  console.log(`  Prompt-only pipeline     ${fmt.colors.RED}${naiveMeasure.summary.violations} shipped errors${fmt.colors.RESET}`);
  console.log(`  SemanticAnchor loop      ${fmt.colors.GREEN}${fixedResult.summary.violations} shipped errors${fmt.colors.RESET}`);
  console.log('\n  Injection fixed naming drift before first compile.');
  console.log('  Gate caught value/policy bugs injection alone missed.');
  console.log('  Structured feedback drove one retry to converge.\n');
  console.log(`  Artifacts: ${path.relative(process.cwd(), path.join(__dirname, '../quant/limit-buy/artifacts'))}/`);
  console.log('  Interactive: npm run preview → /walkthrough.html\n');
}

main();
