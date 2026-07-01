/**
 * resolve — anchor a fuzzy alias to a canonical ConstraintUnit.
 *
 * This is the BEST-EFFORT half of the protocol. It is allowed to miss.
 * It must never throw on a miss and must never invent a constraint.
 *
 * Closed-world (field-registry) miss  → "register the field" (flywheel).
 * Open-world (here)            miss  → status:'unresolved' + candidates,
 *                                      and the caller proceeds; verify_usage
 *                                      is what actually guarantees correctness.
 *
 * Match precedence (migrated from field-service.resolveAlias):
 *   1. exact alias / id / label / mapping-name
 *   2. fuzzy substring candidates (ranked), returned but NOT auto-applied
 */

function levenshteinish(a, b) {
  // Cheap similarity: longer common-substring-ish score. Good enough for ranking.
  if (a === b) return 1;
  if (!a || !b) return 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let hits = 0;
  for (const ch of new Set(shorter)) if (longer.includes(ch)) hits++;
  return hits / longer.length;
}

function resolve(store, alias, opts = {}) {
  const limit = opts.limit || 5;
  const key = store.norm(alias);

  // 1. Exact match (deterministic anchor).
  if (store.aliasIndex[key]) {
    const id = store.aliasIndex[key];
    const unit = store.get(id);
    return {
      status: 'resolved',
      id,
      provenance: unit.provenance,
      match: 'exact',
      unit,
    };
  }

  // 2. Fuzzy candidates — surfaced for the model/caller, never auto-applied.
  const candidates = store
    .all()
    .map((u) => {
      const names = [u.id, u.label, ...(u.aliases || [])].filter(Boolean).map(store.norm);
      const score = Math.max(...names.map((n) => levenshteinish(key, n)), 0);
      return { id: u.id, label: u.label || u.id, provenance: u.provenance, score };
    })
    .filter((c) => c.score > 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 3. Miss is normal in open-world. Hand control back, don't error.
  return {
    status: 'unresolved',
    alias,
    candidates,
    note:
      'No declared constraint anchors this alias. This is expected in open-world tasks. ' +
      'Proceed, but the generated usage MUST still pass verify_usage — that is the guarantee, ' +
      'not this resolution.',
  };
}

module.exports = { resolve };
