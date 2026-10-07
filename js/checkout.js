/* checkout.js — Stepper navigation + sidebar swap logic */

import { getCart, getCartTotal } from './cart.js';

const DELIVERY_FEE = 99;
const TAX_RATE = 0.08;

export function formatPrice(n) {
  return '₹' + n.toLocaleString('en-IN');
}

export function updateCartSummary() {
  const subtotal = getCartTotal();
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax + DELIVERY_FEE;

  const els = {
    total: document.getElementById('summary-total'),
    tax: document.getElementById('summary-tax'),
    delivery: document.getElementById('summary-delivery'),
    amount: document.getElementById('summary-amount'),
  };

  if (els.total) els.total.textContent = formatPrice(subtotal);
  if (els.tax) els.tax.textContent = formatPrice(tax);
  if (els.delivery) els.delivery.textContent = formatPrice(DELIVERY_FEE);
  if (els.amount) els.amount.textContent = formatPrice(total);
}

export function initCheckout() {
  updateCartSummary();

  const proceedBtn = document.querySelector('.btn-proceed');
  const backBtn = document.querySelector('.btn-back');
  const step = parseInt(document.body.dataset.step || '1');

  const STEPS = {
    1: 'cart.html',
    2: 'checkout-address.html',
    3: 'checkout-payment.html',
    4: 'order-confirmation.html',
  };

  if (proceedBtn) {
    proceedBtn.addEventListener('click', () => {
      const next = STEPS[step + 1];
      if (next) window.location.href = next;
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const prev = STEPS[step - 1];
      if (prev) window.location.href = prev;
      else window.history.back();
    });
  }
}
