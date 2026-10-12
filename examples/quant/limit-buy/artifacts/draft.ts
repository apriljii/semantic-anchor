/**
 * Same task, but Planner passed a bind_constraints bundle first.
 * Names converged to canonical ids — value / policy bugs remain for Gate to catch.
 */
import { omsClient } from '../oms';

export async function submitLimitBuy() {
  const payload = {
    ticker: 'aapl', // violation: pattern ^[A-Z0-9.]{1,12}$
    order_side: 'long', // violation: not in [buy, sell]
    quantity: 100,
    limit_price: 178.5,
    order_type: 'limit',
    account_id: 'ACC12345678', // violation: sensitive field logged without masked:true
  };

  console.log('Submitting order', payload);
  return omsClient.submitOrder(payload);
}
