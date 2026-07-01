/**
 * verify_usage — adjudicate a generated artifact against the constraint contract.
 *
 * This is the GUARANTEE (post-action, must-have) half of the protocol — the
 * "action gate". It has NO equivalent in the closed-world field-registry, whose
 * "validation" was only static self-consistency (check_sensitive et al.).
 *
 * Open-world verification has two ground-truth sources:
 *   1. The constraint contract itself (deterministic checks below: type/pattern/
 *      range/length/format/checksum/enum/policy).
 *   2. The runtime ENVIRONMENT — compiler, type checker, tests, lint. These live
 *      outside the protocol; verify accepts a pluggable `environment` adjudicator
 *      so the same structured-violation shape carries tsc/pytest/eslint results.
 *
 * The output is intentionally STRUCTURED (not a raw log) so a harness can re-inject
 * it into the next agent turn. That re-injection loop is the whole point.
 *
 * Severity model:
 *   - violation     : breaks a known contract → must fix.
 *   - drift         : used a non-canonical name when a canonical anchor exists → should fix.
 *   - unverifiable  : no declared constraint anchors this usage → open-world blind spot,
 *                     reported but not a hard failure (this is the honest open-world stance).
 */

function verify(store, args = {}) {
  const usages = Array.isArray(args.usages) ? args.usages : [];
  const violations = [];
  const unverifiable = [];

  for (const u of usages) {
    const raw = u.name != null ? u.name : u.id;
    const key = store.norm(raw);
    const canonicalId = store.aliasIndex[key];

    // (a) Open-world unknown: nothing anchors this. Report, don't fail.
    if (!canonicalId) {
      unverifiable.push({
        used: raw,
        severity: 'unverifiable',
        code: 'NO_ANCHOR',
        message: `No declared constraint anchors "${raw}". Cannot verify; treat as unconstrained.`,
      });
      continue;
    }

    const unit = store.get(canonicalId);

    // (b) Semantic drift: a canonical id exists but the model emitted a different name.
    if (store.norm(canonicalId) !== key) {
      violations.push({
        severity: 'drift',
        id: canonicalId,
        code: 'NON_CANONICAL_NAME',
        used: raw,
        expected: canonicalId,
        message: `"${raw}" should be the canonical id "${canonicalId}".`,
      });
    }

    // (c) Contract checks against the value, if a value was produced.
    if ('value' in u && u.value != null) {
      checkValue(unit, u.value).forEach((v) => violations.push({ id: canonicalId, ...v }));
    }

    // (d) Policy obligations the harness must honor (e.g. sensitive must be marked handled).
    if ((unit.policies || []).includes('sensitive') && u.masked !== true) {
      violations.push({
        severity: 'violation',
        id: canonicalId,
        code: 'SENSITIVE_NOT_HANDLED',
        message: `"${canonicalId}" is sensitive; usage must mark masked:true (mask/redact before output).`,
      });
    }
  }

  // (e) Pluggable environment adjudicator: tsc / pytest / eslint results, normalized
  //     into the same structured-violation shape. Demo passes a stub; real harness wires a tool.
  if (typeof args.environment === 'function') {
    for (const v of args.environment(usages) || []) violations.push(v);
  }

  const hardFails = violations.filter((v) => v.severity === 'violation');
  return {
    ok: hardFails.length === 0,
    violations,
    unverifiable,
    summary: {
      checked: usages.length,
      violations: violations.length,
      hardFailures: hardFails.length,
      unverifiable: unverifiable.length,
    },
    // What the harness should put in front of the model next turn.
    feedback: buildFeedback(violations, unverifiable),
  };
}

function checkValue(unit, value) {
  const out = [];
  const c = unit.constraints || {};
  const s = String(value);

  if (unit.type === 'integer' && !/^-?\d+$/.test(s)) {
    out.push({ severity: 'violation', code: 'TYPE', expected: 'integer', got: s, message: `expected integer, got "${s}"` });
  }
  if (unit.type === 'decimal' && !/^-?\d+(\.\d+)?$/.test(s)) {
    out.push({ severity: 'violation', code: 'TYPE', expected: 'decimal', got: s, message: `expected decimal, got "${s}"` });
  }

  if (c.length != null && s.length !== c.length) {
    out.push({ severity: 'violation', code: 'LENGTH', expected: c.length, got: s.length, message: `length must be ${c.length}` });
  }
  if (c.minLength != null && s.length < c.minLength) {
    out.push({ severity: 'violation', code: 'MIN_LENGTH', expected: c.minLength, got: s.length, message: `minLength ${c.minLength}` });
  }
  if (c.maxLength != null && s.length > c.maxLength) {
    out.push({ severity: 'violation', code: 'MAX_LENGTH', expected: c.maxLength, got: s.length, message: `maxLength ${c.maxLength}` });
  }
  if (c.pattern != null && !new RegExp(c.pattern).test(s)) {
    out.push({ severity: 'violation', code: 'PATTERN', expected: c.pattern, got: s, message: c.patternMessage || `must match /${c.pattern}/` });
  }
  if (c.min != null && Number(value) < c.min) {
    out.push({ severity: 'violation', code: 'MIN', expected: c.min, got: value, message: c.minMessage || `min ${c.min}` });
  }
  if (c.max != null && Number(value) > c.max) {
    out.push({ severity: 'violation', code: 'MAX', expected: c.max, got: value, message: c.maxMessage || `max ${c.max}` });
  }
  if (c.format && !checkFormat(c.format, s)) {
    out.push({ severity: 'violation', code: 'FORMAT', expected: c.format, got: s, message: `must be a valid ${c.format}` });
  }
  if (c.checksum && !checkChecksum(c.checksum, s)) {
    out.push({ severity: 'violation', code: 'CHECKSUM', expected: c.checksum, got: s, message: `fails ${c.checksum} checksum` });
  }

  if (unit.type === 'enum' && Array.isArray(unit.values) && unit.values.length) {
    const legal = new Set(unit.values.map((v) => v.value));
    if (!legal.has(s)) {
      out.push({ severity: 'violation', code: 'ENUM', expected: [...legal], got: s, message: `"${s}" not in [${[...legal].join(', ')}]` });
    }
  }
  return out;
}

const FORMATS = {
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  phone: /^\+?[0-9][0-9\-\s]{6,18}$/,
  url: /^https?:\/\/[^\s]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  'iso8601-date': /^\d{4}-\d{2}-\d{2}$/,
  'iso8601-datetime': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
};
function checkFormat(fmt, s) {
  const re = FORMATS[fmt];
  return re ? re.test(s) : true;
}

function checkChecksum(algo, s) {
  if (algo === 'luhn') {
    const digits = s.replace(/\D/g, '');
    if (!digits) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = Number(digits[i]);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }
  return true; // unimplemented algos are not enforced here
}

function buildFeedback(violations, unverifiable) {
  if (!violations.length && !unverifiable.length) {
    return 'All usages conform to the bound constraints.';
  }
  const lines = [];
  for (const v of violations) {
    lines.push(`[${v.severity.toUpperCase()}] ${v.code}: ${v.message}`);
  }
  for (const u of unverifiable) {
    lines.push(`[UNVERIFIABLE] ${u.code}: ${u.message}`);
  }
  lines.push(
    'Fix the VIOLATION/DRIFT items and re-submit. UNVERIFIABLE items are open-world blind spots — ' +
      'either ask the user, or proceed knowingly.'
  );
  return lines.join('\n');
}

module.exports = { verify };
