/* pay.js — opens the Razorpay window for an order and sees it through.
 *
 *   import { openPayment, retryPayment } from '/js/pay.js';
 *
 * Used by the payment step (a fresh order) and My Orders (Retry Payment on an
 * unpaid one). A paid order takes its pieces out of the cart and goes to the
 * confirmation page. A shopper who closes the window without paying keeps
 * their cart as it was; the caller is told whether the payment was declined
 * ('failed') or simply not finished ('pending') so it can offer Retry Payment.
 */

import { getCart, removeFromCart } from '/js/cart.js';
import { getToken } from '/js/auth.js';
import { apiUrl } from '/js/config.js';
import { rememberMyHold, forgetMyHold } from '/js/holds.js';

const COUPON_KEY = 'rangmudra_coupon';

function post(path, body) {
  return fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-token': getToken() },
    body: JSON.stringify(body || {}),
  });
}

/* Open Razorpay for `order` — the create-order / retry-payment response.
   `itemIds` are the order's pieces, taken out of the cart once it's paid.
   onClose({ outcome: 'failed' | 'pending', holdUntil }) fires when the shopper
   closes the window without a verified payment. */
export function openPayment(order, { itemIds = [], onClose } = {}) {
  let declined = false;
  let reason = '';
  if (order.holdUntil) rememberMyHold(itemIds, order.holdUntil);

  const rzp = new Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: 'Rangmudra',
    description: 'Block Printing, Colors and More.',
    order_id: order.orderId,
    // The shopper's account email and the phone on their delivery address.
    prefill: order.prefill || {},
    // Close the payment window before the server cancels the unpaid order,
    // so nobody pays for an order that's gone.
    timeout: order.timeoutSec || 18 * 60,
    handler: async (response) => {
      try {
        const res = await post('/api/checkout/verify-payment', response);
        if (res.ok) {
          const paid = new Set(itemIds);
          getCart().filter((i) => paid.has(i.id)).forEach((i) => removeFromCart(i.id, i.size));
          forgetMyHold();
          localStorage.removeItem(COUPON_KEY);
          window.location.href = `order-confirmation.html?order=${encodeURIComponent(order.receipt)}`;
          return;
        }
        const v = await res.json().catch(() => ({}));
        alert(v.error || 'We could not verify your payment. If you were charged, please contact us.');
      } catch {
        alert('We could not verify your payment. If you were charged, please contact us.');
      }
    },
    theme: { color: '#7C684F' },
    modal: {
      ondismiss: () => {
        if (declined) post('/api/checkout/payment-failed', { razorpay_order_id: order.orderId, reason }).catch(() => {});
        onClose?.({ outcome: declined ? 'failed' : 'pending', holdUntil: order.holdUntil });
      },
    },
  });
  // Razorpay keeps its window open on a decline so the shopper can try another
  // method; it only counts as failed if they then close it.
  rzp.on('payment.failed', (resp) => {
    declined = true;
    reason = resp?.error?.description || reason;
  });
  rzp.open();
}

/* Retry Payment on an unpaid order by our order id. Resolves once the window
   is open; rejects with the server's message when the order can't be paid any
   more (already paid, cancelled, or its time ran out). */
export async function retryPayment(orderId, { itemIds = [], onClose } = {}) {
  const res = await post(`/api/orders/${encodeURIComponent(orderId)}/retry-payment`);
  const order = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(order.error || 'Could not reopen payment. Please try again.');
  openPayment(order, { itemIds, onClose });
}
