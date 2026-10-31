// The "promise row": what delivery costs and what happens if something arrives
// damaged, in one place. Used on product pages (scripts/build-shop.js) and in
// the cart drawer (shop/cart.js); the homepage can use it later. One source for
// the wording and the numbers - change them here only. Facts: the delivery rate
// in Shopify admin (Rs 49, free from Rs 299 on shippable items, gift cards do
// not count) and return-and-exchange-policy/ (which holds the strict rules). Works as a plain script
// (window.LWPromise), with require() and with import.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LWPromise = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DELIVERY_FEE = 49;
  const FREE_FROM = 299;
  const RETURN_DAYS = 7;

  const POLICY_PATH = 'return-and-exchange-policy/'; // relative to the site root; callers add their own prefix
  const COPY = {
    deliveryFree: 'Free delivery.',
    delivery: `Delivery ₹${DELIVERY_FEE}, free on orders above ₹${FREE_FROM}.`,
    returns: `${RETURN_DAYS}-day easy returns. Damaged in transit? We'll make it right.`,
    returnsShort: `${RETURN_DAYS}-day easy returns.`,
    personalised: 'Made just for you.',
    policyLink: 'Return policy',
    policyLinkPersonalised: 'See our return policy.',
  };

  // Delivery charge for the shippable items' total (gift cards left out).
  function deliveryCost(shippableTotal) {
    return shippableTotal >= FREE_FROM ? 0 : DELIVERY_FEE;
  }

  // Lines of the row, each { icon, text, link? } where link is { text, path }.
  // context 'product' (under the pincode box; price = the lowest variant price)
  // or 'cart' (the returns note under Checkout; the delivery cost is its own
  // line there). Gift cards get no row: the caller passes giftCard and gets [].
  // The strict returns rules stay on the policy page, which the link opens.
  function promiseLines({ context = 'product', personalised = false, giftCard = false, price = 0 } = {}) {
    if (giftCard) return [];
    const policy = { text: COPY.policyLink, path: POLICY_PATH };
    const lines = [];
    if (context === 'product') lines.push({ icon: 'fa-truck-fast', text: price >= FREE_FROM ? COPY.deliveryFree : COPY.delivery });
    if (personalised) lines.push({ icon: 'fa-rotate-left', text: COPY.personalised, link: { ...policy, text: COPY.policyLinkPersonalised } });
    else lines.push({ icon: 'fa-rotate-left', text: context === 'cart' ? COPY.returnsShort : COPY.returns, link: policy });
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

  return { DELIVERY_FEE, FREE_FROM, RETURN_DAYS, POLICY_PATH, COPY, deliveryCost, promiseLines, cartTotals };
});
