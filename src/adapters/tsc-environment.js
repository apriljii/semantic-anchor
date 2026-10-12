/**
 * Environment adjudicator adapter — normalize tsc (TypeScript compiler) output
 * into verify_usage's structured violation shape.
 *
 * Harness wiring:
 *   verify_usage({ usages, environment: createTscAdjudicator({ file, diagnostics }) })
 *
 * Real harness: run tsc --noEmit, pass parsed diagnostics here.
 * Demo/CI without typescript: pass pre-captured diagnostics (see examples/adapters/).
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

/**
 * @param {Array<{ file?: string, line?: number, column?: number, code?: string, message: string }>} diagnostics
 * @returns {Array<object>} violations
 */
function normalizeTscDiagnostics(diagnostics = []) {
  return diagnostics.map((d) => ({
    severity: 'violation',
    code: 'ENV_TSC',
    source: 'typescript',
    file: d.file,
    line: d.line,
    column: d.column,
    tscCode: d.code,
    message: d.message,
  }));
}

/**
 * Build a verify_usage `environment` callback from tsc diagnostics.
 * @param {{ diagnostics?: object[], file?: string, projectRoot?: string, tscPath?: string }} opts
 */
function createTscAdjudicator(opts = {}) {
  let diagnostics = opts.diagnostics;

  if (!diagnostics && opts.file && opts.runTsc !== false) {
    diagnostics = tryRunTsc(opts.file, opts);
  }

  diagnostics = diagnostics || [];
  const normalized = normalizeTscDiagnostics(diagnostics);

  return function environmentAdjudicator(/* usages */) {
    return normalized;
  };
}

function tryRunTsc(file, opts) {
  if (!fs.existsSync(file)) return [];
  try {
    execFileSync(opts.tscPath || 'tsc', ['--noEmit', file], {
      cwd: opts.projectRoot || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return [];
  } catch (e) {
    if (!e.stderr && !e.stdout) return [];
    return parseTscTextOutput(e.stdout || e.stderr || '');
  }
}

/** Parse `file(line,col): error TSxxxx: message` lines from tsc stderr. */
function parseTscTextOutput(text) {
  const out = [];
  const re = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      file: m[1],
      line: Number(m[2]),
      column: Number(m[3]),
      code: m[4],
      message: m[5],
    });
  }
  return out;
}

module.exports = {
  normalizeTscDiagnostics,
  createTscAdjudicator,
  parseTscTextOutput,
};
