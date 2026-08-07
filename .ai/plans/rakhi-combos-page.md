# Rakhi Combos Page — Implementation Plan

**Source specs:** `.ai/plans/rakhi-combos-claude-code-spec.md` (technical spec), `.ai/plans/rakhi-creatives-ai-brief.md` (ad creative brief, not part of this build). Also cross-checked against `.ai/plans/raksha-bandhan-2026-campaign.md` for IP-excluded products.

**Not using Shopify Bundles for this** (unlike the Dino Skeletons bundle) — combos here are a marketing/merchandising grouping of independently purchasable products, not a single SKU. "Add All to Cart" adds each product as its own cart line.

---

## Why this deviates from the original spec

The spec (`rakhi-combos-claude-code-spec.md`) was written generically for "a headless Shopify site" and assumes a standalone `rakhi-combos.html` that calls the Storefront API live on page load, with combo data (handles, names, prices) hardcoded in a JS array.

This site doesn't work that way. Every other page — products, collections, shop index — is generated at build time by `scripts/build-shop.js` from one Storefront API fetch, with prices/images/variant GIDs baked into static HTML (see `MEMORY.md`-adjacent context: this repo's whole model is static-first, no client-side product fetching). Following the spec literally would introduce a second, inconsistent data path: a page that fetches live while every sibling page is pre-rendered, and hardcoded prices that silently drift from Shopify.

**Decision: build the combos page inside `build-shop.js`**, sourced from the same `products` array already fetched for every other page. Combo *composition* (which handles go in which combo, names, taglines, badges) stays as static config — that's inherently editorial and Shopify has no concept of it — but pricing, images, availability, and variant GIDs are pulled live from the fetched product data at build time, not hardcoded.

---

## Data validation — done, missing handles fixed

Checked every product handle in the spec's `RAKHI_COMBOS` array against the current `shop/products/` output. Two handles didn't exist in the store: `zigizigi-fidget` (used in `kid-sibling` and `fidget-collector`) and `spiral-connect-4` (used in `game-night`, as the ₹2499 hero item). Both `.ai/plans/rakhi-combos-claude-code-spec.md` and `.ai/plans/rakhi-creatives-ai-brief.md` have been updated:

