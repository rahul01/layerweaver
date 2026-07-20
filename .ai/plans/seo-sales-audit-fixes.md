# LayerWeaver — Implementing the SEO & Sales Audit Fixes

## Status: all 6 fixes shipped 2026-07-20

| Fix | Commit | Notes |
|---|---|---|
| 2 — collection description escaping + truncation | `1e1bfd65` | shipped first, as planned |
| 1 — CDN image resizing | `e891d974` | |
| 3 — sitemap `<lastmod>` | `0dce3053` | rebuilt immediately after, per plan; no GraphQL typos |
| 4 — Font Awesome preload | `203611aa` | combined buildshop+serve check run after 1–4 together |
| 5 — GA4 ecommerce events | `16dcb8ea` | |
| 6 — first-touch attribution | `01fbf39d` | verified end-to-end via headless Playwright before committing |

Followed by two test-coverage passes, not in the original plan:
- `99590a46` — extracted `resizedImageUrl`/`escAttr`/`truncateWords`/`fontAwesomeLinkHtml` out of `build-shop.js` into a new `scripts/build-shop-utils.js` so they're unit-testable without triggering the script's live Shopify fetch; mirrored `attributionCartAttributes` into `shop/cart-utils.js` (cart.js is a plain `<script>`, can't `import`); added GA4 event and attribution E2E coverage.
- `5ecc0909` — Fix 3's sitemap logic was still inline and had no coverage; extracted `isoDateOnly()` + `buildSitemapXml()` into `build-shop-utils.js` too.

77/77 tests passing (43 unit, 34 Playwright E2E) as of `5ecc0909`. Audit report artifact updated to match: https://claude.ai/code/artifact/33fbbaed-b2c7-4778-ae96-2ef5517748e2

No deviations from the fixes as scoped below — the two follow-up commits only affected *how* the code was organized for testability, not the behavior described in each Fix section.

---

## Context

The audit of layerweaver.com (artifact published earlier) found six concrete technical fixes, all inside the static-site generator and the client-side cart. It also surfaced a handful of things that look like problems in the raw data but aren't — worth noting up front so they don't get chased as bugs:

- The "blank title" #2-revenue line item is custom on-request builds — line items entered without a catalog product attached, consistent with the site's "Order on WhatsApp" custom-quote flow. Not a data bug. Optional follow-up if wanted: give these line items a descriptive name in Shopify admin for cleaner reporting. No code change either way.
- The Jun 23 traffic spike (111 sessions, ~0% conversion) was a brand-visibility campaign, not a sales campaign — the low conversion is expected, not a funnel problem.
- The cat cable clip's 92% gross-to-net gap is the free gift-with-purchase on orders over ₹299, part of the ongoing 6-month campaign (see `6-month-campaign.md` in this same plans folder) — intentional, not a discount-code bug.
- The Octopus Table Lamp's 29% gap is a return: one unit broke in shipping. Worth a packaging sanity-check for this fragile, high-revenue item, but that's a fulfillment/ops task, not code.
- Shopify's own session dashboard shows cart additions as 0 every day — expected, not a bug. This storefront adds to cart via direct Storefront-API calls rather than Shopify's native `/cart` endpoints, which is what that dashboard metric is wired to. Not worth rebuilding the cart on a stock theme just to populate one number.

All six fixes below live in three files: `scripts/build-shop.js` (the static-site generator, run via `npm run build-shop`), `shop/cart.js` (client-side cart logic, Storefront-API based), and `script.js` (loaded on every page). Verification throughout uses the repo's own `buildshop`, `serve`, and `test` skills — no new tooling needed.

Not covered here (manual/non-code, separate from this plan):
- Adding UTM params to the Instagram bio link — a profile-settings edit, not a code change.

---

## Fix 1 — Resize product images via Shopify CDN, skip HTML width/height

**Shipped in `e891d974`.** Implemented as planned; the width constants became named exports (`IMG_WIDTH_GRID`, `IMG_WIDTH_THUMB_RAIL`, `IMG_WIDTH_MAIN`, `IMG_WIDTH_BANNER`, `IMG_WIDTH_OG`) rather than inline literals. Line numbers below drifted from the plan by the time of execution (earlier edits in the same file), but all 9 named call sites were confirmed covered post-build via `grep -o 'width=[0-9]*"' | sort | uniq -c`, which showed all 5 width buckets present with the expected counts.

`shop/shop.css` already sets `aspect-ratio: 1` on `.product-image-wrap` (line 365) and `.main-image-wrap` (line 631), and fixed `72×72px` on `.thumbnail` (line 655). Layout shift is already structurally prevented by CSS — the real problem is payload weight (1254×1254px, ~1.2MB PNGs) and LCP delay, not CLS. So this fix is CDN-resize-only; no GraphQL query change, no HTML width/height attributes.

Add a helper next to `escAttr`/`truncateWords` in `scripts/build-shop.js` (~line 280):
```js
function resizedImageUrl(url, width) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}`;
}
```
Width constants near `SITE_URL`: grid/thumbnail `500`, gallery thumbnail rail `300`, product main image `900`, banner/hero `800`, og:image `1200`.

Apply at these call sites only (all in `scripts/build-shop.js`):
| Line | What |
|---|---|
| 556 | `productCardHtml()` grid thumbnail |
| 803, 812, 816 | product-page thumbnail rail (3 code paths) |
| 880 | product-page main image |
| 1073 | `collagebannerHtml()` |
| 1104 | `heroCarouselSlidesHtml()` |
| 669, 855, 1146 | `og:image` on shop index / product / collection |

**Leave unchanged:** line 748, the JSON-LD `Product.image` array — Google's rich-result guidance wants full-resolution images there, and it isn't rendered so it costs no page weight.

**Note for later, not in this pass:** `data-image="${image?.url}"` at :564 and :782/794 (wishlist button, variant-swap JS) carry raw URLs into `data-*` attributes that client JS later renders as `<img src>`. Same issue, same fix — deliberately left out to keep this change to the 6 named sites the audit actually inspected.

**Verify:** `buildshop` → `grep -o 'src="[^"]*width=[0-9]*"' shop/index.html shop/products/*/index.html shop/collections/*/index.html | sort -u` shows resized URLs at all 6 contexts; confirm JSON-LD `image` array is untouched. `serve` → DevTools Network tab, confirm a grid-thumbnail request drops from ~1.2MB to a few hundred KB, no visual jump.

---

## Fix 2 — Fix collection-description escaping bug + tighten truncation

**Shipped in `1e1bfd65`.** Implemented exactly as planned.

**Two issues, one function.** Product-page descriptions already do `escAttr(truncateWords(product.description, 160))` correctly (build-shop.js:854). Collection-page descriptions (build-shop.js:1145) use the raw string directly — **no `escAttr()`, no truncation** — meaning a Shopify collection description containing `"` or `<`/`>` can break the `<meta content="...">` attribute or inject markup into `<head>`. This is a correctness bug, not just an SEO nicety.

