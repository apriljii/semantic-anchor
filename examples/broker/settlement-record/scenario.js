/**
 * Settlement-record walkthrough scenario — broker retail case.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const ART = path.join(ROOT, 'artifacts');

const TASK =
  'Implement a retail client trade settlement record: client ID, security code, ' +
  'trade amount, settlement date, and national ID for compliance verification.';

const MENTIONED = ['client ID', 'security code', 'trade amount', 'settlement date', 'national ID'];

const PROFILES = {
  naive: [
    { name: 'custId', value: 'clt10001234' },
    { name: 'stockCode', value: '600519' },
    { name: 'amt', value: 178500 },
    { name: 'settleDt', value: '2026/03/15' },
    { name: 'idNo', value: '110101199001011234', masked: false },
    { name: 'saveSettlement', kind: 'call' },
  ],
  draft: [
    { name: 'client_id', value: 'clt10001234' },
    { name: 'security_code', value: '600519' },
    { name: 'trade_amount', value: 178500 },
    { name: 'settlement_date', value: '2026/03/15' },
    { name: 'id_number', value: '110101199001011234', masked: false },
    { name: 'recordSettlement', kind: 'call' },
  ],
  fixed: [
    { name: 'client_id', value: 'CLT10001234' },
    { name: 'security_code', value: '600519.SH' },
    { name: 'trade_amount', value: 178500 },
    { name: 'settlement_date', value: '2026-03-15' },
    { name: 'id_number', value: '110101199001011234', masked: true },
    { name: 'record_settlement', kind: 'call', args: [
      { name: 'client_id' },
      { name: 'security_code' },
      { name: 'trade_amount' },
      { name: 'settlement_date' },
      { name: 'id_number' },
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

const ANNOTATIONS = {
  naive: [
    { line: 'custId:', issue: 'drift → client_id' },
    { line: "'clt10001234'", issue: 'pattern → CLT10001234' },
    { line: 'stockCode:', issue: 'drift → security_code' },
    { line: "'600519'", issue: 'pattern → 600519.SH' },
    { line: 'amt:', issue: 'drift → trade_amount' },
    { line: 'settleDt:', issue: 'drift → settlement_date' },
    { line: "'2026/03/15'", issue: 'pattern → 2026-03-15' },
    { line: 'idNo:', issue: 'drift → id_number; sensitive leak' },
    { line: 'saveSettlement', issue: 'drift → record_settlement' },
  ],
  draft: [
    { line: "'clt10001234'", issue: 'pattern → CLT10001234' },
    { line: "'600519'", issue: 'pattern → 600519.SH' },
    { line: "'2026/03/15'", issue: 'pattern → 2026-03-15' },
    { line: 'console.log', issue: 'id_number not masked in output' },
    { line: 'recordSettlement', issue: 'SYMBOL_NOT_FOUND → record_settlement' },
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
