/**
 * Derive ConstraintUnits from TypeScript API stubs (reference adapter).
 *
 * Production harness would use tsserver / ts-morph / OpenAPI parser.
 * This demo uses a lightweight regex scan so the repo stays dependency-free.
 */

const fs = require('fs');

/**
 * Scan an OmsClient-style interface and emit a derived signature ConstraintUnit.
 * @param {string} filePath
 * @returns {object[]} derived ConstraintUnits
 */
function deriveFromTypescript(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const units = [];

  const methodRe = /(\w+)\s*\(\s*\w+\s*:\s*\{([^}]+)\}\s*\)\s*:\s*Promise<\{([^}]+)\}>/s;
  const m = methodRe.exec(src);
  if (!m) return units;

  const methodName = m[1];
  const paramsBlock = m[2];
  const returnsBlock = m[3];

  const paramNames = [];
  for (const line of paramsBlock.split('\n')) {
    const pm = /^\s*(\w+)\s*:/.exec(line.trim());
    if (pm) paramNames.push(pm[1]);
  }

  const returnMatch = /(\w+)\s*:/.exec(returnsBlock.trim());
  const returnRef = returnMatch ? returnMatch[1] : 'order_id';

  const id = methodName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  const canonicalId = id === 'submit_order' ? 'submit_order' : id;

  units.push({
    id: canonicalId,
    kind: 'signature',
    label: methodName,
    aliases: [methodName],
    type: 'object',
    provenance: 'derived',
    source: 'typescript',
    members: [
      ...paramNames.map((ref, i) => ({
        role: 'param',
        ref,
        position: i,
        required: !paramsBlock.includes(`${ref}?`),
      })),
      { role: 'returns', ref: returnRef },
    ],
  });

  return units;
}

module.exports = { deriveFromTypescript };
