/**
 * After verify_usage feedback + one retry — converged references.
 */
import { omsClient } from '../oms';

export async function submitLimitBuy() {
  const payload = {
    ticker: 'AAPL',
    order_side: 'buy',
    quantity: 100,
    limit_price: 178.5,
    order_type: 'limit',
    account_id: 'ACC12345678',
  };

  console.log('Submitting order', {
    ...payload,
    account_id: 'ACC****5678', // sensitive field redacted in logs
  });
  return omsClient.submitOrder(payload);
}
