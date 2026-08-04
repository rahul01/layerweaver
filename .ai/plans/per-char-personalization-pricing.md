# Per-Character Personalization Pricing — Plan / Status

**Status: core mechanism + cart-drawer line pairing both working.** Still
review "Open issues" before shipping live — the remaining items are smaller
(re-edit flow, admin/fulfillment visibility) than the pairing gap that used
to be here.

---

## Why

Some personalized products (starting with **Personalized Name Clicker**,
`personalized-name-clicker`) need to charge more as the customer's text gets
longer — e.g. ₹199 for the first character, +₹100 for every character after
that. Shopify's Storefront API cart cannot override a line item's price per
add, so "charge more as they type" can't be a single cart line whose price
changes live.

## Tag convention (set on the Shopify product)

- `personalized` — shows the personalization text input (existing behaviour)
- `per_char` — turns on per-character pricing for this product
- `char_100` — the rate: ₹100 per character after the first. The number is
  parsed out of the tag name. A different rate needs a different `char_N` tag
  **and** a matching entry in `PER_CHAR_SURCHARGE_VARIANTS` (see below) —
  the build throws loudly if the tag exists but no variant is configured for
  that rate, rather than silently undercharging.

`personalized-name-clicker` currently carries `personalized per_char
char_100`, base price ₹199.

## How the charge actually happens: hidden surcharge product

Created a separate Shopify product, **"Personalization Surcharge"**
(`gid://shopify/Product/9292944310494`), with one variant so far:

- `₹100 per character` — `gid://shopify/ProductVariant/48547657646302`

This product is tagged `internal surcharge` and is excluded from every
customer-facing surface by `scripts/build-shop.js`'s `main()`:

```js
const products = (await fetchProducts()).filter(p => !p.tags.includes('internal'));
```

So it never gets a product page, never appears in `shop/index.html`, the
search index, or `sitemap.xml`. `cart.js` still adds it to the cart directly
by hardcoded variant GID (via `PER_CHAR_SURCHARGE_VARIANTS` in
`build-shop.js`, baked into the product page as a `data-surcharge-gid`
attribute) — it doesn't need to be "found," just addressable.

**Important — publishing gotcha hit during setup:** a Shopify product with
`status: DRAFT` is *completely invisible* to the Storefront API, even by
direct variant GID (`cartCreate` returns "merchandise does not exist"). It
had to be set `ACTIVE` **and** explicitly published to the same two channels
real products use for this storefront: `Headless`
(`gid://shopify/Publication/171756749022`) and `Layer Weaver.Com Headless`
(`gid://shopify/Publication/171756781790`), via the `publishablePublish`
Admin API mutation. Being "Active" in the admin is not sufficient on its
own — publication to a channel is a separate step. If a future surcharge
variant silently fails to add to cart, check this first.

**Adding a new rate later:** create one more variant on the existing
"Personalization Surcharge" product (e.g. `₹50 per character`), then add its
GID to `PER_CHAR_SURCHARGE_VARIANTS` in `build-shop.js` keyed by the rate
number. No new hidden product needed unless you want it organized
differently.

## What's implemented

**`scripts/build-shop.js`**
- `PER_CHAR_SURCHARGE_VARIANTS` — rate (number) → surcharge variant GID map
- `perCharRate(product)` — returns the rate or `null`; throws on a
  misconfigured/unmapped rate
- `generateProductPage()`:
  - personalization field hint shows the per-char breakdown instead of the
    generic "this text will appear exactly as entered" copy
  - `#add-to-cart-btn` carries `data-per-char-rate`, `data-surcharge-gid`,
    `data-base-price`, `data-for-product` when the product uses per-char
    pricing
  - inline script live-recalculates `#product-price` on every keystroke in
    `#custom-text`: `basePrice + max(0, len - 1) * rate`
- `main()` filters out any product tagged `internal` before it reaches any
  page-generation step (see above)

**`shop/cart.js`**
- Refactored `addToCartCore` into a shared `addLinesCore(lines)` that can add
  several lines (different variant GIDs, different quantities/attributes) in
  one `cartCreate`/`cartLinesAdd` call, reusing the existing recovery logic
  for carts with a poisoned line
- `handleAddToCart()`: when `data-per-char-rate` + `data-surcharge-gid` are
  present and `extraChars = max(0, text.length - 1) > 0`, generates a
  one-off `_pgroup` token and adds two lines in the same call: the base
  variant (carrying `_pgroup`) and the surcharge variant at
  `quantity = extraChars * qty` (carrying `_pgroup`, `_surcharge: "true"`,
  plus customer-visible `Custom Text` / `For` attributes)