Update `truncateWords` (build-shop.js:285-290) to also strip a trailing short stopword so snippets don't end on stray words like "...or as a…":
```js
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
```
Lower the budget 160 → **150** at both call sites (stopword trim + ellipsis shortens things further; 160 was already near Google's display ceiling).

Product page (build-shop.js:854): `escAttr(truncateWords(product.description, 150))`

Collection page (build-shop.js:1145) — the actual fix:
```js
description: escAttr(truncateWords(
  collection.description || `Shop ${collection.title} – unique 3D printed products from LayerWeaver.`,
  150
)),
```

**Verify:** `buildshop` → `grep -o '<meta name="description" content="[^"]*"' shop/collections/*/index.html`, confirm every value is escaped and ≤~151 chars.

---

## Fix 3 — Add `<lastmod>` to sitemap.xml

**Shipped in `0dce3053`.** Implemented as planned, rebuilt immediately after per the sequencing note below — no GraphQL typos surfaced. In the later test-coverage pass (`5ecc0909`) the date-slicing and XML-template logic below were further extracted into `isoDateOnly()` and `buildSitemapXml()` in `scripts/build-shop-utils.js`, since this was the one fix with no unit coverage; confirmed byte-identical `sitemap.xml` output before/after that extraction.

The only fix touching GraphQL query shape — isolate and rebuild immediately after to catch typos early.

Add `updatedAt` to both queries in `scripts/build-shop.js`:
- `fetchCollections()` (~line 32-65): `node { handle title description updatedAt image { url } ... }`
- `fetchProducts()` (~line 107-158): `node { id title handle tags description descriptionHtml updatedAt ... }`

Both flow through automatically (`fetchCollections` spreads `...e.node`, `fetchProducts` pushes `edge.node` directly) — no extra plumbing.

Sitemap generation (build-shop.js:1585-1610):
```js
const collectionUrls = collections.map(c => ({
  loc: `${SITE_URL}/shop/collections/${c.handle}/`, priority: '0.8', changefreq: 'weekly',
  lastmod: c.updatedAt ? c.updatedAt.slice(0, 10) : null,
}));
const productUrls = products.map(p => ({
  loc: `${SITE_URL}/shop/products/${p.handle}/`, priority: '0.7', changefreq: 'monthly',
  lastmod: p.updatedAt ? p.updatedAt.slice(0, 10) : null,
}));
// ...
allUrls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`)
```
`STATIC_URLS` entries: **omit `lastmod` entirely** — they aren't Shopify-backed, and stamping every static page with "today" on each build would be a false freshness signal, not a helpful one.

**Verify:** `buildshop` → open `sitemap.xml`, confirm `<lastmod>` on every product/collection URL, absent on the 11 static entries; spot-check one date against Shopify admin.

---

## Fix 4 — Make Font Awesome non-render-blocking

**Shipped in `203611aa`.** Implemented exactly as planned, both call sites confirmed.

New helper near `headHtml()` (~build-shop.js:330), used at both current call sites (line 379 in `headHtml()`, and line 1229 in `generateAccountPage()` which duplicates the head block inline):
```js
function fontAwesomeLinkHtml() {
  const href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  const integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==';
  const attrs = `integrity="${integrity}" crossorigin="anonymous" referrerpolicy="no-referrer"`;
  return `
    <link rel="preload" as="style" href="${href}" ${attrs} onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${href}" ${attrs}></noscript>`;
}
```
This is the standard preload-then-swap pattern — no icon subsetting or self-hosting in this pass (bigger, separate decision).

**Verify:** `buildshop`, confirm both `shop/index.html` and `shop/account/index.html` heads show the preload+noscript pair. `serve` → DevTools Network tab confirms it no longer blocks first paint; confirm icons still render (cart drawer, wishlist button, breadcrumbs). Run Lighthouse in DevTools to confirm "Eliminate render-blocking resources" clears.

---

## Fix 5 — Add GA4 ecommerce events

**Shipped in `16dcb8ea`.** Implemented as planned. E2E coverage added later (`99590a46`) hit one real gotcha worth recording: the `begin_checkout` test originally tried to verify the tracking call by aborting the checkout link's navigation request via `page.route()` — but an aborted top-level navigation still loads a Chromium `chrome-error://` page, which tears down the JS state (`window._testGtagCalls`) being inspected. Fixed by adding a second `click` listener that calls `preventDefault()` instead, letting the original click handler's tracking calls fire without the page ever navigating away.

