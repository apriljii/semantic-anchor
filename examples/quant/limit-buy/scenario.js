/**
 * Limit-buy walkthrough scenario — shared by CLI walkthrough + crash-test demo.
 *
 * The "real" part: each profile maps to an on-disk TypeScript artifact that looks
 * like what a Coder Agent would emit. verify_usage still adjudicates structured
 * usages (what a harness extracts from generated code before ship).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const ART = path.join(ROOT, 'artifacts');

const TASK =
  'Implement a limit buy order submission for AAPL @ 178.50: ' +
  'ticker symbol, order side, quantity, and trading account id.';

const MENTIONED = ['ticker symbol', 'order side', 'quantity', 'account', 'limit price'];

/** Structured field usages extracted from generated code (harness view). */
const PROFILES = {
  naive: [
    { name: 'sym', value: 'aapl' },
    { name: 'side', value: 'long' },
    { name: 'qty', value: 100 },
    { name: 'account', value: 'ACC12345678', masked: false },
    { name: 'placeOrder', kind: 'call' },
    { name: 'cancelAllOrders', kind: 'call' },
  ],
  draft: [
    { name: 'ticker', value: 'aapl' },
    { name: 'order_side', value: 'long' },
    { name: 'quantity', value: 100 },
    { name: 'account_id', value: 'ACC12345678', masked: false },
    { name: 'submitOrder', kind: 'call' },
  ],
  fixed: [
    { name: 'ticker', value: 'AAPL' },
    { name: 'order_side', value: 'buy' },
    { name: 'quantity', value: 100 },
    { name: 'account_id', value: 'ACC12345678', masked: true },
    { name: 'submit_order', kind: 'call', args: [
      { name: 'ticker' },
      { name: 'order_side' },
      { name: 'quantity' },
      { name: 'order_type' },
      { name: 'limit_price' },
      { name: 'account_id' },
    ] },
  ],
};

function readArtifact(name) {
  return fs.readFileSync(path.join(ART, `${name}.ts`), 'utf8');
}

function usages(profile) {
  const list = PROFILES[profile];
  if (!list) throw new Error(`Unknown profile: ${profile}`);
  return list.map((u) => ({ ...u }));
}

/** Annotation hints for walkthrough UI (line substring → issue). */
const ANNOTATIONS = {
  naive: [
    { line: 'sym:', issue: 'drift → ticker' },
    { line: "'aapl'", issue: 'pattern → AAPL' },
    { line: 'side:', issue: 'drift → order_side' },
    { line: "'long'", issue: 'enum → buy' },
    { line: 'qty:', issue: 'drift → quantity' },
    { line: 'account:', issue: 'drift → account_id; sensitive leak' },
    { line: 'placeOrder', issue: 'drift → submit_order (alias resolves)' },
    { line: 'cancelAllOrders', issue: 'SYMBOL_NOT_FOUND' },
  ],
  draft: [
    { line: "'aapl'", issue: 'pattern → AAPL' },
    { line: "'long'", issue: 'enum → buy' },
    { line: 'console.log', issue: 'account_id not masked in output' },
    { line: 'submitOrder', issue: 'SYMBOL_NOT_FOUND → submit_order' },
  ],
  fixed: [],
};

module.exports = {
  TASK,
  MENTIONED,
  readArtifact,
  usages,
  ANNOTATIONS,
  PROFILES,
};
