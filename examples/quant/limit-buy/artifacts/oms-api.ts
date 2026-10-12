/**
 * Live OMS API surface — what a harness derives at runtime (not hand-curated).
 * Scanner: examples/derived/scan-typescript.js
 */
export interface OmsClient {
  submitOrder(payload: {
    ticker: string;
    order_side: 'buy' | 'sell';
    quantity: number;
    order_type: string;
    limit_price?: number;
    account_id: string;
  }): Promise<{ order_id: string }>;
}
