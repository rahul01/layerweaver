// The "promise row": what delivery costs and what happens if something arrives
// damaged, in one place. Used on product pages (scripts/build-shop.js) and in
// the cart drawer (shop/cart.js); the homepage can use it later. One source for
// the wording and the numbers - change them here only. Facts: the delivery rate
// in Shopify admin (Rs 49, free from Rs 299 on shippable items, gift cards do
// not count) and return-and-exchange-policy/. Works as a plain script
// (window.LWPromise), with require() and with import.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LWPromise = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DELIVERY_FEE = 49;
  const FREE_FROM = 299;
  const RETURN_DAYS = 7;

  const COPY = {
    delivery: `Delivery ₹${DELIVERY_FEE}, free above ₹${FREE_FROM}.`,
    damaged: `Damaged or wrong item? Replacement or full refund within ${RETURN_DAYS} days, with photos.`,
    damagedShort: `Damaged or wrong item? Replacement or full refund within ${RETURN_DAYS} days.`,
    personalised: "Personalised items can't be returned if you change your mind.",
  };

  // Delivery charge for the shippable items' total (gift cards left out).
  function deliveryCost(shippableTotal) {
    return shippableTotal >= FREE_FROM ? 0 : DELIVERY_FEE;
  }

  // Lines of the row. context 'product' (under the pincode box) or 'cart' (the
  // returns note under Checkout; the delivery cost is its own line there).
  // Gift cards get no row: the caller passes giftCard and gets [].
  function promiseLines({ context = 'product', personalised = false, giftCard = false } = {}) {
    if (giftCard) return [];
    const lines = [];
    if (context === 'product') {
      lines.push({ icon: 'fa-truck-fast', text: COPY.delivery });
      lines.push({ icon: 'fa-rotate-left', text: personalised ? `${COPY.damaged} ${COPY.personalised}` : COPY.damaged });
    } else if (context === 'cart') {
      lines.push({ icon: 'fa-rotate-left', text: personalised ? `${COPY.damagedShort} ${COPY.personalised}` : COPY.damagedShort });
    }
    return lines;
  }

  // Cart footer numbers. shippableTotal: shippable items' total, gift cards out.
  // itemsTotal: the cart's own total (gift cards in). needsShipping: any line
  // ships. hasDiscount: a code or automatic discount is on the cart - then we do
  // not know which total Shopify tests against Rs 299, so no delivery is shown.
  function cartTotals({ shippableTotal, itemsTotal, needsShipping, hasDiscount = false }) {
    if (!needsShipping || hasDiscount) return { delivery: null, total: itemsTotal, label: 'Total' };
    const delivery = deliveryCost(shippableTotal);
    return { delivery, total: itemsTotal + delivery, label: 'Total with delivery' };
  }

  return { DELIVERY_FEE, FREE_FROM, RETURN_DAYS, COPY, deliveryCost, promiseLines, cartTotals };
});
