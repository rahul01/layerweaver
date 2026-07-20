export function fmt(amount, code) {
  const n = parseFloat(amount);
  return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
}

export function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function cartQtyMap(edges) {
  if (!edges || !edges.length) return {};
  const map = {};
  edges.forEach(e => { map[e.node.merchandise.id] = e.node.quantity; });
  return map;
}

// Mirrors shop/cart.js's attributionCartAttributes(). Takes the parsed
// lw_attribution object directly (cart.js does its own localStorage read/parse).
export function attributionCartAttributes(attribution) {
  if (!attribution) return [];
  const map = {
    'Attribution Source':   attribution.source,
    'Attribution Medium':   attribution.utm_medium,
    'Attribution Campaign': attribution.utm_campaign,
    'Landing Page':         attribution.landingPage,
    'Referrer':             attribution.referrer,
  };
  return Object.entries(map).filter(([, v]) => v).map(([key, value]) => ({ key, value }));
}

// Mirrors the shipping-bar math in shop/cart.js's renderShippingBar().
export function shippingProgress(total, min) {
  const isUnlocked = total >= min;
  const pct = Math.min((total / min) * 100, 100);
  const message = isUnlocked
    ? '🎉 Free shipping unlocked!'
    : `🚚 Add ₹${(min - total).toFixed(0)} more for free shipping`;
  return { isUnlocked, pct, message };
}
