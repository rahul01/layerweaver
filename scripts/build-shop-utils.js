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

module.exports = { resizedImageUrl, escAttr, truncateWords, fontAwesomeLinkHtml, isoDateOnly, buildSitemapXml, buildSimilarityIndex, computeRelatedProducts };
