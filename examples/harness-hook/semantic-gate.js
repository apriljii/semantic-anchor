/**
 * Harness middleware — semantic constraint gate for an agent loop.
 *
 * Usage:
 *   const gate = createSemanticGate(store);
 *   const { bundle, injection } = gate.bind({ aliases, extraConstraints });
 *   // ... model generates usages ...
 *   const outcome = gate.enforce(usages, { retry: () => nextUsages });
 */

const { createDispatcher } = require('../../src/dispatch');

function createSemanticGate(store, opts = {}) {
  const call = createDispatcher(store);
  const maxRetries = opts.maxRetries ?? 3;

  return {
    /** Pre-action: resolve + bind (+ optional derived units). */
    bind({ aliases = [], extraConstraints = [] } = {}) {
      const result = call('bind_constraints', { aliases, extraConstraints });
      return {
        bundle: result.bundle,
        unresolved: result.unresolved,
        injection: result.injection,
        stats: result.stats,
      };
    },

    /**
     * Post-action: verify → feedback → optional retry until pass or cap.
     * @param {object[]} usages
     * @param {{ retry?: (feedback: string, attempt: number) => object[] | Promise<object[]>, environment?: Function }} hooks
     */
    async enforce(usages, hooks = {}) {
      let attempt = 0;
      let current = usages;

      while (attempt <= maxRetries) {
        const result = call('verify_usage', {
          usages: current,
          environment: hooks.environment,
        });

        if (result.ok) {
          return { ok: true, usages: current, result, attempts: attempt };
        }

        if (attempt >= maxRetries || typeof hooks.retry !== 'function') {
          return { ok: false, usages: current, result, attempts: attempt };
        }

        attempt++;
        const next = await hooks.retry(result.feedback, attempt);
        if (!Array.isArray(next)) {
          throw new Error('retry hook must return usages array');
        }
        current = next;
      }

      return { ok: false, usages: current, result: call('verify_usage', { usages: current, environment: hooks.environment }), attempts: attempt };
    },

    /** Raw tool access when harness needs resolve / get_constraint. */
    callTool(name, args) {
      return call(name, args);
    },
  };
}

module.exports = { createSemanticGate };
