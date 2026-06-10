/* cart.js — Cart state module */

const CART_KEY = 'rangmudra_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart: items } }));
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(i => i.id === item.id && i.size === item.size);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart(cart);
}

function removeFromCart(id, size) {
  const cart = getCart().filter(i => !(i.id === id && i.size === size));
  saveCart(cart);
}

function updateQty(id, size, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === id && i.size === size);
  if (item) {
    if (qty <= 0) {
      removeFromCart(id, size);
    } else {
      item.qty = qty;
      saveCart(cart);
    }
  }
}

function clearCart() {
  saveCart([]);
}

function getCartTotal() {
  return getCart().reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.qty || 1), 0);
}

function isInCart(id, size) {
  return getCart().some(i => i.id === id && i.size === size);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const count = getCartCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

window.addEventListener('cart-updated', updateCartBadge);
document.addEventListener('DOMContentLoaded', updateCartBadge);

export { getCart, addToCart, removeFromCart, updateQty, clearCart, getCartTotal, getCartCount, isInCart };