The Meta Pixel is wired correctly — `fbq('track','AddToCart', ...)` (shop/cart.js:572) and `fbq('track','InitiateCheckout', ...)` (shop/cart.js:273) already fire on every add-to-cart and checkout click. What's missing: **no `gtag('event', 'add_to_cart', ...)` or `gtag('event', 'begin_checkout', ...)` exists anywhere in the repo**, so GA4's own ecommerce reports and any Google Ads audiences built on GA4 events are blind, even though `gtag` is loaded on every page and Firebase (`LW_LOG_EVENT`) already logs these events.

Add alongside the existing calls, reusing values already computed there — no new lookups:

`addToCartCore` (shop/cart.js:563-579), inside the `if (newLine)` block:
```js
if (typeof gtag === 'function') gtag('event', 'add_to_cart', {
  currency: newLine.merchandise.price.currencyCode,
  value:    parseFloat(newLine.merchandise.price.amount) * newLine.quantity,
  items: [{
    item_id:   newLine.merchandise.id.split('/').pop(),
    item_name: newLine.merchandise.product.title,
    price:     parseFloat(newLine.merchandise.price.amount),
    quantity:  newLine.quantity,
  }],
});
```
(`newLine.quantity` is already selected in `CART_FIELDS`, confirmed at shop/cart.js:49.)

Checkout button handler (shop/cart.js:267-280):
```js
if (typeof gtag === 'function') gtag('event', 'begin_checkout', {
  currency: cart?.cost?.totalAmount?.currencyCode || '',
  value:    parseFloat(cart?.cost?.totalAmount?.amount || 0),
  items: (cart?.lines?.edges || []).map(e => ({
    item_id:   e.node.merchandise.id.split('/').pop(),
    item_name: e.node.merchandise.product.title,
    price:     parseFloat(e.node.merchandise.price.amount),
    quantity:  e.node.quantity,
  })),
});
```

**Verify:** `serve` → open a product page with GA4 DebugView connected to property `GT-NC682MJG`. Click "Add to Cart", confirm `add_to_cart` fires with correct `items[]`. Open cart drawer, click Checkout, confirm `begin_checkout` fires with all lines. Run `npm test` (`tests/cart.e2e.spec.js`) to confirm no regression to the existing flows.

---

## Fix 6 — Capture first-touch attribution, attach to the Shopify cart

**Shipped in `01fbf39d`.** Implemented as planned. Verified with a headless Playwright script before committing (UTM capture, persistence across a UTM-less reload, `cartCreate` request body carrying `input.attributes`), then given permanent E2E coverage in `99590a46` — including a first-touch semantics test confirming a *later* visit with different UTM params does **not** override the original capture within the 30-day window (the whole point of "first-touch," as opposed to "last-touch," attribution).

