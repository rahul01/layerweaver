#!/usr/bin/env node
/**
 * build-shop.js
 * Fetches products from Shopify Storefront API and generates static HTML pages.
 * Run via GitHub Actions or locally: node scripts/build-shop.js
 */

const fs = require('fs');
const path = require('path');
const { resizedImageUrl, escAttr, truncateWords, fontAwesomeLinkHtml, isoDateOnly, buildSitemapXml } = require('./build-shop-utils');

// Load .env (if present) without adding a dotenv dependency.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = (match[2] || '').trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const SHOPIFY_DOMAIN = 'shop.layerweaver.com';
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '7f0eafeb115e99a4a917e044a1fb4125';
let JUDGEME_TOKEN = process.env.JUDGEME_API_TOKEN || '';
const JUDGEME_SHOP = 'ntpjuk-fp.myshopify.com';
const JUDGEME_REVIEW_UUID = 'f101c8b2-8f4d-4a3a-9acb-d51832084fe8';
const SITE_URL = 'https://www.layerweaver.com';
const BUILD_VER = Date.now();

const IMG_WIDTH_GRID = 500;
const IMG_WIDTH_THUMB_RAIL = 300;
const IMG_WIDTH_MAIN = 900;
const IMG_WIDTH_BANNER = 800;
const IMG_WIDTH_OG = 1200;

async function fetchCollections() {
  const query = `{
    collections(first: 20, sortKey: TITLE) {
      edges {
        node {
          handle title description updatedAt
          image { url }
          products(first: 50) {
            edges {
              node {
                id title handle tags description
                priceRange {
                  minVariantPrice { amount currencyCode }
                  maxVariantPrice { amount currencyCode }
                }
                images(first: 5) { edges { node { url altText } } }
                options { name optionValues { name swatch { color } } }
                variants(first: 20) {
                  edges {
                    node {
                      id title
                      price { amount currencyCode }
                      availableForSale
                      image { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));

  const collections = data.data.collections.edges.map(e => ({
    ...e.node,
    products: e.node.products.edges.map(pe => pe.node),
  }));

  const HIDDEN_COLLECTIONS = ['all-products'];
  const ORDER = [
    'lamps-and-decor',
    'toys-games-and-desk-buddies',
    'articulated-fidgets',
    'keychains-pocket-charms',
    'page-pals',
    'aquarium-tech-and-accessories',
  ];

  collections.sort((a, b) => {
    const ai = ORDER.indexOf(a.handle);
    const bi = ORDER.indexOf(b.handle);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return collections.filter(c => !HIDDEN_COLLECTIONS.includes(c.handle));
}

async function fetchProducts() {
  const query = `
    query getProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id title handle tags description descriptionHtml updatedAt
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 20) {
              edges { node { url altText } }
            }
            media(first: 10) {
              edges {
                node {
                  mediaContentType
                  alt
                  ... on Video {
                    sources { url mimeType }
                    previewImage { url }
                  }
                  ... on ExternalVideo {
                    embeddedUrl
                    host
                    previewImage { url }
                  }
                  ... on MediaImage {
                    image { url altText }
                  }
                }
              }
            }
            options {
              name
              optionValues { name swatch { color } }
            }
            variants(first: 20) {
              edges {
                node {
                  id title
                  price { amount currencyCode }
                  availableForSale
                  image { url altText }
                }
              }
            }
          }
        }
      }
    }`;

  const products = [];
  let cursor = null;

  do {
    const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    const data = await res.json();
    if (data.errors) throw new Error(JSON.stringify(data.errors));

    const page = data.data.products;
    products.push(...page.edges.map(e => e.node));
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    console.log(`  Fetched ${products.length} products so far…`);
  } while (cursor);

  return products;
}

function getNumericId(gid) {
  return gid.split('/').pop();
}

async function promptForJudgemeToken() {
  const readline = require('readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question('Enter Judge.me private API token (leave blank to skip reviews): ')).trim();
  } finally {
    rl.close();
  }
}

async function fetchAllReviews(products) {
  if (!JUDGEME_TOKEN && process.stdin.isTTY) {
    JUDGEME_TOKEN = await promptForJudgemeToken();
  }
  if (!JUDGEME_TOKEN) {
    console.warn('  ⚠️  WARNING: JUDGEME_API_TOKEN not set — skipping reviews, shop will build with no ratings/reviews.');
    return {};
  }
  console.log('Fetching reviews from Judge.me...');
  // Judge.me's `external_id`/`product_id` query params on /reviews are not reliable
  // filters (they're silently ignored, returning the unfiltered/paginated list), so
  // instead fetch every review once and group client-side by product_external_id,
  // which each review object reports correctly.
  const byExternalId = {};
  let page = 1;
  const PER_PAGE = 100;
  try {
    while (true) {
      const url = `https://judge.me/api/v1/reviews?api_token=${JUDGEME_TOKEN}&shop_domain=${JUDGEME_SHOP}&per_page=${PER_PAGE}&page=${page}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ⚠️  WARNING: Judge.me request failed: HTTP ${res.status} ${await res.text()}`);
        return {};
      }
      const data = await res.json();
      const reviews = data.reviews || [];
      for (const r of reviews) {
        if (r.published === false || r.hidden === true) continue;
        (byExternalId[r.product_external_id] ||= []).push(r);
      }
      if (reviews.length < PER_PAGE) break;
      page += 1;
    }
  } catch (err) {
    console.warn(`  ⚠️  WARNING: Judge.me request failed: ${err.message}`);
    return {};
  }

  const map = {};
  for (const product of products) {
    const reviews = byExternalId[getNumericId(product.id)];
    if (!reviews || !reviews.length) continue;
    const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    map[product.handle] = {
      rating: avgRating,
      count: reviews.length,
      reviews: reviews.slice(0, 6),
    };
  }
  console.log(`  Got reviews for ${Object.keys(map).length} product(s)`);
  if (Object.keys(map).length === 0) {
    console.warn('  ⚠️  WARNING: Judge.me returned 0 reviews for every product — check JUDGEME_API_TOKEN/JUDGEME_SHOP are correct.');
  }
  return map;
}

function starsHtml(rating, count, size = 'sm') {
  if (!count) return '';
  const pct = (rating / 5 * 100).toFixed(1);
  return `<div class="product-stars product-stars--${size}">
    <span class="stars-visual" style="--pct:${pct}%"></span>
    <span class="review-count">${rating.toFixed(1)} (${count})</span>
  </div>`;
}

