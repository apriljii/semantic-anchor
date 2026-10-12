/**
 * Live walkthrough data — shared by CLI demos and preview server API.
 */

const path = require('path');
const { createStore } = require('../src/protocol/constraint-store');
const { createDispatcher } = require('../src/dispatch');
const { deriveFromTypescript } = require('../examples/derived/scan-typescript');

const ROOT = path.join(__dirname, '..');

const CASE_CONFIG = {
  quant: {
    constraints: path.join(ROOT, 'examples/quant/constraints.json'),
    scenario: path.join(ROOT, 'examples/quant/limit-buy/scenario.js'),
    apiTs: path.join(ROOT, 'examples/quant/limit-buy/artifacts/oms-api.ts'),
    signatureAlias: 'submit order',
  },
  broker: {
    constraints: path.join(ROOT, 'examples/broker/constraints.json'),
    scenario: path.join(ROOT, 'examples/broker/settlement-record/scenario.js'),
    apiTs: path.join(ROOT, 'examples/broker/settlement-record/artifacts/broker-api.ts'),
    signatureAlias: '录入清算',
  },
};

function loadDeclaredOnly(constraintsPath) {
  const all = require(constraintsPath);
  return { units: all.units.filter((u) => u.provenance !== 'derived') };
}

function measure(store, usages) {
  const call = createDispatcher(store);
  const result = call('verify_usage', { usages });
  return {
    ok: result.ok,
    violations: result.summary.violations,
    hardFailures: result.summary.hardFailures,
    feedback: result.feedback,
    codes: result.violations.map((v) => v.code),
  };
}

function getWalkthroughData(caseId) {
  const cfg = CASE_CONFIG[caseId];
  if (!cfg) throw new Error(`Unknown case: ${caseId}`);

  const scenario = require(cfg.scenario);
  const derivedUnits = deriveFromTypescript(cfg.apiTs);

  const store = createStore();
  store.load(loadDeclaredOnly(cfg.constraints));
  const call = createDispatcher(store);

  const bindDeclared = call('bind_constraints', { aliases: scenario.MENTIONED });
  const bindWithDerived = call('bind_constraints', {
    aliases: [...scenario.MENTIONED, cfg.signatureAlias],
    extraConstraints: derivedUnits,
  });

  const naive = measure(store, scenario.usages('naive'));
  const draft = measure(store, scenario.usages('draft'));
  const fixed = measure(store, scenario.usages('fixed'));

  return {
    caseId,
    task: scenario.TASK,
    mentioned: scenario.MENTIONED,
    derivedUnits,
    bindDeclared: {
      stats: bindDeclared.stats,
      injection: {
        systemPrefix: bindDeclared.injection.systemPrefix.map((u) => u.id),
        justInTime: bindDeclared.injection.justInTime.map((u) => u.id),
      },
      bundle: bindDeclared.bundle,
    },
    bindWithDerived: {
      stats: bindWithDerived.stats,
      injection: {
        systemPrefix: bindWithDerived.injection.systemPrefix.map((u) => u.id),
        justInTime: bindWithDerived.injection.justInTime.map((u) => u.id),
      },
      bundle: bindWithDerived.bundle,
    },
    metrics: {
      naiveErrors: naive.violations,
      draftErrors: draft.violations,
      fixedErrors: fixed.violations,
    },
    verify: { naive, draft, fixed },
  };
}

module.exports = { getWalkthroughData, CASE_CONFIG };