Outbound clicks to WhatsApp/Instagram are already tracked (`script.js:269`, generic `gtag('event','click', ...)` fed by `href.includes('wa.me')`/`.includes('instagram.com')` detection at :261-262) — no new work needed there. The real reason 89 of 90 orders show blank/generic referrer: customers browse `www.layerweaver.com`, but `shop/cart.js:461` sends them to `cart.checkoutUrl` — a **different domain** (Shopify's checkout) — via a plain link navigation with no referrer/UTM preservation. Whatever channel brought them to the marketing site is invisible to Shopify by the time checkout happens.

**6a. Capture** — new top-level IIFE in `script.js` (loaded on every page, static and generated, so no new templating needed), not gated behind `DOMContentLoaded` since it has no DOM dependency:
```js
(function captureAttribution() {
  const KEY = 'lw_attribution';
  const TTL_DAYS = 30;
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (existing && (Date.now() - existing.capturedAt) < TTL_DAYS * 86400000) return;

    const params = new URLSearchParams(location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });

    const ref = document.referrer || '';
    let refHost = '';
    try { refHost = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch {}
    const isOwnDomain = refHost && refHost === location.hostname.replace(/^www\./, '');

    if (!Object.keys(utm).length && (!ref || isOwnDomain) && existing) return;

    localStorage.setItem(KEY, JSON.stringify({
      source: utm.utm_source || (isOwnDomain ? '' : (refHost || 'direct')),
      ...utm,
      referrer: (!isOwnDomain && ref) ? ref : '',
      landingPage: location.pathname,
      capturedAt: Date.now(),
    }));
  } catch (e) { /* localStorage unavailable - best effort only */ }
})();
```

**6b. Attach** — `CartInput.attributes` can be set directly in the same `cartCreate` mutation that already fires on first "Add to Cart" (shop/cart.js:65-73), no separate `cartAttributesUpdate` round trip needed. New helper near the top of `shop/cart.js`:
```js
function attributionCartAttributes() {
  let attribution;
  try { attribution = JSON.parse(localStorage.getItem('lw_attribution') || 'null'); } catch { return []; }
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
```
Wire into `createCart()`:
```js
async function createCart(variantId, qty, attributes = []) {
  const line = { merchandiseId: variantId, quantity: qty };
  if (attributes.length) line.attributes = attributes;
  const input = { lines: [line] };
  const attrAttrs = attributionCartAttributes();
  if (attrAttrs.length) input.attributes = attrAttrs;
  const data = await gql(`
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) { cart { ${CART_FIELDS} } }
    }`, { input });
  return data.cartCreate.cart;
}
```
Both call sites in `addToCartCore` that create a new cart funnel through `createCart()`, so both are covered automatically.

**Known limitation to accept:** a cart already sitting in a returning visitor's `localStorage` before this ships won't retroactively gain attribution — only newly-created carts after deploy will. That's in scope for capture+attach; a backfill isn't.

**Verify:** `serve` → clear `localStorage`, load a page with `?utm_source=test&utm_medium=email`, confirm `localStorage.lw_attribution` populates. Add to cart on a fresh session, inspect the `cartCreate` request in DevTools Network tab to confirm `input.attributes` was sent. Reload without UTM params inside the 30-day window, confirm `lw_attribution` isn't overwritten. For full confirmation, complete one real test checkout and check the order's "Additional details" in Shopify admin (or via `mcp__claude_ai_Shopify__get-order`) for the attribution attributes.

---

## Sequencing

Followed exactly as planned:

1. ✅ **Fix 2** (build-shop.js — escaping bug + truncation) — smallest, safest, good first commit. `1e1bfd65`
2. ✅ **Fix 1** (build-shop.js — image resizing) — independent of Fix 2. `e891d974`
3. ✅ **Fix 3** (build-shop.js — GraphQL `updatedAt` + sitemap) — isolated, rebuilt right after; no typos. `0dce3053`
4. ✅ **Fix 4** (build-shop.js — Font Awesome preload) — wrapped up all `build-shop.js` changes; combined `buildshop` + `serve` check run after 1-4 together. `203611aa`
5. ✅ **Fix 5** (shop/cart.js — GA4 events) — independent of 1-4. `16dcb8ea`
6. ✅ **Fix 6** (script.js + shop/cart.js) — last; `npm test` run after both 5 and 6 landed to confirm no regression to the existing cart flows. `01fbf39d`
7. ✅ Test coverage for all 6, added afterward, not originally planned as a separate step: `99590a46`, `5ecc0909`

## Files touched
- `scripts/build-shop.js` (Fixes 1-4)
- `shop/cart.js` (Fixes 5-6)
- `script.js` (Fix 6)
- `scripts/build-shop-utils.js` — new, added post-hoc for test coverage (not in original plan)
- `shop/cart-utils.js` — extended post-hoc for test coverage (not in original plan)
- `tests/build-shop.unit.test.js` — new
- `tests/cart.unit.test.js`, `tests/cart.e2e.spec.js` — extended