- **Line pairing** (`renderCart()`): lines whose `_surcharge` attribute is
  `"true"` are matched to the base line sharing their `_pgroup` value. A
  paired surcharge line is never rendered as its own `.cart-line` — instead
  it shows as a small note ("+ 5 extra characters: ₹500") nested under its
  base line's price, and the base line's qty/remove buttons carry
  `data-paired-line-id` pointing at it. An unpaired ("orphan") surcharge
  line — e.g. from a cart created before this fix — falls back to rendering
  as a normal standalone line rather than being silently hidden.
- Attribute keys starting with `_` (e.g. `_pgroup`, `_surcharge`) are treated
  as internal bookkeeping and filtered out of the customer-visible
  `line-attr` list.
- **Cascading mutations**: the drawer's click handler reads
  `data-paired-line-id` and passes it through to `handleUpdateLine`/
  `handleRemoveLine`, which now:
  - on qty change, compute `perUnit = pairedLine.quantity / baseLine.quantity`
    from current cart state and update both lines to
    `{ newQty, round(perUnit * newQty) }` in a single `cartLinesUpdate` call
    (`updateLines`, extended from the old single-line `updateLine`)
  - on remove, remove both line IDs in a single `cartLinesRemove` call
    (`removeLines`, extended from the old single-line `removeLine`)
- **`cleanupOrphanSurchargeLines()`**: runs alongside the existing
  `cleanupLegacyGiftLine()` on cart load/restore (including the bfcache
  `pageshow` path) and removes any surcharge line whose `_pgroup` has no
  matching base line left in the cart — closes the gap for carts created
  before this pairing existed, or any other path that removes a base line
  without going through `handleRemoveLine`.

## Verified (Playwright, local build)

- Live price updates correctly while typing: ₹199 (0–1 char) → ₹699 at
  "Raghav" (6 chars = 199 + 5×100)
- Add to Cart succeeds with no console errors
- Drawer shows **1** `.cart-line` for the personalized item (not 2) with a
  nested "+ 5 extra characters: ₹500" note; **total ₹699** — matches expected
- Incrementing the base line's qty (1→2) cascades the surcharge line
  5→10 and total 699→1398 in one update; decrementing back restores 699
- Removing the base line removes the paired surcharge line in the same
  call — cart ends up genuinely empty (0 lines), not left with an orphan
  ₹100×N charge
- `shop/products/personalization-surcharge/` does NOT get generated as a
  real page; not in `search-index.json`; not in `sitemap.xml`

## Open issues — do not consider this fully done

1. **No re-edit path.** If a customer wants to change their personalization
   text after adding to cart, there's no flow to adjust the surcharge
   quantity to match — they'd need to remove the line (now correctly removes
   both) and re-add.
2. **Multiple personalized items in one cart with different text.** Each
   distinct `Custom Text` value creates its own base line (expected,
   consistent with existing personalization behavior) and its own paired
   surcharge line (same). Not tested with 2+ per-char products in the same
   cart simultaneously — the `_pgroup` pairing is per-add-to-cart-action so
   it should hold, but hasn't been exercised.
3. **Order fulfillment visibility.** Haven't confirmed how the surcharge
   line reads in the Shopify admin order view / packing slip — worth a real
   test order before launch so whoever fulfills orders isn't confused by a
   "Personalization Surcharge ×5" line with no obvious product link beyond
   the `For` attribute.
4. Only one rate (`char_100` → ₹100) has a surcharge variant configured.
   Fine for Name Clicker today; anything tagged with a different `char_N`
   will fail the build until a matching variant + map entry is added.
5. **Pairing depends on both lines surviving Shopify's line-merge behavior
   with the same `_pgroup` value.** Not stress-tested against unusual flows
   (e.g. adding the same personalization twice in quick succession, cart
   merge on login via `syncCartFromServer`). `cleanupOrphanSurchargeLines()`
   is the safety net if a pairing ever does break, but the common paths
   (add, qty change, remove) are the ones actually verified above.

## Files touched

- `scripts/build-shop.js` — surcharge config, `perCharRate()`, product page
  markup + live price script, `internal`-tag product filter in `main()`
- `shop/cart.js` — `addLinesCore()` refactor, `updateLines`/`removeLines`
  (batched), per-char surcharge line + `_pgroup` pairing in
  `handleAddToCart()`, pairing-aware rendering in `renderCart()`, cascading
  `handleUpdateLine`/`handleRemoveLine`, `cleanupOrphanSurchargeLines()`
- `shop/shop.css` — `.line-personalization-surcharge` note style
- Shopify: new product "Personalization Surcharge"
  (`gid://shopify/Product/9292944310494`), published to `Headless` +
  `Layer Weaver.Com Headless` channels
