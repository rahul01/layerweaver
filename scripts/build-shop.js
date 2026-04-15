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

async function fetchProducts() {
  const query = `
    query getProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id title handle description
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            images(first: 5) {
              edges { node { url altText } }
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

function formatPrice(amount, currencyCode) {
  const n = parseFloat(amount);
  return currencyCode === 'INR' ? `₹${n.toFixed(0)}` : `${currencyCode} ${n.toFixed(2)}`;
}

// ── HTML partials (all paths relative to site root via `base`) ────────────────
// base:     path from this file back to site root  (e.g. '../' or '../../../')
// shopBase: path from this file back to shop/       (e.g. './'  or '../../')

function headHtml(base, shopBase, { title, description, ogImage, ogUrl, structuredData }) {
  return `
    <meta charset="UTF-8">
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
    <link rel="apple-touch-icon" href="${base}images/spider-fevicon.svg">
    <meta name="theme-color" content="#A083D5">
    <link rel="stylesheet" href="${base}styles.css">
    <link rel="stylesheet" href="${shopBase}shop.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600&family=Science+Gothic:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />`;
}

function shopHeaderHtml(base) {
  return `
    <header class="shop-header">
        <div class="container">
            <a href="${base}" class="logo-container logo-link">
                <img src="${base}images/layerweaver-logo.svg" alt="LayerWeaver Logo" class="logo">
                <h1>LayerWeaver</h1>
            </a>
            <nav class="shop-nav">
                <!-- cart.js injects cart icon here -->
            </nav>
        </div>
    </header>`;
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
                        <p>Affordable 3D Printing Solutions for Everyone</p>
                    </div>
                </div>
                <nav class="footer-nav">
                    <a href="${base}">Home</a>
                    <a href="${base}shop/">Shop</a>
                    <a href="${base}#services">Services</a>
                    <a href="${base}gallery/">Gallery</a>
                    <a href="${base}workshop/">Workshops</a>
                    <a href="${base}#about">About</a>
                    <a href="${base}connect/">Contact Us</a>
                </nav>
                <div class="footer-right">
                    <p>&copy; 2025 <span class="brand-text-small">LayerWeaver</span>. All rights reserved.</p>
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

// ── Shop index (shop/index.html) ──────────────────────────────────────────────
// depth from root: 1  →  base = '../'   shopBase = './'

function generateShopIndex(products) {
  const base     = '../';
  const shopBase = './';

  const productCards = products.map(product => {
    const minPrice   = formatPrice(product.priceRange.minVariantPrice.amount, product.priceRange.minVariantPrice.currencyCode);
    const maxPrice   = formatPrice(product.priceRange.maxVariantPrice.amount, product.priceRange.maxVariantPrice.currencyCode);
    const priceDisplay = product.priceRange.minVariantPrice.amount === product.priceRange.maxVariantPrice.amount
      ? minPrice : `${minPrice} – ${maxPrice}`;
    const image         = product.images.edges[0]?.node;
    const available     = product.variants.edges.some(v => v.node.availableForSale);
    const firstVariant  = product.variants.edges.find(v => v.node.availableForSale)?.node
                          || product.variants.edges[0].node;
    const hasMultiple   = product.variants.edges.length > 1 && product.variants.edges[0].node.title !== 'Default Title';
    const swatchMap     = buildSwatchMap(product);
    const allAreColors  = hasMultiple && product.variants.edges.every(e => swatchMap[e.node.title]);

    const colorSwatchesHtml = allAreColors
      ? `<div class="listing-color-swatches">${
          product.variants.edges.map(e => e.node).map(v => {
            const hex = swatchMap[v.title];
            const isFirst = v.id === firstVariant.id;
            return `<button class="listing-swatch${isFirst ? ' active' : ''}${!v.availableForSale ? ' sold-out' : ''}"
                         style="background:${hex}${hex === '#ffffff' ? ';border-color:#ddd' : ''}"
                         title="${v.title}"
                         data-variant-gid="${v.id}"
                         data-variant-id="${getNumericId(v.id)}"
                         data-price="${formatPrice(v.price.amount, v.price.currencyCode)}"
                         ${!v.availableForSale ? 'disabled' : ''}></button>`;
          }).join('')
        }</div>`
      : (hasMultiple ? `<a href="products/${product.handle}/" class="listing-choose-link">Choose option</a>` : '');

    return `
        <div class="shop-product-card">
            <a href="products/${product.handle}/" class="product-card-link">
                <div class="product-image-wrap">
                    ${image
                      ? `<img src="${image.url}" alt="${image.altText || product.title}" loading="lazy">`
                      : '<div class="no-image"><i class="fa-solid fa-cube"></i></div>'
                    }
                    ${!available ? '<span class="sold-out-badge">Sold Out</span>' : ''}
                    <button class="wishlist-btn"
                            data-handle="${product.handle}"
                            data-title="${product.title}"
                            data-price="${priceDisplay}"
                            data-image="${image?.url || ''}"
                            data-url="products/${product.handle}/"
                            aria-label="Add to wishlist">
                        <i class="fa-regular fa-heart"></i>
                    </button>
                </div>
                <div class="product-card-info">
                    <h3>${product.title}</h3>
                    <p class="product-price">${priceDisplay}</p>
                </div>
            </a>
            ${available
              ? `<div class="product-card-actions">
                    ${colorSwatchesHtml}
                    <div class="product-card-actions-row">
                        <button class="listing-add-to-cart"
                                data-variant-gid="${firstVariant.id}">
                            Add to Cart
                        </button>
                    </div>
                </div>`
              : '<span class="btn-disabled">Sold Out</span>'
            }
        </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${headHtml(base, shopBase, {
      title: 'Shop – LayerWeaver 3D Printed Products',
      description: 'Browse and buy unique 3D printed products from LayerWeaver – affordable, handcrafted, and shipped to you.',
      ogUrl: `${SITE_URL}/shop/`,
      ogImage: products[0]?.images.edges[0]?.node.url,
    })}
</head>
<body>
    ${shopHeaderHtml(base)}

    <section class="shop-products">
        <div class="container">
            <div class="shop-grid">
${productCards}
            </div>
        </div>
    </section>

    ${footerHtml(base)}
    ${swatchDataScript(products)}
    <script src="auth.js"></script>
    <script src="cart.js"></script>
    <script src="wishlist.js"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Product page (shop/products/[handle]/index.html) ──────────────────────────
// depth from root: 3  →  base = '../../../'   shopBase = '../../'

function generateProductPage(product) {
  const base     = '../../../';
  const shopBase = '../../';

  const variants      = product.variants.edges.map(e => e.node);
  const images        = product.images.edges.map(e => e.node);
  const firstAvailable = variants.find(v => v.availableForSale) || variants[0];
  const hasVariants   = variants.length > 1 || variants[0].title !== 'Default Title';
  const swatchMap     = buildSwatchMap(product);
  const mainImage     = images[0];
  const price         = formatPrice(firstAvailable.price.amount, firstAvailable.price.currencyCode);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: images.map(i => i.url),
    brand: { '@type': 'Brand', name: 'LayerWeaver' },
    offers: variants.map(v => ({
      '@type': 'Offer',
      price: parseFloat(v.price.amount).toFixed(2),
      priceCurrency: v.price.currencyCode,
      availability: v.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/shop/products/${product.handle}/`,
    })),
  };

  // Detect if all variants are colors
  const allColors = hasVariants && variants.every(v => swatchMap[v.title]);

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
                      title="${v.title}"
                      aria-label="${v.title}"
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

  const thumbnails = images.length > 1
    ? images.map((img, i) => `
        <img src="${img.url}" alt="${img.altText || product.title}"
             class="thumbnail${i === 0 ? ' active' : ''}" loading="lazy">`).join('')
    : '';

  const waText = encodeURIComponent(`Hi! I'm interested in ${product.title}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    ${headHtml(base, shopBase, {
      title: `${product.title} – LayerWeaver`,
      description: product.description.slice(0, 160),
      ogImage: mainImage?.url,
      ogUrl: `${SITE_URL}/shop/products/${product.handle}/`,
      structuredData,
    })}
</head>
<body>
    ${shopHeaderHtml(base)}

    <section class="product-page">
        <div class="container">
            <nav class="breadcrumb">
                <a href="${shopBase}">Shop</a> <span>/</span> <span>${product.title}</span>
            </nav>

            <div class="product-layout">
                <div class="product-images">
                    <div class="main-image-wrap">
                        ${mainImage
                          ? `<img id="main-image" src="${mainImage.url}" alt="${mainImage.altText || product.title}">`
                          : '<div class="no-image"><i class="fa-solid fa-cube"></i></div>'
                        }
                    </div>
                    ${images.length > 1 ? `<div class="thumbnails">${thumbnails}</div>` : ''}
                </div>

                <div class="product-details">
                    <h1>${product.title}</h1>
                    <p class="product-price" id="product-price">${price}</p>

                    ${hasVariants ? `
                    <div class="variants-section">
                        <p class="variants-label">${allColors ? `Colour: <span id="selected-variant-label">${firstAvailable.title}</span>` : 'Select Option:'}</p>
                        <div class="variant-buttons" id="variant-buttons">
                            ${variantButtons}
                        </div>
                    </div>` : ''}

                    <div class="product-actions">
                        <button id="add-to-cart-btn"
                                class="btn-primary add-to-cart-btn"
                                data-variant-gid="${firstAvailable.id}">
                            Add to Cart
                        </button>
                        <button class="wishlist-btn btn-secondary wishlist-page-btn"
                                data-handle="${product.handle}"
                                data-title="${product.title}"
                                data-price="${price}"
                                data-image="${mainImage?.url || ''}"
                                data-url="${SITE_URL}/shop/products/${product.handle}/"
                                aria-label="Add to wishlist">
                            <i class="fa-regular fa-heart"></i> Wishlist
                        </button>
                        <a href="https://wa.me/917558783018?text=${waText}"
                           class="btn-secondary whatsapp-btn"
                           target="_blank">
                            <i class="fa-brands fa-whatsapp"></i> Ask on WhatsApp
                        </a>
                    </div>

                    <div class="product-description">
                        <h3>About this product</h3>
                        <p>${product.description.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    ${footerHtml(base)}

    <script>
        // Variant selection — sync price, image, Buy Now link, colour label
        document.querySelectorAll('.variant-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('product-price').textContent = btn.dataset.price;
                const label = document.getElementById('selected-variant-label');
                if (label) label.textContent = btn.title || btn.textContent.trim();
                // Swap main image
                const mainImg = document.getElementById('main-image');
                if (mainImg && btn.dataset.image) {
                    mainImg.src = btn.dataset.image;
                    // Sync thumbnail highlight
                    document.querySelectorAll('.thumbnail').forEach(t => {
                        t.classList.toggle('active', t.src === btn.dataset.image);
                    });
                }
            });
        });

        // Image thumbnails
        const mainImg = document.getElementById('main-image');
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                if (mainImg) mainImg.src = thumb.src;
            });
        });
    </script>
    ${swatchDataScript([product])}
    <script src="${shopBase}auth.js"></script>
    <script src="${shopBase}cart.js"></script>
    <script src="${shopBase}wishlist.js"></script>
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Account – LayerWeaver</title>
    <link rel="stylesheet" href="${base}styles.css">
    <link rel="stylesheet" href="${shopBase}shop.css">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600&family=Science+Gothic:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
</head>
<body>
    ${shopHeaderHtml(base)}

    <main class="account-page container">
        <div id="account-loading" class="account-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Loading your account…</p>
        </div>

        <div id="account-signin" class="account-state" style="display:none">
            <i class="fa-regular fa-user"></i>
            <h2>Sign in to view your account</h2>
            <p>Access your order history and manage your wishlist across devices.</p>
            <button id="account-signin-btn" class="btn-primary">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
        </div>

        <div id="account-content" style="display:none">
            <div class="account-hero">
                <div class="account-user-info">
                    <div class="account-avatar"><i class="fa-solid fa-user"></i></div>
                    <div>
                        <h2 id="account-name">—</h2>
                        <p id="account-email">—</p>
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
    <script src="${shopBase}auth.js"></script>
    <script src="${shopBase}cart.js"></script>
    <script src="${shopBase}wishlist.js"></script>
    <script src="${shopBase}account.js"></script>
    <script src="${base}script.js"></script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching products from Shopify Storefront API...');
  const products = await fetchProducts();
  console.log(`Found ${products.length} product(s)`);

  const shopDir    = path.join(__dirname, '..', 'shop');
  const productsDir = path.join(shopDir, 'products');
  fs.mkdirSync(productsDir, { recursive: true });

  fs.writeFileSync(path.join(shopDir, 'index.html'), generateShopIndex(products));
  console.log('Generated shop/index.html');

  const accountDir = path.join(shopDir, 'account');
  fs.mkdirSync(accountDir, { recursive: true });
  fs.writeFileSync(path.join(accountDir, 'index.html'), generateAccountPage());
  console.log('Generated shop/account/index.html');

  for (const product of products) {
    const productDir = path.join(productsDir, product.handle);
    fs.mkdirSync(productDir, { recursive: true });
    fs.writeFileSync(path.join(productDir, 'index.html'), generateProductPage(product));
    console.log(`Generated shop/products/${product.handle}/index.html`);
  }

  console.log('Build complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
