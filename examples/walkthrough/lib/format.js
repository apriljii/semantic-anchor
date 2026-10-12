const GREY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

function banner(title) {
  const line = '='.repeat(72);
  console.log(`\n${line}\n  ${BOLD}${title}${RESET}\n${line}`);
}

function step(n, title) {
  console.log(`\n${CYAN}${BOLD}── Step ${n}${RESET} ${BOLD}${title}${RESET}\n`);
}

function log(role, msg) {
  console.log(`  ${GREY}[${role}]${RESET} ${msg}`);
}

function indent(text, spaces = 4) {
  const pad = ' '.repeat(spaces);
  return String(text)
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

function codeBlock(source, { title, annotations = [] } = {}) {
  if (title) console.log(`  ${BOLD}${title}${RESET}`);
  const lines = source.trimEnd().split('\n');
  lines.forEach((line, i) => {
    const n = String(i + 1).padStart(2, ' ');
    const hit = annotations.find((a) => line.includes(a.line));
    const mark = hit ? ` ${RED}// ← ${hit.issue}${RESET}` : '';
    console.log(`  ${GREY}${n}${RESET} ${line}${mark}`);
  });
  console.log('');
}

function jsonBlock(obj) {
  console.log(indent(JSON.stringify(obj, null, 2)));
  console.log('');
}

function verdict(ok, violations) {
  if (ok) console.log(`  ${GREEN}✓ Gate pass${RESET} — 0 shipped semantic errors`);
  else console.log(`  ${RED}✗ Gate fail${RESET} — ${violations} violation(s) to fix before ship`);
}

module.exports = {
  banner,
  step,
  log,
  indent,
  codeBlock,
  jsonBlock,
  verdict,
  colors: { RED, GREEN, YELLOW, RESET },
};
