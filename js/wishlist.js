/* wishlist.js — Wishlist state module */

const WISHLIST_KEY = 'rangmudra_wishlist';

function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
  } catch {
    return [];
  }
}

function saveWishlist(items) {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('wishlist-updated', { detail: { wishlist: items } }));
}

function addToWishlist(item) {
  const list = getWishlist();
  if (!list.find(i => i.id === item.id)) {
    list.push(item);
    saveWishlist(list);
  }
}

function removeFromWishlist(id) {
  saveWishlist(getWishlist().filter(i => i.id !== id));
}

function toggleWishlist(item) {
  if (isInWishlist(item.id)) {
    removeFromWishlist(item.id);
    return false;
  } else {
    addToWishlist(item);
    return true;
  }
}

function isInWishlist(id) {
  return getWishlist().some(i => i.id === id);
}

function getWishlistCount() {
  return getWishlist().length;
}

export { getWishlist, addToWishlist, removeFromWishlist, toggleWishlist, isInWishlist, getWishlistCount };