function reviewCardHtml(review) {
  const date = new Date(review.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const name = escAttr(review.reviewer?.name || 'Customer');
  return `<div class="review-card">
    <div class="review-header">
      <span class="review-stars">${stars}</span>
      <span class="review-author">${name}</span>
      ${review.verified_buyer ? '<span class="review-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>' : ''}
      <span class="review-date">${date}</span>
    </div>
    ${review.title ? `<p class="review-title">${escAttr(review.title)}</p>` : ''}
    ${review.body ? `<p class="review-body">${escAttr(review.body)}</p>` : ''}
  </div>`;
}

// Build a title→hex map from Shopify's swatch data for a product
function buildSwatchMap(product) {
  const map = {};
  for (const option of product.options) {
    for (const val of option.optionValues) {
      if (val.swatch?.color) map[val.name] = val.swatch.color;
    }
  }
  return map;
}

function sanitizeDescriptionHtml(html) {
  if (!html) return '';
  return html
    .replace(/—/g, '-')
    .replace(/<meta[^>]*>/gi, '')           // strip <meta> tags Shopify injects
    .replace(/\s*data-[\w-]+="[^"]*"/g, '') // strip data-* attributes
    .replace(/\s*style="[^"]*"/g, '');      // strip inline style attributes
}

function formatPrice(amount, currencyCode) {
  const n = parseFloat(amount);
  return currencyCode === 'INR' ? `₹${n.toFixed(0)}` : `${currencyCode} ${n.toFixed(2)}`;
}

// Products tagged 'personalized' with a ₹1 placeholder price are contact-only:
// hide price everywhere and replace cart/personalization UI with WhatsApp-only.
function isContactOnly(product) {
  return product.tags.includes('personalized') &&
    parseFloat(product.priceRange.minVariantPrice.amount) <= 1;
}

// Products tagged 'custom_price' show their Shopify price as indicative only.
function isCustomPrice(product) {
  return product.tags.includes('custom_price');
}

// ── HTML partials (all paths relative to site root via `base`) ────────────────
// base:     path from this file back to site root  (e.g. '../' or '../../../')
// shopBase: path from this file back to shop/       (e.g. './'  or '../../')

function headHtml(base, shopBase, { title, description, ogImage, ogUrl, structuredData }) {
  return `
    <meta charset="UTF-8">
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=GT-NC682MJG"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      if (location.hostname === 'www.layerweaver.com') gtag('config', 'GT-NC682MJG');
    </script>
    <!-- Meta Pixel Code -->
    <script>
    if (location.hostname === 'www.layerweaver.com') {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1677071140197155');
    fbq('track', 'PageView');
    }
    </script>
    <!-- End Meta Pixel Code -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:type" content="website">
    <link rel="canonical" href="${ogUrl}">
    ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
    ${structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>` : ''}
    <link rel="icon" href="${base}images/spider-fevicon.svg" type="image/svg+xml">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="${base}images/spider-fevicon.svg">
    <meta name="theme-color" content="#A083D5">
    <link rel="stylesheet" href="${base}styles.css">
    <link rel="stylesheet" href="${shopBase}shop.css?v=${BUILD_VER}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600&family=Science+Gothic:wght@400;700&display=swap" rel="stylesheet">
    ${fontAwesomeLinkHtml()}
    <script type="module">
        window.LW_LOG_EVENT = () => {};
        if (location.hostname === 'www.layerweaver.com') {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js");
            const { getAnalytics, logEvent } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js");
            const { getPerformance } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-performance.js");
            const app = initializeApp({
                apiKey: "AIzaSyA4v_CLxRxFjNsKO4M3NAiiSNF9HipccBk",
                authDomain: "layerweaver.firebaseapp.com",
                projectId: "layerweaver",
                storageBucket: "layerweaver.firebasestorage.app",
                messagingSenderId: "1056344018064",
                appId: "1:1056344018064:web:40f8e04b7dbd02d45a1c15",
                measurementId: "G-00DMH9PYCG"
            });
            const analytics = getAnalytics(app);
            getPerformance(app);
            window.LW_LOG_EVENT = (name, params) => logEvent(analytics, name, params);
        }
    </script>`;
}

function shopHeaderHtml(base, shopBase) {
  return `
    <header class="shop-header">
        <div class="container">
            <a href="${base}" class="logo-container logo-link">
                <img src="${base}images/layerweaver-logo.svg" alt="LayerWeaver Logo" class="logo">
                <span class="logo-text"><span class="logo-word">Layer</span><span class="logo-word">Weaver</span></span>
            </a>
            <div class="search-container" data-index-url="${shopBase}search-index.json" data-products-url="${shopBase}products/">
                <div class="search-bar">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="search" class="search-input" placeholder="Search products…" autocomplete="off" spellcheck="false">
                    <button class="search-clear" aria-label="Clear search"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="search-dropdown" role="listbox"></div>
            </div>
            <nav class="shop-nav">
                <!-- cart.js injects cart icon here -->
            </nav>
        </div>
    </header>`;
}

function shopTrustStripHtml(base) {
  const items = [
    { href: `${base}shipping-policy/`,           icon: 'fa-truck-fast',       color: '#2196F3', label: 'Free Shipping Above ₹299' },
    { href: `${base}faq/#material`,                icon: 'fa-leaf',             color: '#4CAF50', label: 'Eco-Friendly &amp; Renewable PLA' },
    { href: `${base}return-and-exchange-policy/`,icon: 'fa-rotate-left',      color: '#2196F3', label: 'Easy Returns &amp; Exchanges' },
    { href: `${base}workshop/`,                  icon: 'fa-chalkboard-user',  color: '#FF7043', label: '3D Printing Workshops for All Ages' },
    { href: `https://wa.me/917558783018`,        icon: 'fa-whatsapp',         color: '#25D366', label: 'Chat with Us on WhatsApp', target: '_blank', brand: true },
    { href: `https://instagram.com/thelayerweaver`, icon: 'fa-instagram',      color: '#E1306C', label: 'Follow Us for Exciting Builds &amp; Offers', target: '_blank', brand: true },
    { href: `${base}#testimonials`,              icon: 'fa-star',             color: '#FFC107', label: 'Customer Reviews' },
    { href: `${base}services/on-demand/`,        icon: 'fa-pen-ruler',        color: '#A083D5', label: 'Custom Orders Welcome' },
  ];
  const sep = `<span class="trust-sep">✦</span>`;
  const row = items.map(({ href, icon, color, label, target, brand }) => {
    const iconHtml = `<i class="${brand ? 'fa-brands' : 'fa-solid'} ${icon}" style="color:${color}"></i>`;
    const inner = `${iconHtml} ${label}`;
    return href
      ? `<a class="trust-item" href="${href}"${target ? ` target="${target}" rel="noopener"` : ''}>${inner}</a>${sep}`
      : `<span class="trust-item trust-item--muted" style="color:${color}">${inner}</span>${sep}`;
  }).join('');
  return `
    <div class="shop-trust-strip">
        <div class="trust-marquee-track">${row}${row}</div>
    </div>`;
}

// Capitalises the first letter of each all-lowercase word - safe for "3D", "LED", "UNO" etc.
function toTitleCase(str) {
  return str.split(' ').map(word =>
    word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word
  ).join(' ');
}

// Combines product title with a per-image descriptor (variant name or Shopify
// altText) so images aren't left with bare, non-descriptive alt text like "Red".
function productImageAlt(product, descriptor) {
  const title = toTitleCase(product.title);
  return descriptor && descriptor !== product.title ? `${title} - ${descriptor}` : title;
}

function footerHtml(base) {
  return `
    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-left">
                    <img src="${base}images/layerweaver-logo-white.svg" alt="LayerWeaver Logo" class="logo">
                    <div class="footer-text">
                        <h2>LayerWeaver</h2>
                        <p>Affordable 3D Printing Solutions · Pune, India</p>
                    </div>
                </div>
                <nav class="footer-nav">
                    <a href="${base}">Home</a>
                    <a href="${base}shop/">Shop</a>
                    <a href="${base}gallery/">Gallery</a>
                    <a href="${base}workshop/">Workshops</a>
                    <a href="${base}#about">About</a>
                    <a href="${base}connect/">Contact Us</a>
                    <a href="${base}faq/">FAQ</a>
                    <a href="${base}return-and-exchange-policy/">Return and Exchange Policy</a>
                    <a href="${base}shipping-policy/">Shipping Policy</a>
                    <a href="${base}privacy-policy/">Privacy Policy</a>
                </nav>
                <div class="footer-right">
                    <div class="footer-social">
                        <a href="https://instagram.com/thelayerweaver" target="_blank" rel="noopener" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
                        <a href="https://wa.me/917558783018" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
                    </div>
                    <p>&copy; 2026 <span class="brand-text-small">LayerWeaver</span>. All rights reserved.</p>
                </div>
            </div>
        </div>
    </footer>`;
}

// ── Swatch data script tag (injected into every shop page) ───────────────────
// Produces: <script>window.LW_SWATCHES = { "handle": { "Red": "#f61f1f", … }, … }</script>

function swatchDataScript(products) {
  const data = {};
  for (const p of products) {
    const map = buildSwatchMap(p);
    if (Object.keys(map).length) data[p.handle] = map;
  }
  return `<script>window.LW_SWATCHES = ${JSON.stringify(data)};</script>`;
}

// ── Shared product card (used on shop index + collection pages) ───────────────
// productsBase: relative path from current page to shop/products/
//   shop/index.html           → 'products/'
//   shop/collections/*/       → '../../products/'

