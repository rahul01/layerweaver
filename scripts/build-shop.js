#!/usr/bin/env node
/**
 * build-shop.js
 * Fetches products from Shopify Storefront API and generates static HTML pages.
 * Run via GitHub Actions or locally: node scripts/build-shop.js
 */

const fs = require('fs');
const path = require('path');

const SHOPIFY_DOMAIN = 'shop.layerweaver.com';
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_TOKEN || '7f0eafeb115e99a4a917e044a1fb4125';
const SITE_URL = 'https://www.layerweaver.com';
const BUILD_VER = Date.now();

async function fetchCollections() {
  const query = `{
    collections(first: 20, sortKey: TITLE) {
      edges {
        node {
          handle title description
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
            id title handle tags description descriptionHtml
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 5) {
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

function escAttr(str) {
  return String(str).replace(/—/g, '-').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${ogUrl}">
    <meta property="og:type" content="website">
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
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

function announcementBarHtml() {
  return `
    <div class="announcement-bar">
        <a href="/shop/">
            <span class="announcement-bar__full">LayerWeaver turns 6 months! <strong>Free Shipping</strong> on all orders + Free Cat Cable Clip on orders above ₹299! Offer lasts till 1st July!</span><span class="announcement-bar__short"><span class="announcement-bar__marquee"><span class="announcement-bar__item"><strong>Free Shipping</strong> on all orders + Free Cat Cable Clip on ₹299+!</span><span class="announcement-bar__sep">·</span><span class="announcement-bar__item">Offer lasts till 1st July!</span><span class="announcement-bar__sep">·</span><span class="announcement-bar__item"><strong>Free Shipping</strong> on all orders + Free Cat Cable Clip on ₹299+!</span><span class="announcement-bar__sep">·</span><span class="announcement-bar__item">Offer lasts till 1st July!</span><span class="announcement-bar__sep">·</span></span></span>
        </a>
    </div>`;
}

function shopHeaderHtml(base, shopBase) {
  return `
    <header class="shop-header">
        <div class="container">
            <a href="${base}" class="logo-container logo-link">
                <img src="${base}images/layerweaver-logo.svg" alt="LayerWeaver Logo" class="logo">
                <h1>LayerWeaver</h1>
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
        ${shopTrustStripHtml(base)}
    </header>`;
}

function shopTrustStripHtml(base) {
  const items = [
    { href: `${base}faq/#material`,                icon: 'fa-leaf',             color: '#4CAF50', label: 'Eco-Friendly &amp; Renewable PLA' },
    { href: `${base}return-and-exchange-policy/`,icon: 'fa-rotate-left',      color: '#2196F3', label: 'Easy Returns &amp; Exchanges' },
    { href: `${base}workshop/`,                  icon: 'fa-chalkboard-user',  color: '#FF7043', label: '3D Printing Workshops for All Ages' },
    { href: `https://wa.me/917558783018`,        icon: 'fa-whatsapp',         color: '#25D366', label: 'Chat with Us on WhatsApp', target: '_blank', brand: true },
    { href: `https://instagram.com/thelayerweaver`, icon: 'fa-instagram',      color: '#E1306C', label: 'Follow Us for Exciting Builds &amp; Offers', target: '_blank', brand: true },
    { href: `${base}#testimonials`,              icon: 'fa-star',             color: '#FFC107', label: 'Customer Reviews' },
    { href: `${base}services/on-demand/`,        icon: 'fa-pen-ruler',        color: '#A083D5', label: 'Custom Orders Welcome' },
    {                                              icon: 'fa-gift',             color: '#e67e22', label: 'Free Cat Cable Clip on ₹299+' },
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

function productCardHtml(product, productsBase) {
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
                    ? `<img src="${image.url}" alt="${escAttr(image.altText || product.title)}" loading="lazy">`
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
                  ${isContactOnly(product) ? '' : `<p class="product-price">${priceDisplay}</p>`}
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

function generateShopIndex(products, collections) {
  const base     = '../';
  const shopBase = './';

  const productCards = products.map(p => productCardHtml(p, 'products/')).join('\n');

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
      description: 'Celebrating 6 months of LayerWeaver! Free shipping on every order - no minimum. Browse unique 3D printed gifts, decor, and toys.',
      ogUrl: `${SITE_URL}/shop/`,
      ogImage: products[0]?.images.edges[0]?.node.url,
    })}
</head>
<body class="has-announcement">
    ${announcementBarHtml()}
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>

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

function generateProductPage(product, collection) {
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
        <img src="${v.image.url}" alt="${escAttr(v.title)}"
             class="thumbnail${v.id === firstAvailable.id ? ' active' : ''}"
             data-variant-gid="${v.id}"
             data-price="${formatPrice(v.price.amount, v.price.currencyCode)}"
             data-variant-title="${v.title}"
             loading="lazy">`).join('')
    : images.length > 1
      ? images.map((img, i) => `
          <img src="${img.url}" alt="${escAttr(img.altText || product.title)}"
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
      description: escAttr(product.description.slice(0, 160)),
      ogImage: mainImage?.url,
      ogUrl: `${SITE_URL}/shop/products/${product.handle}/`,
      structuredData,
    })}
