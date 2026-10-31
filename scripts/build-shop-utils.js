/**
 * build-shop-utils.js
 * Pure helpers used by scripts/build-shop.js, split out so they're importable
 * from tests without pulling in the Shopify fetch + file-write side effects
 * that run at the bottom of build-shop.js.
 */

function resizedImageUrl(url, width) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}`;
}

function srcsetFor(url, widths) {
  if (!url) return url;
  return widths.map(w => `${resizedImageUrl(url, w)} ${w}w`).join(', ');
}

function escAttr(str) {
  return String(str).replace(/—/g, '-').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Truncate to `max` chars without cutting a word in half, appending an ellipsis if shortened.
function truncateWords(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  let trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:-]+$/, '');
  let prev;
  do {
    prev = trimmed;
    trimmed = trimmed.replace(/\s+(?:a|an|the|or|and|to|in|of|for)$/i, '');
  } while (trimmed !== prev);
  return trimmed + '…';
}

// Related-product suggestions, scored from listing text alone (title + description) -
// no productType/collection/tag signal involved. Uses TF-IDF weighted cosine similarity:
// title words count 3x a description word, and words that are rare across the catalog
// (e.g. "octopus") count for more than words nearly every listing has (e.g. "keychain").
const RELATED_STOPWORDS = new Set(`a an the of for and or with to in on at from by is are this that these those
it its as your you perfect ideal great makes make made design designed feature features featuring
3d printed print piece pieces model models product unique style stylish add adds display`.split(/\s+/).filter(Boolean));

function tokenizeForSimilarity(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !RELATED_STOPWORDS.has(w));
}

function buildSimilarityIndex(products) {
  const docs = products.map(p => {
    const weighted = new Map();
    for (const w of tokenizeForSimilarity(p.title)) weighted.set(w, (weighted.get(w) || 0) + 3);
    for (const w of tokenizeForSimilarity(p.description)) weighted.set(w, (weighted.get(w) || 0) + 1);
    return weighted;
  });

  const df = new Map();
  for (const doc of docs) {
    for (const w of doc.keys()) df.set(w, (df.get(w) || 0) + 1);
  }
  const n = products.length;
  const idf = new Map();
  for (const [w, count] of df) idf.set(w, Math.log((n + 1) / (count + 1)) + 1);

  const vectors = docs.map(doc => {
    const v = new Map();
    let normSq = 0;
    for (const [w, tf] of doc) {
      const weight = tf * (idf.get(w) || 1);
      v.set(w, weight);
      normSq += weight * weight;
    }
    return { v, norm: Math.sqrt(normSq) };
  });

  return vectors;
}

function cosineSimilarity(a, b) {
  if (a.norm === 0 || b.norm === 0) return 0;
  const [small, large] = a.v.size <= b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [w, weight] of small.v) {
    const otherWeight = large.v.get(w);
    if (otherWeight) dot += weight * otherWeight;
  }
  return dot / (a.norm * b.norm);
}

function productMinPrice(product) {
  const amount = parseFloat(product?.priceRange?.minVariantPrice?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// Smooth 0-1 similarity from the ratio between two prices (not their raw
// difference) - a ratio-based distance means ₹99 vs ₹149 (1.5x) reads as close
// as ₹990 vs ₹1490 (also 1.5x), which matches how price gaps actually feel to
// a shopper. Equal prices score 1; missing a price on either side scores 0.
function priceSimilarity(priceA, priceB) {
  if (priceA == null || priceB == null) return 0;
  const ratio = Math.max(priceA, priceB) / Math.min(priceA, priceB);
  return 1 / ratio;
}

// Ranks every other product against `product` by title/description text similarity,
// blended with how close the two products are priced. productType/collection are
// deliberately not used - two products can be textually unrelated yet share a
// Shopify category, and the reverse (genuinely similar products filed under
// different categories) happens too, so category isn't a reliable relevance signal
// here. Returns the top matches with a similarity score above `minScore`. Normally
// capped at `baseMax`, but matches ranked beyond that stay in (up to `hardMax`) when
// their score clears `highScore` - e.g. a tight-knit family like the 5 dino
// skeletons, where every member is each other's strongest match, isn't artificially
// trimmed to 5.
// `index` is a pre-built buildSimilarityIndex(allProducts) result, shared across
// every product's lookup so the O(n) TF-IDF pass only runs once per build.
function computeRelatedProducts(product, allProducts, index, { baseMax = 5, hardMax = 8, highScore = 0.5, minScore = 0.03, priceWeight = 0.04 } = {}) {
  const targetIdx = allProducts.findIndex(p => p.handle === product.handle);
  if (targetIdx === -1) return [];
  const targetVec = index[targetIdx];
  const targetPrice = productMinPrice(product);

  const scored = allProducts
    .map((p, i) => {
      if (p.handle === product.handle) return null;
      const textSim = cosineSimilarity(targetVec, index[i]);
      if (textSim < minScore) return null;
      // Price only re-ranks candidates that already qualify on text alone - it's
      // scaled by textSim itself so it can nudge a real match up or down (e.g. among
      // several dino skeletons, the ones priced closer to this one edge ahead) but
      // can never single-handedly promote a product with negligible text overlap
      // (e.g. an aquarium cave and a controller stand that happen to share a price).
      const priceSim = priceSimilarity(targetPrice, productMinPrice(p));
      const score = Math.min(1, textSim * (1 - priceWeight) * 0.85 + priceSim * priceWeight * textSim);
      return score >= minScore ? { product: p, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, hardMax)
    .filter((s, i) => i < baseMax || s.score >= highScore);

  return scored.map(s => s.product);
}

function fontAwesomeLinkHtml() {
  const href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  const integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==';
  const attrs = `integrity="${integrity}" crossorigin="anonymous" referrerpolicy="no-referrer"`;
  return `
    <link rel="preload" as="style" href="${href}" ${attrs} onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${href}" ${attrs}></noscript>`;
}