function productCardHtml(product, productsBase, reviewData = null) {
  const minPrice    = formatPrice(product.priceRange.minVariantPrice.amount, product.priceRange.minVariantPrice.currencyCode);
  const maxPrice    = formatPrice(product.priceRange.maxVariantPrice.amount, product.priceRange.maxVariantPrice.currencyCode);
  const priceDisplay = product.priceRange.minVariantPrice.amount === product.priceRange.maxVariantPrice.amount
    ? minPrice : `${minPrice} – ${maxPrice}`;
  const image        = product.images.edges[0]?.node;
  const available    = product.variants.edges.some(v => v.node.availableForSale);
  const firstVariant = product.variants.edges.find(v => v.node.availableForSale)?.node
                       || product.variants.edges[0].node;
  const hasMultiple      = product.variants.edges.length > 1 && product.variants.edges[0].node.title !== 'Default Title';
  const swatchMap        = buildSwatchMap(product);
  const allAreColors     = hasMultiple && product.variants.edges.every(e => swatchMap[e.node.title]);
  const uniqueListingVariantImgs = new Set(product.variants.edges.map(e => e.node.image?.url).filter(Boolean));
  const hasVariantImages = hasMultiple && uniqueListingVariantImgs.size > 1;
  // When variants have distinct images the user must visit the product page to choose;
  // only applies to non-color products (color swatches handle selection inline).
  const needsProductPage = hasMultiple && !allAreColors && hasVariantImages;

  const colorSwatchesHtml = allAreColors
    ? `<div class="listing-color-swatches">${
        product.variants.edges.map(e => e.node).map(v => {
          const hex     = swatchMap[v.title];
          const isFirst = v.id === firstVariant.id;
          return `<button class="listing-swatch${isFirst ? ' active' : ''}${!v.availableForSale ? ' sold-out' : ''}"
                       style="background:${hex}${hex === '#ffffff' ? ';border-color:#ddd' : ''}"
                       title="${escAttr(v.title)}"
                       data-variant-gid="${v.id}"
                       data-variant-id="${getNumericId(v.id)}"
                       data-price="${formatPrice(v.price.amount, v.price.currencyCode)}"
                       ${!v.availableForSale ? 'disabled' : ''}></button>`;
        }).join('')
      }</div>`
    : (hasMultiple && !needsProductPage ? `<a href="${productsBase}${product.handle}/" class="listing-choose-link">Choose option</a>` : '');

  return `
      <div class="shop-product-card">
          <a href="${productsBase}${product.handle}/" class="product-card-link">
              <div class="product-image-wrap">
                  ${image
                    ? `<img src="${resizedImageUrl(image.url, IMG_WIDTH_GRID)}" alt="${escAttr(productImageAlt(product, image.altText))}" loading="lazy">`
                    : '<div class="no-image"><i class="fa-solid fa-cube"></i></div>'
                  }
                  ${!available ? '<span class="sold-out-badge">Sold Out</span>' : ''}
                  <button class="wishlist-btn"
                          data-handle="${product.handle}"
                          data-title="${escAttr(product.title)}"
                          data-price="${priceDisplay}"
                          data-image="${image?.url || ''}"
                          data-url="${SITE_URL}/shop/products/${product.handle}/"
                          aria-label="Add to wishlist">
                      <i class="fa-regular fa-heart"></i>
                  </button>
              </div>
              <div class="product-card-info">
                  <h3>${toTitleCase(product.title)}</h3>
                  ${reviewData?.count ? starsHtml(reviewData.rating, reviewData.count) : ''}
                  ${isContactOnly(product) ? '' : `<p class="product-price${isCustomPrice(product) ? ' custom-price' : ''}">${priceDisplay}${isCustomPrice(product) ? '<span class="indicative-label">Final price varies with customization</span>' : ''}</p>`}
              </div>
          </a>
          ${available
            ? `<div class="product-card-actions">
                  ${colorSwatchesHtml}
                  <div class="product-card-actions-row">
                      ${product.tags?.includes('personalized')
                        ? `<a href="${productsBase}${product.handle}/" class="listing-personalize-btn">
                               <i class="fa-solid fa-pen-nib"></i> Personalize
                           </a>`
                        : isCustomPrice(product)
                          ? `<a href="https://wa.me/917558783018?text=I'm interested in ${encodeURIComponent(product.title)}" class="listing-whatsapp-btn" target="_blank">
                                 <i class="fa-brands fa-whatsapp"></i> Order on WhatsApp
                             </a>`
                          : needsProductPage
                            ? `<a href="${productsBase}${product.handle}/" class="listing-choose-link">Choose option</a>`
                            : `<button class="listing-add-to-cart"
                                 data-variant-gid="${firstVariant.id}">
                                 Add to Cart
                             </button>`
                      }
                  </div>
              </div>`
            : '<span class="btn-disabled">Sold Out</span>'
          }
      </div>`;
}

// ── Collection nav chip strip ─────────────────────────────────────────────────
// shopBase:     path from current page back to shop/
// activeHandle: collection handle to mark active, or null for "All"

function collectionNavHtml(collections, shopBase, activeHandle = null) {
  const items = [
    { handle: null, title: 'All', href: shopBase },
    ...collections.map(c => ({ handle: c.handle, title: c.title, href: `${shopBase}collections/${c.handle}/` })),
  ];
  const activeTitle = items.find(i => i.handle === activeHandle)?.title || 'All';
  const chips = items.map(({ handle, title, href }) => {
    const active = handle === activeHandle ? ' active' : '';
    return `<a href="${href}" class="collection-nav-chip${active}">${title}</a>`;
  }).join('\n          ');
  const dropdownItems = items.map(({ handle, title, href }) => {
    const active = handle === activeHandle ? ' active' : '';
    return `<a href="${href}" class="collection-dropdown-item${active}">${title}</a>`;
  }).join('\n          ');
  return `
      <div class="collection-nav">
          ${chips}
      </div>
      <div class="collection-nav-mobile">
          <button class="collection-filter-btn" aria-expanded="false" aria-haspopup="true">
              <i class="fa-solid fa-layer-group"></i>
              <span>${activeTitle}</span>
              <i class="fa-solid fa-chevron-down collection-filter-chevron"></i>
          </button>
          <div class="collection-dropdown" role="menu">
              ${dropdownItems}
          </div>
          <div class="mobile-inline-search" data-index-url="${shopBase}search-index.json" data-products-url="${shopBase}products/">
              <div class="search-bar">
                  <i class="fa-solid fa-magnifying-glass search-icon"></i>
                  <input type="search" class="search-input" placeholder="Search…" autocomplete="off" spellcheck="false">
                  <button class="search-clear" aria-label="Clear search"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div class="search-dropdown" role="listbox"></div>
          </div>
      </div>`;
}

// ── Shop index (shop/index.html) ──────────────────────────────────────────────
// depth from root: 1  →  base = '../'   shopBase = './'