</head>
<body class="has-announcement">
    ${announcementBarHtml()}
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>

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
                          ? `<img id="main-image" src="${mainImage.url}" alt="${escAttr(mainImage.altText || product.title)}">`
                          : '<div class="no-image"><i class="fa-solid fa-cube"></i></div>'
                        }
                        <video id="main-video" style="display:none" autoplay muted loop playsinline controls></video>
                        <iframe id="main-iframe" style="display:none" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
                    </div>
                    ${showThumbnails ? `<div class="thumbnails">${thumbnails}</div>` : ''}
                </div>

                <div class="product-details">
                    <h1>${toTitleCase(product.title)}</h1>
                    ${isContactOnly(product) ? '' : `<p class="product-price" id="product-price">${price}</p>`}

                    ${hasVariants ? `
                    <div class="variants-section">
                        <p class="variants-label">${allColors ? `Colour: <span id="selected-variant-label">${firstAvailable.title}</span>` : 'Select Option:'}</p>
                        <div class="variant-buttons" id="variant-buttons">
                            ${variantButtons}
                        </div>
                    </div>` : ''}

                    ${product.tags.includes('personalized') && !isContactOnly(product) ? `
                    <div class="personalization-field">
                        <label for="custom-text">Personalization <span class="required">*</span></label>
                        <input type="text" id="custom-text" maxlength="20" placeholder="Enter the text to be printed">
                        <p class="field-hint">This text will appear on your item exactly as entered.</p>
                    </div>` : ''}

                    <div class="product-actions">
                        ${isContactOnly(product) ? '' : `
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
                            <i class="fa-brands fa-whatsapp"></i> ${isContactOnly(product) ? 'Request on WhatsApp' : 'Ask on WhatsApp'}
                        </a>
                    </div>

                    <div class="product-description">
                        <h3>About this product</h3>
                        ${sanitizeDescriptionHtml(product.descriptionHtml) || `<p>${product.description}</p>`}
                    </div>
                </div>
            </div>
        </div>
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

        document.addEventListener('DOMContentLoaded', () => {
            window.LW_LOG_EVENT?.('view_item', {
                item_name: ${JSON.stringify(product.title)},
                item_id:   ${JSON.stringify(product.handle)},
                price:     ${parseFloat(firstAvailable.price.amount).toFixed(2)},
                currency:  ${JSON.stringify(firstAvailable.price.currencyCode)},
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
                <img src="${img.url}" alt="${img.altText || title}" loading="lazy">
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
                            <img src="${img.url}" alt="${img.altText || collection.title}" loading="lazy">
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

function generateCollectionPage(collection, collections) {
  const base     = '../../../';
  const shopBase = '../../';

  const productCards = collection.products.map(p => productCardHtml(p, '../../products/')).join('\n');

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
      description: collection.description || `Shop ${collection.title} – unique 3D printed products from LayerWeaver.`,
      ogImage: collection.image?.url,
      ogUrl: `${SITE_URL}/shop/collections/${collection.handle}/`,
    })}
</head>
<body class="has-announcement">
    ${announcementBarHtml()}
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>

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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Account – LayerWeaver</title>
    <link rel="icon" href="${base}images/spider-fevicon.svg" type="image/svg+xml">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="${base}images/spider-fevicon.svg">
    <meta name="theme-color" content="#A083D5">
    <link rel="stylesheet" href="${base}styles.css">
    <link rel="stylesheet" href="${shopBase}shop.css?v=${BUILD_VER}">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600&family=Science+Gothic:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
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
<body class="has-announcement">
    ${announcementBarHtml()}
    ${shopHeaderHtml(base, shopBase)}
    <div class="header-spacer"></div>

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching products from Shopify Storefront API...');
  const products = await fetchProducts();
  console.log(`Found ${products.length} product(s)`);

  console.log('Fetching collections...');
  const collections = await fetchCollections();
  console.log(`Found ${collections.length} collection(s)`);

  const shopDir        = path.join(__dirname, '..', 'shop');
  const productsDir    = path.join(shopDir, 'products');
  const collectionsDir = path.join(shopDir, 'collections');
  fs.mkdirSync(productsDir, { recursive: true });
  fs.mkdirSync(collectionsDir, { recursive: true });

  fs.writeFileSync(path.join(shopDir, 'index.html'), generateShopIndex(products, collections));
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

  for (const collection of collections) {
    const collectionDir = path.join(collectionsDir, collection.handle);
    fs.mkdirSync(collectionDir, { recursive: true });
    fs.writeFileSync(path.join(collectionDir, 'index.html'), generateCollectionPage(collection, collections));
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
    fs.writeFileSync(path.join(productDir, 'index.html'), generateProductPage(product, productCollectionMap[product.handle]));
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
  }));
  const productUrls = products.map(p => ({
    loc: `${SITE_URL}/shop/products/${p.handle}/`, priority: '0.7', changefreq: 'monthly',
  }));
  const allUrls = [...STATIC_URLS, ...collectionUrls, ...productUrls];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    allUrls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
  }\n</urlset>\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), sitemapXml);
  console.log('Generated sitemap.xml');

  console.log('Build complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