- **`kid-sibling`**: `zigizigi-fidget` → `articulated-cute-spider` (₹249). New total: **₹946** (was ₹846).
- **`fidget-collector`**: `zigizigi-fidget` → `single-key-keyboard` (₹199). New total: **₹846** (unchanged — same as before since ₹149→₹199 offset the combo differently; verify against live price at build time regardless).
- **`game-night` ("Game Night Siblings", ₹3,197) — dropped entirely.** No product in the catalog is a credible substitute for a ₹2499 hero item; `tetris-balance-game` and `uno-box` (the combo's other two items) aren't enough to carry a "premium game night" combo alone. Removed from both spec docs rather than shipped weak. Revisit if a comparable product is added later.
- **Everything else** (remaining handles across the other 12 combos) exists in the current catalog — unchanged.
- All prices above are spec-doc reference values only, not build inputs — the build step below re-derives every price/image live from the Storefront fetch, so any further drift is a non-issue once implemented.
- Cross-referenced `.ai/plans/raksha-bandhan-2026-campaign.md`: confirms **Pixar lamp and Silk Song accessories are IP-excluded from all paid/catalog contexts** — neither appears in any combo. That campaign doc also references `cable-name-tag`, `name-clicker`, and `brother-sister-photo-frame` as aspirational products that **do not exist yet** — do not use them in combos until/unless they're live in Shopify.
- **New combo added**: `lip-balm-and-name` ("Little Things, Her Name") — `lip-balm-holder-keychain` (₹299) + `custom-name-keyring` (₹149, personalized). Total ₹448, qualifies for free shipping. Since `custom-name-keyring` is personalized, this combo routes to product pages instead of a direct "Add All to Cart" per the existing personalization rule (spec already lists `custom-name-keyring` in its personalized-handles note, so no separate rule change needed).
- Combo count is now **13** (started at 13, dropped 1, added 1).

---

## Implementation Steps

### 1. Combo config — new file `scripts/rakhi-combos-data.js`

Port `RAKHI_COMBOS` from the spec into a small Node-requirable module (array of `{ id, name, tagline, badge, handles: [...] }`) — **no `price` or `name`-per-product fields**, since those get resolved from live product data at build time. Drop or fix the 2 combos with missing handles first (see above — needs a decision, not silently substituted).

### 2. Extend `fetchProducts()` usage in `scripts/build-shop.js`

No new Shopify query needed — `fetchProducts()` already fetches every product with images, variants (incl. `price`, `availableForSale`, `id`), and `tags`. Build a `handle → product` lookup map once after the existing fetch and resolve each combo's `handles` against it.

- If a combo references a handle not found in the live map, **fail the build loudly** (`throw`, like the existing `data.errors` checks) rather than silently rendering a broken card — matches this script's existing error-handling style.
- Per combo, compute `totalPrice` as the sum of each product's cheapest available variant price (mirrors `priceRange.minVariantPrice` logic used elsewhere) — don't hardcode it in the config.

### 3. New page: `shop/combos/index.html`

Generated by a new `generateCombosPage(combos, reviewsMap)` function in `build-shop.js`, following the exact pattern of `generateShopIndex` / `generateCollectionPage` (same `headHtml`, `shopHeaderHtml`, `shopTrustStripHtml`, `footerHtml`, `collectionNavHtml` usage, same `base`/`shopBase` depth-relative path convention — this page sits at depth 2, so `base = '../../'`, `shopBase = '../'`).

Card markup per combo (adapting the spec's `ComboCard` structure to reuse existing CSS classes rather than inventing new ones — check `shop/shop.css` for a `.shop-product-card`-style pattern to extend, not a wholesale new component):
- Combo badge (reuse `.bundle-badge`-style pill, or a new `.combo-badge` if the copy needs to differ from "Bundle")
- Combo name + tagline
- Row of product thumbnails (reuse `resizedImageUrl` + `IMG_WIDTH_THUMB_RAIL`, link each to its product page)
- Computed total price (`formatPrice`)
- "Add All to Cart" button — `data-combo-id` + `data-variant-gids="gid1,gid2,gid3"` (first-available variant per product, same selection logic as `productCardHtml`'s `firstVariant`)
- If any product in the combo is `isContactOnly` or tagged `personalized` (reuse existing helpers from `build-shop.js`), swap the button for a link to the combo's constituent product pages instead of a cart add — per the spec's personalization carve-out — with the note copy from the spec ("Includes personalized items — you'll enter details at checkout").

Add `shop/combos/` to the sitemap generation (`buildSitemapXml` call site) alongside collections/products.

### 4. Nav entry

Add a "Rakhi Combos" (or similar) entry to `collectionNavHtml` or the main shop header nav — needs a product-owner decision on label/placement, since combos aren't a Shopify collection and shouldn't be mixed into the collection chip strip conceptually (same reasoning as keeping the Bundles collection separate from regular collections, but combos aren't even a Shopify collection at all).

### 5. Cart integration — extend `shop/cart.js`, don't duplicate it

`cart.js` already has `addLines(cartId, lines)` (plural, batched) plus `createCart`, `loadCartId`/`saveCartId`, and the existing cart-recovery logic (`recoverCart`) — all currently private to the IIFE. Per the earlier decision, expose a minimal public entry point rather than re-implementing cart logic on the combos page:

```js
window.LWCart = {
  async addLines(variantGids) { /* wraps existing cartId load/create/addLines/refreshUI */ }
};
```

The combos page's "Add All to Cart" click handler (small inline script or a new `shop/combos.js`, matching the `search.js`/`wishlist.js` per-feature file convention already in `shop/`) calls `window.LWCart.addLines(gids)`, then reflects a success state on the button per the spec ("Added! → View Cart"), without hard-redirecting — consistent with spec's stated UX intent.

### 6. Styling

Extend `shop/shop.css`. Reuse `.shop-product-card`, `.product-card-actions-row`, `.listing-add-to-cart` button styles where the combo card layout matches; add combo-specific rules only for what's genuinely new (thumbnail strip, combo badge if distinct from `.bundle-badge`). Brand purple `#A083D5` is already the site's primary (`var(--primary)`) — no new color needed.

### 7. Build + verify

- `npm run build-shop`, confirm `shop/combos/index.html` generates with correct live prices/images for all resolved combos.
- Manually test "Add All to Cart" against a real cart (both empty-cart/create path and existing-cart/add path).
- Verify personalized-item combos route to product pages instead of direct cart add.
- Confirm sitemap includes the new page.

---

## Open decisions before implementation starts

1. ~~Fix or drop the 2 combos with missing product handles~~ — **resolved**: see "Data validation" above. `kid-sibling` and `fidget-collector` fixed with substitutes; `game-night` dropped. 12 combos remain.
2. **Nav placement/label** for the combos page.
3. Confirm final URL: `shop/combos/` vs. spec's suggested `/rakhi-combos.html` — recommend `shop/combos/` for consistency with the rest of the site's URL structure (`shop/collections/...`, `shop/products/...`), but this is festival-specific content that may not want a permanent evergreen URL — worth asking whether this should be seasonal (e.g. easy to unpublish/hide after Raksha Bandhan) rather than a permanent nav item.