function generateShopIndex(products, collections, reviewsMap = {}) {
  const base     = '../';
  const shopBase = './';

  const productCards = products.map(p => productCardHtml(p, 'products/', reviewsMap[p.handle])).join('\n');

  // Pick the first product image from each collection for the "All" banner
  const BANNER_EXCLUDE = ['cone-fidget'];
  const allBannerImages = collections.flatMap(c =>
    c.products
      .filter(p => !BANNER_EXCLUDE.includes(p.handle))
      .slice(-2)
      .map(p => p.images.edges[0]?.node)
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${headHtml(base, shopBase, {
      title: 'Shop – LayerWeaver 3D Printed Products',
      description: 'Browse and buy unique 3D printed products from LayerWeaver – affordable, handcrafted, and shipped to you.',
      ogUrl: `${SITE_URL}/shop/`,
      ogImage: resizedImageUrl(products[0]?.images.edges[0]?.node.url, IMG_WIDTH_OG),
    })}
</head>
<body>
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>
    ${shopTrustStripHtml(base)}

    <section class="collection-topbar">
        <div class="container">
            ${collectionNavHtml(collections, shopBase, null)}
        </div>
    </section>

    <div class="container">
        ${collagebannerHtml('All Products', 'Browse our complete collection of 3D printed creations', allBannerImages)}
    </div>

    <section class="shop-products">
        <div class="container">
            <div class="shop-grid">
${productCards}
            </div>
        </div>
    </section>

    ${footerHtml(base)}
    ${swatchDataScript(products)}
    <script src="auth.js?v=${BUILD_VER}"></script>
    <script src="cart.js?v=${BUILD_VER}"></script>
    <script src="search.js?v=${BUILD_VER}"></script>
    <script src="wishlist.js?v=${BUILD_VER}"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Product page (shop/products/[handle]/index.html) ──────────────────────────
// depth from root: 3  →  base = '../../../'   shopBase = '../../'

function generateProductPage(product, collection, reviewData = null) {
  const base     = '../../../';
  const shopBase = '../../';

  const variants        = product.variants.edges.map(e => e.node);
  const images          = product.images.edges.map(e => e.node);
  const firstAvailable  = variants.find(v => v.availableForSale) || variants[0];
  const hasVariants     = variants.length > 1 || variants[0].title !== 'Default Title';
  const swatchMap       = buildSwatchMap(product);
  const allColors       = hasVariants && variants.every(v => swatchMap[v.title]);
  // Only use variant-image mode when variants have 2+ distinct images -
  // color products often share the same image across all variants.
  const uniqueVariantImageUrls = new Set(variants.map(v => v.image?.url).filter(Boolean));
  const hasVariantImages = hasVariants && uniqueVariantImageUrls.size > 1;
  // Deduplicate by image URL so the same photo isn't shown as multiple thumbnails.
  const variantsWithImages = hasVariantImages
    ? variants.filter(v => v.image?.url).filter((v, _, arr) =>
        arr.findIndex(u => u.image.url === v.image.url) === arr.indexOf(v))
    : [];
  const mainImage     = hasVariantImages
    ? { url: firstAvailable.image?.url || images[0]?.url, altText: firstAvailable.title }
    : images[0];
  const price         = formatPrice(firstAvailable.price.amount, firstAvailable.price.currencyCode);

  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home',  item: SITE_URL + '/' },
    { '@type': 'ListItem', position: 2, name: 'Shop',  item: SITE_URL + '/shop/' },
    ...(collection ? [{ '@type': 'ListItem', position: 3, name: collection.title, item: `${SITE_URL}/shop/collections/${collection.handle}/` },
                      { '@type': 'ListItem', position: 4, name: toTitleCase(product.title), item: `${SITE_URL}/shop/products/${product.handle}/` }]
                   : [{ '@type': 'ListItem', position: 3, name: toTitleCase(product.title), item: `${SITE_URL}/shop/products/${product.handle}/` }]),
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: toTitleCase(product.title),
        description: product.description.replace(/—/g, '-'),
        image: images.map(i => i.url),
        brand: { '@type': 'Brand', name: 'LayerWeaver' },
        ...(reviewData?.count ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: reviewData.rating.toFixed(1),
            reviewCount: String(reviewData.count),
          },
        } : {}),
        offers: variants.map(v => ({
          '@type': 'Offer',
          price: parseFloat(v.price.amount).toFixed(2),
          priceCurrency: v.price.currencyCode,
          availability: v.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: `${SITE_URL}/shop/products/${product.handle}/`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  };

  const variantButtons = hasVariants
    ? variants.map(v => {
        const vPrice  = formatPrice(v.price.amount, v.price.currencyCode);
        const colorHex = swatchMap[v.title];
        const variantImage = v.image?.url || '';
        if (allColors && colorHex) {
          return `<button class="variant-btn color-swatch${v.id === firstAvailable.id ? ' active' : ''}"
                      data-variant-id="${getNumericId(v.id)}"
                      data-variant-gid="${v.id}"
                      data-price="${vPrice}"
                      data-image="${variantImage}"
                      title="${escAttr(v.title)}"
                      aria-label="${escAttr(v.title)}"
                      style="background:${colorHex};${colorHex === '#ffffff' ? 'border-color:#ddd;' : ''}"
                      ${!v.availableForSale ? 'disabled' : ''}>
                      ${!v.availableForSale ? '<span class="swatch-cross"></span>' : ''}
                  </button>`;
        }
        return `<button class="variant-btn${v.id === firstAvailable.id ? ' active' : ''}"
                    data-variant-id="${getNumericId(v.id)}"
                    data-variant-gid="${v.id}"
                    data-price="${vPrice}"
                    data-image="${variantImage}"
                    ${!v.availableForSale ? 'disabled' : ''}>
                    ${v.title}${!v.availableForSale ? ' (Sold Out)' : ''}
                </button>`;
      }).join('\n')
    : '';

  const imageThumbnails = hasVariantImages
    ? variantsWithImages.map(v => `
        <img src="${resizedImageUrl(v.image.url, IMG_WIDTH_THUMB_RAIL)}" alt="${escAttr(productImageAlt(product, v.title))}"
             class="thumbnail${v.id === firstAvailable.id ? ' active' : ''}"
             data-variant-gid="${v.id}"
             data-price="${formatPrice(v.price.amount, v.price.currencyCode)}"
             data-variant-title="${v.title}"
             loading="lazy">`).join('')
      // Also include product images not tied to any variant (lifestyle/detail shots) -
      // otherwise they'd never render since variant images replace the gallery above.
      + images.filter(img => !uniqueVariantImageUrls.has(img.url)).map(img => `
          <img src="${resizedImageUrl(img.url, IMG_WIDTH_THUMB_RAIL)}" alt="${escAttr(productImageAlt(product, img.altText))}"
               class="thumbnail" loading="lazy">`).join('')
    : images.length > 1
      ? images.map((img, i) => `
          <img src="${resizedImageUrl(img.url, IMG_WIDTH_THUMB_RAIL)}" alt="${escAttr(productImageAlt(product, img.altText))}"
               class="thumbnail${i === 0 ? ' active' : ''}" loading="lazy">`).join('')
      : '';

  const videoItems = (product.media?.edges || [])
    .map(e => e.node)
    .filter(m => m.mediaContentType === 'VIDEO' || m.mediaContentType === 'EXTERNAL_VIDEO');

  const videoThumbnails = videoItems.map(v => {
    const poster = v.previewImage?.url || '';
    if (v.mediaContentType === 'VIDEO') {
      const src = v.sources?.find(s => s.mimeType === 'video/mp4')?.url || v.sources?.[0]?.url || '';
      return `<div class="thumbnail video-thumb"
                   data-video-src="${escAttr(src)}"
                   data-video-poster="${escAttr(poster)}">
                 <img src="${escAttr(poster)}" alt="Video preview" loading="lazy">
                 <span class="video-thumb-play"><i class="fa-solid fa-play"></i></span>
             </div>`;
    } else {
      return `<div class="thumbnail video-thumb"
                   data-embed-url="${escAttr(v.embeddedUrl || '')}"
                   data-video-poster="${escAttr(poster)}">
                 <img src="${escAttr(poster)}" alt="Video preview" loading="lazy">
                 <span class="video-thumb-play"><i class="fa-solid fa-play"></i></span>
             </div>`;
    }
  }).join('');

  const thumbnails = imageThumbnails + videoThumbnails;
  const showThumbnails = thumbnails.length > 0;

  const waText = encodeURIComponent(`Hi! I'm interested in ${product.title}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${headHtml(base, shopBase, {
      title: `${escAttr(toTitleCase(product.title))} – LayerWeaver`,
      description: escAttr(truncateWords(product.description, 150)),
      ogImage: resizedImageUrl(mainImage?.url, IMG_WIDTH_OG),
      ogUrl: `${SITE_URL}/shop/products/${product.handle}/`,
      structuredData,
    })}
</head>
<body>
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>
    ${shopTrustStripHtml(base)}

    <section class="product-page">
        <div class="container">
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="${base}">Home</a>
                <span>›</span>
                <a href="${shopBase}">Shop</a>
                ${collection ? `<span>›</span><a href="${shopBase}collections/${collection.handle}/">${collection.title}</a>` : ''}
                <span>›</span>
                <span>${toTitleCase(product.title)}</span>
            </nav>

            <div class="product-layout">
                <div class="product-images">
                    <div class="main-image-wrap">
                        ${mainImage
                          ? `<img id="main-image" src="${resizedImageUrl(mainImage.url, IMG_WIDTH_MAIN)}" alt="${escAttr(productImageAlt(product, mainImage.altText))}">`
                          : '<div class="no-image"><i class="fa-solid fa-cube"></i></div>'
                        }
                        <video id="main-video" style="display:none" autoplay muted loop playsinline controls></video>
                        <iframe id="main-iframe" style="display:none" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
                    </div>
                    ${showThumbnails ? `<div class="thumbnails">${thumbnails}</div>` : ''}
                </div>

                <div class="product-details">
                    <h1>${toTitleCase(product.title)}</h1>
                    ${reviewData?.count ? starsHtml(reviewData.rating, reviewData.count, 'lg') : ''}
                    ${isContactOnly(product) ? '' : `<p class="product-price${isCustomPrice(product) ? ' custom-price' : ''}" id="product-price">${price}${isCustomPrice(product) ? '<span class="indicative-label">Final price varies with customization</span>' : ''}</p>`}

                    ${hasVariants ? `
                    <div class="variants-section">
                        <p class="variants-label">${allColors ? `Colour: <span id="selected-variant-label">${firstAvailable.title}</span>` : 'Select Option:'}</p>
                        <div class="variant-buttons" id="variant-buttons">
                            ${variantButtons}
                        </div>
                    </div>` : ''}

                    ${product.tags.includes('personalized') ? `
                    <div class="personalization-field">
                        <label for="custom-text">Personalization <span class="required">*</span></label>
                        <input type="text" id="custom-text" maxlength="20" placeholder="Enter the text to be printed">
                        <p class="field-hint">This text will appear on your item exactly as entered.</p>
                    </div>` : ''}

                    <div class="product-actions">
                        ${isContactOnly(product) || isCustomPrice(product) ? '' : `
                        <button id="add-to-cart-btn"
                                class="btn-primary add-to-cart-btn"
                                data-variant-gid="${firstAvailable.id}"
                                ${product.tags.includes('personalized') ? 'data-personalized="true"' : ''}>
                            Add to Cart
                        </button>`}
                        <button class="wishlist-btn btn-secondary wishlist-page-btn"
                                data-handle="${product.handle}"
                                data-title="${escAttr(product.title)}"
                                data-price="${isContactOnly(product) ? '' : price}"
                                data-image="${mainImage?.url || ''}"
                                data-url="${SITE_URL}/shop/products/${product.handle}/"
                                aria-label="Add to wishlist">
                            <i class="fa-regular fa-heart"></i> Wishlist
                        </button>
                        <a href="https://wa.me/917558783018?text=${waText}"
                           class="btn-secondary whatsapp-btn"
                           target="_blank">
                            <i class="fa-brands fa-whatsapp"></i> ${isContactOnly(product) || isCustomPrice(product) ? 'Order on WhatsApp' : 'Ask on WhatsApp'}
                        </a>
                    </div>

                    <div class="product-description">
                        <h3>About this product</h3>
                        ${sanitizeDescriptionHtml(product.descriptionHtml) || `<p>${product.description}</p>`}
                    </div>
                </div>
            </div>
        </div>

        ${reviewData?.reviews?.length ? `
        <div class="container">
        <div class="reviews-section">
            <h3>Customer Reviews</h3>
            <div class="reviews-aggregate">
                ${starsHtml(reviewData.rating, reviewData.count, 'lg')}
            </div>
            <div class="reviews-list">
                ${reviewData.reviews.map(reviewCardHtml).join('\n')}
            </div>
        </div>
        </div>` : ''}
    </section>

    ${footerHtml(base)}

    <script>
        const mainImg   = document.getElementById('main-image');
        const mainVideo = document.getElementById('main-video');
        const mainIframe = document.getElementById('main-iframe');

        function showMainImage(src) {
            if (mainVideo) { mainVideo.pause(); mainVideo.style.display = 'none'; }
            if (mainIframe) { mainIframe.src = ''; mainIframe.style.display = 'none'; }
            if (mainImg) { mainImg.style.display = ''; if (src) mainImg.src = src; }
        }

        function selectVariantBtn(btn) {
            document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const priceEl = document.getElementById('product-price'); if (priceEl) priceEl.textContent = btn.dataset.price;
            const label = document.getElementById('selected-variant-label');
            if (label) label.textContent = btn.title || btn.textContent.trim();
            // Only swap the image when thumbnails are variant-linked;
            // color-swatch products share one image across variants and should not reset it.
            const hasVariantThumbs = !!document.querySelector('.thumbnail[data-variant-gid]');
            if (btn.dataset.image && hasVariantThumbs) {
                showMainImage(btn.dataset.image);
                document.querySelectorAll('.thumbnail, .video-thumb').forEach(t => {
                    t.classList.toggle('active', t.dataset.variantGid === btn.dataset.variantGid);
                });
            }
        }

        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => selectVariantBtn(btn));
        });

        // Thumbnail click - handles images and video thumbnails
        document.querySelectorAll('.thumbnail, .video-thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail, .video-thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');

                if (thumb.dataset.videoSrc) {
                    if (mainImg) mainImg.style.display = 'none';
                    if (mainIframe) { mainIframe.src = ''; mainIframe.style.display = 'none'; }
                    if (mainVideo) {
                        mainVideo.src = thumb.dataset.videoSrc;
                        mainVideo.poster = thumb.dataset.videoPoster || '';
                        mainVideo.style.display = '';
                        mainVideo.play();
                    }
                } else if (thumb.dataset.embedUrl) {
                    if (mainImg) mainImg.style.display = 'none';
                    if (mainVideo) { mainVideo.pause(); mainVideo.style.display = 'none'; }
                    if (mainIframe) { mainIframe.src = thumb.dataset.embedUrl; mainIframe.style.display = ''; }
                } else {
                    showMainImage(thumb.src);
                    if (thumb.dataset.variantGid) {
                        const btn = document.querySelector(\`.variant-btn[data-variant-gid="\${thumb.dataset.variantGid}"]\`);
                        if (btn) {
                            document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            const priceEl2 = document.getElementById('product-price'); if (priceEl2) priceEl2.textContent = thumb.dataset.price;
                            const label = document.getElementById('selected-variant-label');
                            if (label) label.textContent = thumb.dataset.variantTitle || '';
                        }
                    }
                }
            });
        });

        (function() {
            const waBtn = document.querySelector('.whatsapp-btn');
            const customTextInput = document.getElementById('custom-text');
            if (!waBtn || !customTextInput) return;
            const baseText = ${JSON.stringify(`Hi! I'm interested in ${product.title}`)};
            function updateWaLink() {
                const val = customTextInput.value.trim();
                const msg = val ? baseText + '. Custom text: "' + val + '"' : baseText;
                waBtn.href = 'https://wa.me/917558783018?text=' + encodeURIComponent(msg);
            }
            customTextInput.addEventListener('input', updateWaLink);
        })();

        document.addEventListener('DOMContentLoaded', () => {
            window.LW_LOG_EVENT?.('view_item', {
                item_name: ${JSON.stringify(product.title)},
                item_id:   ${JSON.stringify(product.handle)},
                price:     ${parseFloat(firstAvailable.price.amount).toFixed(2)},
                currency:  ${JSON.stringify(firstAvailable.price.currencyCode)},
            });
            if (typeof fbq === 'function') fbq('track', 'ViewContent', {
                content_name: ${JSON.stringify(product.title)},
                content_ids:  [${JSON.stringify(getNumericId(product.id))}],
                content_type: 'product',
                value:        ${parseFloat(firstAvailable.price.amount).toFixed(2)},
                currency:     ${JSON.stringify(firstAvailable.price.currencyCode)},
            });
        });
    </script>
    ${swatchDataScript([product])}
    <script src="${shopBase}auth.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}cart.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}search.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}wishlist.js?v=${BUILD_VER}"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Collage banner (shared by shop index + collection pages) ─────────────────
// images: array of { url, altText } - up to 5 used

function collagebannerHtml(title, description, images) {
  const seen = new Set();
  const imgs = images
    .filter(i => i?.url && !seen.has(i.url) && seen.add(i.url))
    .slice(0, 5);
  const cells = imgs.map(img => `
            <div class="banner-cell">
                <img src="${resizedImageUrl(img.url, IMG_WIDTH_BANNER)}" alt="${img.altText || title}" loading="lazy">
            </div>`).join('');
  return `
    <div class="collection-banner">
        <div class="banner-collage">${cells}
        </div>
        <div class="collection-banner-overlay">
            <h1>${title}</h1>
            ${description ? `<p>${description}</p>` : ''}
        </div>
    </div>`;
}

// ── Homepage hero carousel slides (index.html) ───────────────────────────────
// Generates collage-style slides from each collection's product images,
// matching the same banner-collage pattern used on shop/collection pages.

function heroCarouselSlidesHtml(collections) {
  const BANNER_EXCLUDE = ['cone-fidget'];

  const slides = collections.map((collection, i) => {
    const seen = new Set();
    const imgs = collection.products
      .filter(p => !BANNER_EXCLUDE.includes(p.handle))
      .slice(-5)
      .map(p => p.images.edges[0]?.node)
      .filter(img => img?.url && !seen.has(img.url) && seen.add(img.url))
      .slice(0, 5);

    const cells = imgs.map(img => `
                        <div class="banner-cell">
                            <img src="${resizedImageUrl(img.url, IMG_WIDTH_BANNER)}" alt="${img.altText || collection.title}" loading="lazy">
                        </div>`).join('');

    return `
                        <a href="shop/collections/${collection.handle}/" class="hero-carousel-slide${i === 0 ? ' active' : ''}">
                            <div class="banner-collage">${cells}
                            </div>
                            <div class="hero-carousel-caption">
                                <span class="hero-carousel-title">${collection.title}</span>
                            </div>
                        </a>`;
  }).join('');

  const dots = collections.map((_, i) =>
    `\n                        <span class="hero-dot${i === 0 ? ' active' : ''}"></span>`
  ).join('');

  return { slides, dots };
}

// ── Collection page (shop/collections/[handle]/index.html) ───────────────────
// depth from root: 3  →  base = '../../../'   shopBase = '../../'

function generateCollectionPage(collection, collections, reviewsMap = {}) {
  const base     = '../../../';
  const shopBase = '../../';

  const productCards = collection.products.map(p => productCardHtml(p, '../../products/', reviewsMap[p.handle])).join('\n');

  const BANNER_EXCLUDE = ['cone-fidget'];
  const bannerImages = collection.products
    .filter(p => !BANNER_EXCLUDE.includes(p.handle))
    .slice(-5)
    .map(p => p.images.edges[0]?.node);
  const bannerHtml = collagebannerHtml(collection.title, collection.description, bannerImages);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${headHtml(base, shopBase, {
      title: `${collection.title} – LayerWeaver`,
      description: escAttr(truncateWords(
        collection.description || `Shop ${collection.title} – unique 3D printed products from LayerWeaver.`,
        150
      )),
      ogImage: resizedImageUrl(collection.image?.url, IMG_WIDTH_OG),
      ogUrl: `${SITE_URL}/shop/collections/${collection.handle}/`,
    })}
</head>
<body>
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>
    ${shopTrustStripHtml(base)}

    <section class="collection-topbar">
        <div class="container">
            ${collectionNavHtml(collections, shopBase, collection.handle)}
        </div>
    </section>

    <div class="container">
        ${bannerHtml}
    </div>

    <section class="shop-products">
        <div class="container">
            <div class="shop-grid">
${productCards}
            </div>
        </div>
    </section>

    ${footerHtml(base)}
    ${swatchDataScript(collection.products)}
    <script src="${shopBase}auth.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}cart.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}search.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}wishlist.js?v=${BUILD_VER}"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Account page (shop/account/index.html) ────────────────────────────────────
// depth from root: 2  →  base = '../../'   shopBase = '../'

function generateAccountPage() {
  const base     = '../../';
  const shopBase = '../';
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=GT-NC682MJG"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      if (location.hostname === 'www.layerweaver.com') gtag('config', 'GT-NC682MJG');
    </script>
    <!-- Meta Pixel Code -->
    <script>
    if (location.hostname === 'www.layerweaver.com') {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1677071140197155');
    fbq('track', 'PageView');
    }
    </script>
    <!-- End Meta Pixel Code -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Account – LayerWeaver</title>
    <meta name="robots" content="noindex">
    <link rel="canonical" href="${SITE_URL}/shop/account/">
    <link rel="icon" href="${base}images/spider-fevicon.svg" type="image/svg+xml">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="${base}images/spider-fevicon.svg">
    <meta name="theme-color" content="#A083D5">
    <link rel="stylesheet" href="${base}styles.css">
    <link rel="stylesheet" href="${shopBase}shop.css?v=${BUILD_VER}">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600&family=Science+Gothic:wght@400;700&display=swap" rel="stylesheet">
    ${fontAwesomeLinkHtml()}
    <script type="module">
        window.LW_LOG_EVENT = () => {};
        if (location.hostname === 'www.layerweaver.com') {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js");
            const { getAnalytics, logEvent } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js");
            const { getPerformance } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-performance.js");
            const app = initializeApp({
                apiKey: "AIzaSyA4v_CLxRxFjNsKO4M3NAiiSNF9HipccBk",
                authDomain: "layerweaver.firebaseapp.com",
                projectId: "layerweaver",
                storageBucket: "layerweaver.firebasestorage.app",
                messagingSenderId: "1056344018064",
                appId: "1:1056344018064:web:40f8e04b7dbd02d45a1c15",
                measurementId: "G-00DMH9PYCG"
            });
            const analytics = getAnalytics(app);
            getPerformance(app);
            window.LW_LOG_EVENT = (name, params) => logEvent(analytics, name, params);
        }
    </script>
</head>
<body>
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>
    ${shopTrustStripHtml(base)}

    <main class="account-page container">
        <div id="account-loading" class="account-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Loading your account…</p>
        </div>

        <div id="account-signin" class="account-state" style="display:none">
            <i class="fa-regular fa-user"></i>
            <h2>Sign in to view your account</h2>
            <p>Access your order history and manage your wishlist across devices.</p>
            <div class="account-signin-actions">
                <a href="${shopBase}" class="btn-secondary">
                    <i class="fa-solid fa-arrow-left"></i> Back to Shop
                </a>
                <button id="account-signin-btn" class="btn-primary">
                    <i class="fa-solid fa-right-to-bracket"></i> Sign In
                </button>
            </div>
        </div>

        <div id="account-content" style="display:none">
            <div class="account-hero">
                <div class="account-user-info">
                    <div class="account-avatar"><i class="fa-solid fa-user"></i></div>
                    <div>
                        <h2 id="account-name">-</h2>
                        <p id="account-email">-</p>
                    </div>
                </div>
                <button id="account-logout-btn" class="btn-secondary">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>
            </div>

            <section class="account-orders-section">
                <h3>Order History</h3>
                <div id="account-orders">
                    <div class="orders-empty">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <p>Loading orders…</p>
                    </div>
                </div>
            </section>
        </div>
    </main>

    ${footerHtml(base)}
    <script src="${shopBase}auth.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}cart.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}search.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}wishlist.js?v=${BUILD_VER}"></script>
    <script src="${shopBase}account.js?v=${BUILD_VER}"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Internal team tool: Judge.me "write a review" links ───────────────────────
// depth from root: 2  →  base = '../../'
// Not linked from any nav/sitemap - reachable only via direct URL.

function generateTeamReviewLinksPage(products) {
  const base = '../../';
  const storeLink = `https://judge.me/product_reviews/${JUDGEME_REVIEW_UUID}/new?store-review-only=true&source=shareable-link`;

  const cards = products.map(p => {
    const numId = getNumericId(p.id);
    const link = `https://judge.me/product_reviews/${JUDGEME_REVIEW_UUID}/new?id=${numId}`;
    const img = p.images.edges[0]?.node.url ? p.images.edges[0].node.url + '&width=300' : '';
    return `
        <li class="card" data-title="${escAttr(p.title.toLowerCase())}">
          <img class="card__img" src="${img}" alt="${escAttr(p.title)}" loading="lazy">
          <div class="card__body">
            <p class="card__title">${escAttr(toTitleCase(p.title))}</p>
            <code class="card__link">${escAttr(link)}</code>
            <button class="copy" type="button" data-link="${escAttr(link)}" aria-label="Copy review link for ${escAttr(p.title)}">
              <svg viewBox="0 0 20 20" class="copy__icon" aria-hidden="true"><path d="M7 2.5h7A1.5 1.5 0 0 1 15.5 4v9M4 6.5h7A1.5 1.5 0 0 1 12.5 8v9A1.5 1.5 0 0 1 11 18.5H4A1.5 1.5 0 0 1 2.5 17V8A1.5 1.5 0 0 1 4 6.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span class="copy__label">Copy link</span>
            </button>
          </div>
        </li>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Judge.me Review Links – LayerWeaver Team</title>
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" href="${base}images/spider-fevicon.svg" type="image/svg+xml">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>
      :root {
        --ink: #1c1726; --paper: #faf9fc; --paper-raised: #ffffff;
        --primary: #A083D5; --primary-ink: #5c3fa0; --accent: #EFCF20; --accent-ink: #8a7300;
        --line: #e7e2f0; --muted: #756f87; --focus: #5c3fa0;
        --shadow: 0 1px 2px rgba(28,23,38,0.04), 0 8px 24px rgba(28,23,38,0.06);
      }
      @media (prefers-color-scheme: dark) {
        :root { --ink: #f2eef9; --paper: #16121f; --paper-raised: #1f1a2b; --primary: #b39ce0; --primary-ink: #d9cdf0; --accent: #f0d84a; --accent-ink: #f0d84a; --line: #2f2941; --muted: #9992ac; --focus: #d9cdf0; --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4); }
      }
      :root[data-theme="dark"] { --ink: #f2eef9; --paper: #16121f; --paper-raised: #1f1a2b; --primary: #b39ce0; --primary-ink: #d9cdf0; --accent: #f0d84a; --accent-ink: #f0d84a; --line: #2f2941; --muted: #9992ac; --focus: #d9cdf0; --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4); }
      :root[data-theme="light"] { --ink: #1c1726; --paper: #faf9fc; --paper-raised: #ffffff; --primary: #A083D5; --primary-ink: #5c3fa0; --accent: #EFCF20; --accent-ink: #8a7300; --line: #e7e2f0; --muted: #756f87; --focus: #5c3fa0; --shadow: 0 1px 2px rgba(28,23,38,0.04), 0 8px 24px rgba(28,23,38,0.06); }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--paper); color: var(--ink); font-family: 'Open Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
      .wrap { max-width: 1180px; margin: 0 auto; padding: 48px 28px 96px; }
      .masthead { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
      .masthead__logo { width: 34px; height: 34px; flex-shrink: 0; }
      .masthead h1 { font-family: 'Montserrat', system-ui, sans-serif; font-weight: 700; font-size: clamp(1.4rem, 2.4vw, 1.9rem); letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
      .masthead__eyebrow { display: block; font-family: 'Montserrat', system-ui, sans-serif; font-weight: 600; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--primary-ink); margin-bottom: 2px; }
      .subhead { color: var(--muted); font-size: 0.95rem; max-width: 60ch; margin: 14px 0 28px; line-height: 1.6; }
      .toolbar { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-bottom: 28px; }
      .field { display: flex; flex-direction: column; gap: 6px; }
      .field__label { font-family: 'Montserrat', system-ui, sans-serif; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
      .field input { font-family: 'Open Sans', sans-serif; font-size: 0.88rem; color: var(--ink); background: var(--paper-raised); border: 1px solid var(--line); border-radius: 10px; padding: 10px 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
      .field input::placeholder { color: var(--muted); opacity: 0.7; }
      .field input:focus-visible { border-color: var(--focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 20%, transparent); }
      .empty-state { display: none; color: var(--muted); font-size: 0.9rem; padding: 40px 0; text-align: center; }
      .empty-state.is-visible { display: block; }
      @media (max-width: 620px) { .toolbar { grid-template-columns: 1fr; } }
      .featured { display: grid; grid-template-columns: 96px 1fr auto; align-items: center; gap: 20px; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--paper-raised)) 0%, color-mix(in srgb, var(--primary) 10%, var(--paper-raised)) 100%); border: 1.5px solid var(--accent); border-radius: 14px; padding: 18px 22px; margin-bottom: 40px; box-shadow: var(--shadow); }
      .featured__icon { width: 96px; height: 96px; border-radius: 10px; background: var(--paper-raised); display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); }
      .featured__icon img { width: 60%; height: 60%; }
      .featured__eyebrow { font-family: 'Montserrat', system-ui, sans-serif; font-weight: 600; font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent-ink); margin: 0 0 4px; }
      .featured__title { font-family: 'Montserrat', system-ui, sans-serif; font-weight: 700; font-size: 1.15rem; margin: 0 0 8px; }
      .featured code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.72rem; color: var(--muted); display: block; overflow-x: auto; white-space: nowrap; max-width: 100%; }
      .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
      .card { background: var(--paper-raised); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow); }
      .card__img { width: 100%; height: 148px; object-fit: cover; display: block; background: var(--line); }
      .card__body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
      .card__title { font-family: 'Montserrat', system-ui, sans-serif; font-weight: 600; font-size: 0.88rem; line-height: 1.35; margin: 0; text-wrap: balance; }
      .card__link { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.66rem; color: var(--muted); background: var(--paper); border: 1px solid var(--line); padding: 6px 8px; border-radius: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
      .copy { margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; background: var(--primary); color: #fff; border: none; border-radius: 50px; padding: 9px 14px; font-family: 'Open Sans', sans-serif; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: background 0.15s, transform 0.1s; }
      .copy:hover { background: var(--primary-ink); }
      .copy:active { transform: scale(0.97); }
      .copy:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
      .copy__icon { width: 15px; height: 15px; }
      .copy.is-copied { background: #3f9142; }
      @media (prefers-reduced-motion: reduce) { .copy { transition: none; } }
      @media (max-width: 560px) { .featured { grid-template-columns: 64px 1fr; } .featured__icon { width: 64px; height: 64px; } .featured button.copy { grid-column: 1 / -1; } }
    </style>
</head>
<body>
  <div class="wrap">
    <div class="masthead">
      <img class="masthead__logo" src="${base}images/spider-fevicon.svg" alt="">
      <div>
        <span class="masthead__eyebrow">LayerWeaver · Internal tool</span>
        <h1>Judge.me review links</h1>
      </div>
    </div>
    <p class="subhead">One shareable "write a review" link per product, plus one for an overall store rating. Copy a link and send it to a customer after their order — no Judge.me login required on their end.</p>

    <div class="toolbar">
      <div class="field">
        <label class="field__label" for="prefix">Message prefix (optional)</label>
        <input type="text" id="prefix" placeholder="e.g. Hi! Thanks for your order — mind leaving a quick review?">
      </div>
      <div class="field">
        <label class="field__label" for="search">Search products</label>
        <input type="text" id="search" placeholder="Search by product name…">
      </div>
    </div>

    <div class="featured">
      <div class="featured__icon"><img src="${base}images/spider-fevicon.svg" alt=""></div>
      <div>
        <p class="featured__eyebrow">Store-wide</p>
        <p class="featured__title">Overall store rating</p>
        <code>${escAttr(storeLink)}</code>
      </div>
      <button class="copy" type="button" data-link="${escAttr(storeLink)}" aria-label="Copy store rating link">
        <svg viewBox="0 0 20 20" class="copy__icon" aria-hidden="true"><path d="M7 2.5h7A1.5 1.5 0 0 1 15.5 4v9M4 6.5h7A1.5 1.5 0 0 1 12.5 8v9A1.5 1.5 0 0 1 11 18.5H4A1.5 1.5 0 0 1 2.5 17V8A1.5 1.5 0 0 1 4 6.5Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="copy__label">Copy link</span>
      </button>
    </div>

    <ul class="grid" id="grid">${cards}
    </ul>
    <p class="empty-state" id="emptyState">No products match "<span id="emptyStateQuery"></span>".</p>
  </div>

  <script>
    function fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const prefixInput = document.getElementById('prefix');
    document.querySelectorAll('.copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const link = btn.getAttribute('data-link');
        const prefix = prefixInput.value.trim();
        const text = prefix ? prefix + ' ' + link : link;
        try { await navigator.clipboard.writeText(text); } catch (e) { fallbackCopy(text); }
        const label = btn.querySelector('.copy__label');
        const original = label.textContent;
        label.textContent = 'Copied';
        btn.classList.add('is-copied');
        setTimeout(() => { label.textContent = original; btn.classList.remove('is-copied'); }, 1400);
      });
    });
    const searchInput = document.getElementById('search');
    const grid = document.getElementById('grid');
    const cardEls = Array.from(grid.querySelectorAll('.card'));
    const emptyState = document.getElementById('emptyState');
    const emptyStateQuery = document.getElementById('emptyStateQuery');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      cardEls.forEach(card => {
        const match = !q || card.getAttribute('data-title').includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      const showEmpty = q && visibleCount === 0;
      emptyState.classList.toggle('is-visible', showEmpty);
      grid.style.display = showEmpty ? 'none' : '';
      if (showEmpty) emptyStateQuery.textContent = searchInput.value.trim();
    });
  </script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching products from Shopify Storefront API...');
  const products = await fetchProducts();
  console.log(`Found ${products.length} product(s)`);

  console.log('Fetching collections...');
  const collections = await fetchCollections();
  console.log(`Found ${collections.length} collection(s)`);

  const reviewsMap = await fetchAllReviews(products);

  const shopDir        = path.join(__dirname, '..', 'shop');
  const productsDir    = path.join(shopDir, 'products');
  const collectionsDir = path.join(shopDir, 'collections');
  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(collectionsDir, { recursive: true });

  fs.writeFileSync(path.join(shopDir, 'index.html'), generateShopIndex(products, collections, reviewsMap));
  console.log('Generated shop/index.html');

  const searchIndex = products.map(p => ({
    handle: p.handle,
    title:  p.title,
    price:  isContactOnly(p) ? '' : formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode),
    image:  p.images.edges[0]?.node.url || '',
    tags:   p.tags.join(' '),
    desc:   p.description.slice(0, 200),
  }));
  fs.writeFileSync(path.join(shopDir, 'search-index.json'), JSON.stringify(searchIndex));
  console.log('Generated shop/search-index.json');

  const accountDir = path.join(shopDir, 'account');
  fs.mkdirSync(accountDir, { recursive: true });
  fs.writeFileSync(path.join(accountDir, 'index.html'), generateAccountPage());
  console.log('Generated shop/account/index.html');

  const teamReviewDir = path.join(__dirname, '..', 'team', 'review');
  fs.mkdirSync(teamReviewDir, { recursive: true });
  fs.writeFileSync(path.join(teamReviewDir, 'index.html'), generateTeamReviewLinksPage(products));
  console.log('Generated team/review/index.html');

  for (const collection of collections) {
    const collectionDir = path.join(collectionsDir, collection.handle);
    fs.mkdirSync(collectionDir, { recursive: true });
    fs.writeFileSync(path.join(collectionDir, 'index.html'), generateCollectionPage(collection, collections, reviewsMap));
    console.log(`Generated shop/collections/${collection.handle}/index.html`);
  }

  // Map each product handle to its first collection (for breadcrumbs)
  const productCollectionMap = {};
  for (const collection of collections) {
    for (const product of collection.products) {
      if (!productCollectionMap[product.handle]) {
        productCollectionMap[product.handle] = collection;
      }
    }
  }

  for (const product of products) {
    const productDir = path.join(productsDir, product.handle);
    fs.mkdirSync(productDir, { recursive: true });
    fs.writeFileSync(path.join(productDir, 'index.html'), generateProductPage(product, productCollectionMap[product.handle], reviewsMap[product.handle]));
    console.log(`Generated shop/products/${product.handle}/index.html`);
  }

  // Remove stale product/collection directories no longer in Shopify
  const productHandles = new Set(products.map(p => p.handle));
  for (const entry of fs.readdirSync(productsDir)) {
    if (!productHandles.has(entry)) {
      fs.rmSync(path.join(productsDir, entry), { recursive: true, force: true });
      console.log(`Removed stale shop/products/${entry}`);
    }
  }
  const collectionHandles = new Set(collections.map(c => c.handle));
  for (const entry of fs.readdirSync(collectionsDir)) {
    if (!collectionHandles.has(entry)) {
      fs.rmSync(path.join(collectionsDir, entry), { recursive: true, force: true });
      console.log(`Removed stale shop/collections/${entry}`);
    }
  }

  // Update homepage hero carousel with collage slides
  const indexPath = path.join(__dirname, '..', 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const { slides, dots } = heroCarouselSlidesHtml(collections);
  indexHtml = indexHtml.replace(
    /<!-- HERO-CAROUSEL-SLIDES-START -->[\s\S]*?<!-- HERO-CAROUSEL-SLIDES-END -->/,
    `<!-- HERO-CAROUSEL-SLIDES-START -->\n${slides}\n<!-- HERO-CAROUSEL-SLIDES-END -->`
  );
  indexHtml = indexHtml.replace(
    /<!-- HERO-CAROUSEL-DOTS-START -->[\s\S]*?<!-- HERO-CAROUSEL-DOTS-END -->/,
    `<!-- HERO-CAROUSEL-DOTS-START -->${dots}\n<!-- HERO-CAROUSEL-DOTS-END -->`
  );
  fs.writeFileSync(indexPath, indexHtml);
  console.log('Updated index.html hero carousel');

  // Generate sitemap.xml
  const STATIC_URLS = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${SITE_URL}/shop/`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/gallery/`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/workshop/`, priority: '0.7', changefreq: 'monthly' },
    { loc: `${SITE_URL}/connect/`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${SITE_URL}/faq/`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${SITE_URL}/services/on-demand/`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${SITE_URL}/services/3d-design/`, priority: '0.6', changefreq: 'monthly' },
    { loc: `${SITE_URL}/privacy-policy/`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/shipping-policy/`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/return-and-exchange-policy/`, priority: '0.3', changefreq: 'yearly' },
  ];
  const collectionUrls = collections.map(c => ({
    loc: `${SITE_URL}/shop/collections/${c.handle}/`, priority: '0.8', changefreq: 'weekly',
    lastmod: isoDateOnly(c.updatedAt),
  }));
  const productUrls = products.map(p => ({
    loc: `${SITE_URL}/shop/products/${p.handle}/`, priority: '0.7', changefreq: 'monthly',
    lastmod: isoDateOnly(p.updatedAt),
  }));
  const allUrls = [...STATIC_URLS, ...collectionUrls, ...productUrls];
  const sitemapXml = buildSitemapXml(allUrls);
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), sitemapXml);
  console.log('Generated sitemap.xml');

  console.log('Build complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