// Shopify's updatedAt is a full ISO datetime; sitemap <lastmod> wants just the date.
function isoDateOnly(isoString) {
  return isoString ? isoString.slice(0, 10) : null;
}

function buildSitemapXml(urls) {
  const entries = urls.map(u =>
    `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

// Homepage "What our customers say" carousel: best reviews first. What a
// review says matters most (words written, up to 50), a customer photo adds
// 15, each missing star costs 20; ties go to the newer review. A one-word
// "Great" or a three-word line with a photo sinks below a real story.
function testimonialScore(review, hasPhoto) {
  const words = String(review.body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(words, 50) + (hasPhoto ? 15 : 0) - (5 - (review.rating || 0)) * 20;
}

function rankTestimonials(reviews, hasPhoto = () => false) {
  return reviews
    .map(r => ({ r, score: testimonialScore(r, hasPhoto(r)), at: new Date(r.created_at || 0).getTime() }))
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .map(x => x.r);
}

// ── Google product data (Oct 25, 2026) ───────────────────────────────────────
// Shipping and returns as Google's merchant-listing structured data and the
// Merchant Center feed expect them. Facts, keep in step with the site:
// - shipping: flat ₹49 anywhere in India below ₹299, free from ₹299 (shipping
//   policy; cart-utils.js freeShippingLine), made to order in 1-2 days, then
//   3-7 days in transit ("usually arrives in 4-9 days" across India).
// - returns: 7 days from delivery (return-and-exchange-policy), except
//   personalised or custom-made items, which can't be returned.
const SHIPPING_FEE = 49;
const FREE_SHIPPING_FROM = 299;
const HANDLING_DAYS = [1, 2];
const TRANSIT_DAYS = [3, 7];
const RETURN_DAYS = 7;

function shippingPriceFor(price) {
  return Number(price) >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
}

function isPersonalised(product) {
  const text = `${product.title || ''} ${(product.tags || []).join(' ')}`;
  return /personali[sz]|custom[- ]made|nameplate|name plate/i.test(text);
}

// Age warning (Oct 31, 2026): a small plain line on these product pages only,
// never a "safe for kids" claim. One list - add or remove a handle to change it.
// Not on keychains, clickers, lamps, lanterns, pen pots, bookmarks, aquarium
// items, name plates or gift cards. Bird Ocarina is left out on purpose: the
// "Not for mouth use" line would contradict the product.
const AGE_WARNING = 'Not for children under 5: small parts. Adult supervision recommended.';
const AGE_WARNING_HANDLES = new Set([
  't-rex-skeleton', 'articulated-stegosaurus-skeleton', 'articulated-brachiosaurus-skeleton',
  'articulated-velociraptor-skeleton', 'articulated-triceratops-skeleton', 'articulated-pteranodon-skeleton',
  'articulated-spinosaurus-skeleton', 'articulated-dilophosaurus-skeleton', 'articulated-wooly-mammoth',
  'cone-fidget', 'infinity-cube', 'articulated-octopus', 'articulated-cute-spider',
  'tree-articulated-legs', 'pumpkin-articulated-legs', 'pineapple-articulated-legs',
  'panda-figurine', 'cute-wobble-penguin-desk-toy', 'floating-cat', 'tetris-balance-game',
  'uno-box', 'bird-ocarina', 'night-dragon',
]);
function ageWarningFor(handle) {
  return AGE_WARNING_HANDLES.has(handle) ? AGE_WARNING : '';
}

// schema.org OfferShippingDetails + MerchantReturnPolicy for one offer.
function offerShippingAndReturns(price, { personalised = false } = {}) {
  const days = ([min, max]) => ({ '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' });
  return {
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: shippingPriceFor(price).toFixed(2), currency: 'INR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
      deliveryTime: { '@type': 'ShippingDeliveryTime', handlingTime: days(HANDLING_DAYS), transitTime: days(TRANSIT_DAYS) },
    },
    hasMerchantReturnPolicy: personalised
      ? { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted' }
      : { '@type': 'MerchantReturnPolicy', applicableCountry: 'IN', returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: RETURN_DAYS },
  };
}

const xmlEsc = s => String(s ?? '')
  .replace(/—/g, '-')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Google Merchant Center product feed (RSS 2.0 with the g: namespace). One
// item per variant; variants of one product share item_group_id. Items:
// { id, groupId, title, description, link, imageLink, extraImages, price
// (number, INR), available, color }. Custom 3D prints have no GTIN/MPN, so
// identifier_exists is "no" and the brand is LayerWeaver.
function buildGoogleFeedXml(items, { siteUrl, title = 'LayerWeaver products' } = {}) {
  const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `\n      <${name}>${xmlEsc(value)}</${name}>`);
  const entries = items.map(it => `    <item>${tag('g:id', it.id)}${tag('g:item_group_id', it.groupId)}${tag('g:title', it.title)}${tag('g:description', it.description)}${tag('g:link', it.link)}${tag('g:image_link', it.imageLink)}${(it.extraImages || []).slice(0, 10).map(u => tag('g:additional_image_link', u)).join('')}${tag('g:availability', it.available ? 'in_stock' : 'out_of_stock')}${tag('g:price', `${Number(it.price).toFixed(2)} INR`)}${tag('g:brand', 'LayerWeaver')}${tag('g:condition', 'new')}${tag('g:identifier_exists', 'no')}${tag('g:color', it.color)}
      <g:shipping>
        <g:country>IN</g:country>
        <g:price>${shippingPriceFor(it.price).toFixed(2)} INR</g:price>
        <g:min_handling_time>${HANDLING_DAYS[0]}</g:min_handling_time>
        <g:max_handling_time>${HANDLING_DAYS[1]}</g:max_handling_time>
        <g:min_transit_time>${TRANSIT_DAYS[0]}</g:min_transit_time>
        <g:max_transit_time>${TRANSIT_DAYS[1]}</g:max_transit_time>
      </g:shipping>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>${xmlEsc(title)}</title>\n    <link>${xmlEsc(siteUrl)}</link>\n    <description>${xmlEsc(title)}</description>\n${entries}\n  </channel>\n</rss>\n`;
}

module.exports = { resizedImageUrl, srcsetFor, escAttr, truncateWords, fontAwesomeLinkHtml, isoDateOnly, buildSitemapXml, buildSimilarityIndex, computeRelatedProducts, testimonialScore, rankTestimonials, shippingPriceFor, isPersonalised, offerShippingAndReturns, buildGoogleFeedXml, ageWarningFor, AGE_WARNING_HANDLES };
