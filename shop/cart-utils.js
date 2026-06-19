const GIFT_ATTR_KEY = '_gift';
const GIFT_ATTR_VALUE = 'FREEGIFT299';

export function fmt(amount, code) {
  const n = parseFloat(amount);
  return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
}

export function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function getQualifyingTotal(edges, giftKey = GIFT_ATTR_KEY, giftValue = GIFT_ATTR_VALUE) {
  if (!edges || !edges.length) return 0;
  let sum = 0;
  for (const edge of edges) {
    const line = edge.node;
    const isGift = line.attributes?.some(a => a.key === giftKey && a.value === giftValue);
    if (!isGift) {
      sum += parseFloat(line.merchandise.price.amount || 0) * line.quantity;
    }
  }
  return sum;
}

export function getGiftLine(edges, giftKey = GIFT_ATTR_KEY, giftValue = GIFT_ATTR_VALUE) {
  if (!edges || !edges.length) return null;
  return edges.find(e =>
    e.node.attributes?.some(a => a.key === giftKey && a.value === giftValue)
  )?.node || null;
}

export function cartQtyMap(edges) {
  if (!edges || !edges.length) return {};
  const map = {};
  edges.forEach(e => { map[e.node.merchandise.id] = e.node.quantity; });
  return map;
}
