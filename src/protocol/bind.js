/**
 * bind_constraints — assemble an injectable constraint bundle for a task context.
 *
 * This is the INJECTION (pre-action, best-effort) half of the protocol — the
 * "constraint router". Abstracted from field-registry's scene-service bundle
 * assembly, with all low-code/schema-compile concepts removed.
 *
 * Given the entities a task mentions (aliases) plus optional already-known
 * emergent/derived constraints, it:
 *   - resolves each alias (best-effort),
 *   - collects the resolved ConstraintUnits,
 *   - records which aliases stayed unresolved (so the caller knows the blind spots),
 *   - emits a compact, model-readable bundle + guidance on WHERE to inject it.
 *
 * Injection is an optimization, not a guarantee. The bundle is meant to raise
 * first-pass correctness; verify_usage is what actually enforces it.
 */

const { resolve } = require('./resolve');

function bind(store, args = {}) {
  const aliases = Array.isArray(args.aliases) ? args.aliases : [];
  const extra = Array.isArray(args.extraConstraints) ? args.extraConstraints : [];

  const resolved = [];
  const unresolved = [];
  const seen = new Set();

  for (const alias of aliases) {
    const r = resolve(store, alias);
    if (r.status === 'resolved') {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        resolved.push(compact(r.unit));
      }
    } else {
      unresolved.push({ alias, candidates: r.candidates });
    }
  }

  // Emergent/derived units passed in by the caller (e.g. "keep API backward compatible",
  // or a type pulled from the live AST). They join the bundle with their provenance intact.
  for (const u of extra) {
    if (u && u.id && !seen.has(u.id)) {
      seen.add(u.id);
      resolved.push(compact(u));
    }
  }

  return {
    bundle: resolved,
    unresolved,
    stats: {
      requested: aliases.length,
      resolved: resolved.length,
      unresolved: unresolved.length,
    },
    injection: {
      // Stable, cacheable constraints go in the system prefix; volatile ones go just-in-time.
      systemPrefix: resolved.filter((u) => u.provenance === 'declared'),
      justInTime: resolved.filter((u) => u.provenance !== 'declared'),
      guidance:
        'Inject `systemPrefix` units once as a stable, KV-cache-friendly prefix. Inject ' +
        '`justInTime` units next to the action that needs them. Unresolved aliases are blind ' +
        'spots — do not fabricate constraints for them; rely on verify_usage to catch misuse.',
    },
  };
}

/** Strip a ConstraintUnit down to what a model needs at generation time. */
function compact(unit) {
  const out = {
    id: unit.id,
    kind: unit.kind || 'field',
    type: unit.type,
    provenance: unit.provenance,
  };
  if (unit.label) out.label = unit.label;
  if (unit.constraints && Object.keys(unit.constraints).length) out.constraints = unit.constraints;
  if (unit.values && unit.values.length) out.values = unit.values.map((v) => v.value);
  if (unit.policies && unit.policies.length) out.policies = unit.policies;
  if (unit.mappings && unit.mappings.length) {
    out.mappings = unit.mappings.map((m) => ({ context: m.context, name: m.name }));
  }
  // Composite entities (signature/endpoint) must carry their structure, else the
  // model loses arity/order/return when the bundle is injected.
  if (unit.members && unit.members.length) {
    out.members = unit.members.map((m) => ({
      role: m.role,
      ref: m.ref,
      ...(m.position != null ? { position: m.position } : {}),
      ...(m.required ? { required: true } : {}),
    }));
  }
  return out;
}

module.exports = { bind, compact };
