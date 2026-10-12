/**
 * Same task, but Planner passed a bind_constraints bundle first.
 * Names converged to canonical ids — value / policy bugs remain for Gate to catch.
 */
import { brokerCore } from '../core';

export async function recordSettlement() {
  const record = {
    client_id: 'clt10001234', // violation: pattern ^CLT[0-9]{8,}$
    security_code: '600519', // violation: pattern ^[0-9]{6}\.(SH|SZ)$
    trade_amount: 178500.0,
    settlement_date: '2026/03/15', // violation: pattern YYYY-MM-DD
    id_number: '110101199001011234', // violation: sensitive field logged without masked:true
  };

  console.log('Recording settlement', record);
  return brokerCore.recordSettlement(record);
}
