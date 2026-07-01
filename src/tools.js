/**
 * The 4 SemanticAnchor MCP tools.
 *
 * Migrated from field-registry's 16-tool surface, intentionally cut to the protocol
 * core: two best-effort tools (resolve, get_constraint, bind_constraints) and one
 * guarantee tool (verify_usage). Financial / low-code tools (generate_mapping,
 * match_scene, compile_schema, suggest_field, ...) are deliberately NOT exposed —
 * they are product surface, not protocol.
 */

const tools = {
  resolve: {
    name: 'resolve',
    description:
      'Anchor a fuzzy alias (a natural-language or system name) to a canonical ConstraintUnit id. ' +
      'BEST-EFFORT: a miss is normal in open-world tasks and returns status:"unresolved" with ' +
      'candidates — never an error, never an invented constraint. Use this to stop the model from ' +
      'guessing names. Correctness is still enforced by verify_usage, not by this call.',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'The name to anchor, e.g. "ticker symbol", "sym".' },
        limit: { type: 'number', description: 'Max fuzzy candidates to return on a miss (default 5).' },
      },
      required: ['alias'],
    },
  },

  get_constraint: {
    name: 'get_constraint',
    description:
      'Fetch the full ConstraintUnit for a canonical id: type, shape constraints, legal enum values, ' +
      'policies (sensitive/pii/...), and cross-context mappings. Returns null if the id is unknown.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Canonical ConstraintUnit id, e.g. "ticker".' },
      },
      required: ['id'],
    },
  },

  bind_constraints: {
    name: 'bind_constraints',
    description:
      'INJECTION (pre-action) half. Given the entities a task mentions, assemble a compact, ' +
      'model-readable constraint bundle plus guidance on WHERE to inject it (stable system prefix ' +
      'vs just-in-time). Also reports which aliases stayed unresolved (the blind spots). Injection ' +
      'raises first-pass correctness; it does not guarantee it.',
    inputSchema: {
      type: 'object',
      properties: {
        aliases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Entity names mentioned by the task/intent.',
        },
        extraConstraints: {
          type: 'array',
          items: { type: 'object' },
          description:
            'Optional derived/emergent ConstraintUnits supplied by the caller (e.g. a type pulled ' +
            'from the live AST, or a session rule like "keep API backward compatible").',
        },
      },
      required: ['aliases'],
    },
  },

  verify_usage: {
    name: 'verify_usage',
    description:
      'GUARANTEE (post-action) half. Adjudicate what a generated artifact actually used against the ' +
      'constraint contract: type, pattern, range, length, format, checksum, enum values, and policy ' +
      'obligations. Also catches NON_CANONICAL_NAME drift and reports NO_ANCHOR open-world unknowns. ' +
      'Returns STRUCTURED violations + ready-to-reinject feedback. Accepts an optional environment ' +
      'adjudicator (tsc/pytest/eslint) normalized into the same shape.',
    inputSchema: {
      type: 'object',
      properties: {
        usages: {
          type: 'array',
          description: 'What the artifact used. Each item: { name|id, value?, masked? }.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Raw name the model emitted.' },
              id: { type: 'string', description: 'Canonical id, if the caller already resolved it.' },
              value: { description: 'Optional produced value to check against the contract.' },
              masked: { type: 'boolean', description: 'Set true if a sensitive value was masked/redacted.' },
            },
          },
        },
      },
      required: ['usages'],
    },
  },
};

module.exports = { tools };
