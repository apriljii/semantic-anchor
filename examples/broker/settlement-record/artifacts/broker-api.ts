/**
 * Live OMS API — derived at runtime by scan-typescript.js
 */
export interface BrokerCore {
  recordSettlement(record: {
    client_id: string;
    security_code: string;
    trade_amount: number;
    settlement_date: string;
    id_number: string;
  }): Promise<{ settlement_id: string }>;
}
