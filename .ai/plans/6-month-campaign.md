# 6-Month Celebration Campaign - Change Summary

> **Status: Active again, extended to 5th July.** The campaign was reverted on
> 2026-07-02 (commit `209c6513`), then restored the same day (commits `75e15d52`,
> `78a7370b`) after a technical issue caused users to miss the last day of the
> original window - see "Extension Notes" below. The "How to Revert" section
> further down is accurate again and should be re-run once the campaign truly
> ends on 5th July; ignore its "✅ DONE" / checked-off state, that refers to the
> now-superseded 2026-07-02 revert.

## Campaign Overview
- **Occasion:** 6 months of LayerWeaver
- **Dates:** 20 June - 5 July 2026 (extended from the original 1 July end date)
- **Offers:** Free shipping sitewide (no minimum) + Free Cat Cable Clip on orders above ₹299
- **Scope:** All pages across layerweaver.com
- **Commits:** 562e5ee, 3e9ad42, 52ac59a4, 453a9889 (original), 78a7370b (date extension)

---

## Changes Made

### 1. Announcement Bar (all pages)
- **Files:** Every `index.html` across the site (70+ pages)
- **What:** Fixed purple bar at the top of every page above the header
- **Desktop text:** "LayerWeaver turns 6 months! **Free Shipping** on all orders + Free Cat Cable Clip on orders above ₹299! Offer lasts till 1st July!"
- **Mobile:** Horizontal scrolling marquee with two items separated by dots: "**Free Shipping** on all orders + Free Cat Cable Clip on ₹299+!" and "Offer lasts till 1st July!" - scrolls continuously at 14s/cycle
- **Behavior:** `body.has-announcement` class drives header offset and layout adjustments
- **CSS:** `styles.css` - `.announcement-bar`, `.announcement-bar__full`, `.announcement-bar__short`, `.announcement-bar__marquee`, `.announcement-bar__item`, `.announcement-bar__sep`, `@keyframes announcement-marquee`

### 2. Header Changes
- **Logo subtext:** "Celebrating 6 Months!" yellow sticker with torn-edge clip-path below logo (CSS-only via `::after`)
- **Shop button color:** Changed from purple to yellow (`var(--secondary)`) sitewide - `.btn-primary`, `.hero-shop-btn`, nav links
- **Header offset:** `script.js` dynamically syncs header `top` to announcement bar height (no hardcoded pixel gaps)

### 3. Shop Trust Strip (marquee)
- **Files:** `shop/index.html`, all product pages, all collection pages
- **What:** Moved inside `<header>` element so it stays fixed with the header on scroll
- **Text change:** "Free Shipping Above ₹500" changed to "Free Shipping on All Orders"
- **New item:** "Free Cat Cable Clip on ₹299+" added to marquee (orange #e67e22)

### 4. Shipping Policy Page
- **File:** `shipping-policy/index.html`
- **What:** Added celebration offer as primary text, standard rates shown as post-celebration fallback

### 5. FAQ Page
- **File:** `faq/index.html`
- **What:** Updated shipping FAQ answer to mention free shipping celebration and no minimum

### 6. Shop OG Meta
- **File:** `shop/index.html`
- **What:** Updated `og:description` to mention the celebration and free shipping

### 7. Cart - Free Shipping
- **File:** `shop/cart.js`
- **What:** `FREE_SHIPPING_MIN` set to `0` (was 500)
- **Cart drawer:** Green "Free shipping on all orders!" banner at top of cart (below header, above items)
- **Progress bar:** Removed shipping progress bar (no longer needed)

### 8. Cart - Free Gift (Cat Cable Clip)
- **File:** `shop/cart.js`
- **What:** `FREE_GIFT_MIN = 299`, `FREE_GIFT_NAME = 'Cat Cable Clip'`
- **Shopify discount:** `FREEGIFT299` code configured in Shopify Admin, requires "all-products" collection
- **Auto-add:** Gift line auto-added to cart with `_gift` attribute when qualifying total >= ₹299
- **Auto-remove:** Gift line and discount code removed when qualifying total drops below ₹299
- **Qualifying total:** Summed from non-gift lines directly (not subtracted from Shopify total)
- **Cart drawer:** Orange progress bar, gift shown with "FREE" price, dashed orange border, no qty controls
- **Confetti:** Plays when gift goal is reached
- **Speech bubble:** Shows gift progress near cart icon
- **See also:** `.ai/plans/free-gift-cart-integration.md` for full implementation details and edge cases

### 9. Confetti on First Item
- **File:** `shop/cart.js`
- **What:** Confetti animation triggers when the first item is added to cart (cart goes from 0 to 1+ items)

### 10. Mobile Improvements
- **Hero Shop Now button:** Moves to top of hero section on mobile (order: -1) with full width
- **FAB (Floating Action Button):** Yellow blast/starburst shaped bag icon, fixed bottom-right on mobile, links to /shop/
- **Announcement bar:** Horizontal marquee on mobile (<=900px) scrolling offer text + deadline; desktop shows full static text
- **File:** `index.html` (FAB HTML), `styles.css` (all mobile styles)

### 11. Scroll Behavior Fix
- **File:** `script.js`
- **What:** Header scroll shrink effect now uses `paddingTop`/`paddingBottom` instead of `padding` shorthand (was wiping horizontal padding on shop pages)
- **Shop pages:** Padding applied to `.container` inside header (not the header itself, which holds the trust strip)
- **Non-shop pages:** Padding applied to header directly (original behavior)
- **Spacer sync:** `header-spacer` and `.collection-topbar` top values set dynamically from actual header height

### 12. Build Script
- **File:** `scripts/build-shop.js`
- **What:** Updated `shopHeaderHtml()` to include trust strip inside header, added `announcementBarHtml()` function
- **Generated pages:** All shop/product/collection pages now include the campaign elements
- **Trust strip:** "Free Shipping on All Orders" + "Free Cat Cable Clip on ₹299+" in marquee

---

## How to Revert (End of Campaign) — ⏳ pending again, re-run when the campaign truly ends on 5th July

This ran once (commit `209c6513`, 2026-07-02) and every step below worked as
written. It was then itself reverted (commits `75e15d52`/`78a7370b`) to restore
the campaign through the new 5th July end date - see "Extension Notes" below.
Checkboxes reset to unchecked; this is the accurate to-do list for the *next*
revert. Steps 5 and 7 have footnotes below from lessons learned executing this
the first time - still valid.

1. [ ] **Remove announcement bar HTML** from all pages (or remove `body.has-announcement` class)
   - **Scope note (found re-verifying this session, 2026-07-06):** `build-shop.js` only regenerates the ~48 `shop/*` pages (fixed automatically by step 13's rebuild). The other 14 pages - `index.html`, `404.html`, `connect/`, `enroll/`, `enroll-adult/`, `faq/`, `gallery/`, `privacy-policy/`, `return-and-exchange-policy/`, `services/3d-design/`, `services/on-demand/`, `shipping-policy/`, `terms-of-service/`, `workshop/` - hardcode the `<div class="announcement-bar">...</div>` block and `<body class="has-announcement">` by hand, with no shared include system. Confirmed the block is byte-identical across all 14 (only the `<a href="shop/">` vs `<a href="/shop/">` prefix differs by nesting depth) - script the removal across these 14 files rather than editing by hand, to avoid missing one.
   - **Related cleanup found the same session:** 7 of those 14 pages (`enroll/index.html:50`, `enroll-adult/index.html:50`, and `body.has-announcement .policy-hero` in `faq/`, `privacy-policy/`, `return-and-exchange-policy/`, `shipping-policy/`, `terms-of-service/` around line 71-74) carry their own inline `<style>` block with `body.has-announcement` rules, separate from the global `styles.css` covered in step 10. Once the body class is removed these become dead CSS - delete them in the same pass.
   - **Checked and ruled out:** `script.js`'s header-offset sync (`document.querySelector('.announcement-bar')`, lines 125-130) is already null-guarded (`if (announcementBar) ...`) - degrades gracefully, no action needed.
2. [ ] **Set `FREE_SHIPPING_MIN`** to `299` in `shop/cart.js` (new permanent threshold, not a revert to the old ₹500 value - matches `FREE_GIFT_MIN`)
3. [ ] **Remove gift progress** (`FREE_GIFT_MIN`, `FREE_GIFT_NAME`, gift bar HTML/CSS/JS) from `shop/cart.js` and `shop/shop.css`
4. [ ] **Restore the shipping progress bar** in the cart drawer - the gift bar removed in step 3 was the only progress UI, and it goes away with the gift, but shipping now has a real ₹299 threshold worth showing progress toward. Bring back the pre-campaign `#shipping-progress` implementation (last present at commit `2cfbaf49`, before `aec49f93`): `#shipping-progress`/`#shipping-bar-fill`/`#shipping-bar-msg` in the drawer HTML, `renderShippingBar()` computing `pct`/unlock message off `FREE_SHIPPING_MIN` (now 299) and `cart.cost.totalAmount`, and the `#shipping-bubble` speech bubble near the cart icon. The `.shipping-progress` CSS class already exists unused in `shop/shop.css:1162`.
   - **Confetti trigger changes too:** remove the current "first item added" confetti trigger in `handleAddItem` (`shop/cart.js:585-587`, `if (prevLineCount === 0 && ... > 0) spawnPageConfetti()`). Instead, restore the pre-campaign behavior where `spawnPageConfetti()` fires from inside `renderShippingBar()` when the qualifying total crosses `FREE_SHIPPING_MIN` (₹299) - i.e. `isUnlocked && !wasUnlocked`, guarded by a `sessionStorage.lw_shipping_unlocked` flag (same one-shot-per-session pattern the gift bar used with `lw_gift_unlocked`, just renamed back). Confetti now means "you've unlocked free shipping," not "you added your first item."
5. [ ] **Update shipping policy** and **FAQ** text - remove the celebration-specific sentence entirely (not just swap the ₹ value), leaving only the ₹299 rate:
   - `shipping-policy/index.html:233-234` - two separate `<p>` tags. Delete the celebration paragraph (line 233: "6-Month Celebration: We're offering free shipping on all orders - no minimum!..."). Keep only the rates paragraph (line 234), rewritten as: "Free shipping on orders above ₹299. For orders below ₹299, shipping is a flat ₹30 within Pune and ₹49 for the rest of India."
   - `faq/index.html:217` - currently one merged sentence ("We currently ship within India only. To celebrate 6 months of LayerWeaver, shipping is free on all orders - no minimum! Standard rates apply after the celebration: free shipping above ₹500, flat ₹30 within Pune and ₹49 for the rest of India."). Rewrite to: "We currently ship within India only. Shipping is free on orders above ₹299, flat ₹30 within Pune and ₹49 for the rest of India." **Lesson from the first run:** also check the FAQPage JSON-LD schema block a few lines up in the same file - it duplicates this sentence with the same stale ₹500 copy and is easy to miss since it's not visible on the page.
6. [ ] **Revert trust strip** text to "Free Shipping Above ₹299", remove gift item - note this lives entirely in `shopHeaderHtml()` in `scripts/build-shop.js:387` (not hand-edited in `shop/index.html` or any product/collection page - those are all generated output). This is really the same edit as step 11; do it there and let step 12's rebuild propagate it.
7. [ ] **Revert button colors** from yellow back to purple in `styles.css` - three separate selector groups were changed (see commit `52ac59a4` for exact values), not just `.btn-primary`:
   - `.btn-primary` - `background-color`/`color` (base and `:hover` state, including the hover `box-shadow`)
   - `.nav-links a.btn-primary` - `color` override
   - `.hero-shop-btn` - `background-color`, `:hover` `background-color`/`color`, and `box-shadow` (both states)
   - **Lesson from the first run:** leave `.hero-left .hero-shop-btn` alone - it's a pre-existing yellow mobile override that predates the campaign (confirmed via `git show 2cfbaf49:styles.css`), not part of the campaign's color change. Don't revert it.
8. [ ] **Remove** `.cart-free-shipping-banner` from cart drawer
9. [ ] **Remove** `.fab-shop` HTML from `index.html` and CSS from `styles.css`
10. [ ] **Remove** logo `::after` sticker, `.announcement-bar` styles, and `@keyframes announcement-marquee` from `styles.css`
11. [ ] **Revert `scripts/build-shop.js`** - remove `announcementBarHtml()`, move trust strip back outside header, revert text
12. [ ] **Revert OG meta** on shop page - same generated-file situation as step 6: the `description` field is set in `scripts/build-shop.js:613` ("Celebrating 6 months of LayerWeaver! Free shipping on every order - no minimum...") and rendered into `og:description` via the template at line 308. Edit it there, not in `shop/index.html` directly.
13. [ ] **Run `npm run build-shop`** to regenerate all shop pages (does this last, once steps 6/11/12 have all landed in `scripts/build-shop.js`)
14. [ ] **Re-add the legacy gift-line cleanup** - `cleanupLegacyGiftLine()` in `shop/cart.js` (removed when the campaign was restored on 2026-07-02, see "Extension Notes"). Any customer cart that picks up a gift line during this 20 June - 5 July run needs the same server-side cleanup once the feature retires for good. Check `git log --all --oneline -- shop/cart.js` for the `9dd03d90` / `75e15d52` commits to pull the implementation back rather than rewriting it - it also independently checks for a lingering `FREEGIFT299` discount code, not just the tagged line (see that commit's message for why).

---

## Extension Notes (2026-07-02)

The revert above ran and deployed successfully on 2026-07-02 (commit `209c6513`,
pushed to `origin/main`; site is GitHub Pages deploying from `main`). Hours
later, a technical issue caused users to miss the last day of the original
campaign window, so the decision was made to extend through 5th July rather
than let the campaign end early on a broken note.

**What happened, in order:**
1. `git revert 9dd03d90` then `git revert 209c6513` (both `--no-commit`, then one combined commit `75e15d52`) - both applied cleanly with zero conflicts, fully restoring the campaign-active state of `shop/cart.js`, `shop/cart-utils.js`, `tests/`, `scripts/build-shop.js`, `styles.css`, `shop/shop.css`, and all 15 hand-authored pages + `shop/collage/index.html`.
2. Every "1st July" occurrence (3 per file, 16 files: the 15 hand-authored pages + `scripts/build-shop.js`) swapped to "5th July" - commit `78a7370b`.
3. `npm run build-shop` regenerated all shop/product/collection pages with the new date and restored gift-feature templates.
4. Full test suite re-verified against the restored (pre-revert) test files: 22/22 unit, 27/27 e2e, including the "Gift reconciliation" and "Gift progress bar" suites that the 2026-07-02 revert had previously replaced.

**Deliberately not carried forward:** `cleanupLegacyGiftLine()`, introduced in `209c6513` and hardened in `9dd03d90` - it actively strips gift lines/discount codes, which would fight the now-active campaign by deleting real customers' gift items. It needs to come back as step 14 of the next revert (added above).

**Confirmed before restoring:** Shopify Admin was untouched at the time of extension - `FREEGIFT299` was still active and the `all-products` collection still existed, so there was no bait-and-switch risk in bringing the gift-line code back live.

**Copy decision:** extension is presented with no explanation ("Offer lasts till 5th July!" - same pattern as before, just the date). Deliberately not mentioning the technical issue publicly.

---

## Elements deliberately kept, not part of the revert (found 2026-07-06)

- **Free shipping threshold stays permanently at ₹299** (never reverts to the
  pre-campaign ₹500) - already this doc's explicit intent via step 2, restated
  here for clarity.
- **`script.js` dynamic header-offset sync and the scroll-padding fix**
  (section 11 above) - general robustness fixes bundled into the campaign
  work, not campaign-specific content. Correctly absent from the revert list;
  no action needed.
- **Mobile hero "Shop Now" button reorder** (`styles.css:475`,
  `.hero-left .hero-shop-btn { order: -1; width: 100%; ... }` inside the
  mobile media query) - confirmed via `git show 2cfbaf49:styles.css` that this
  did NOT exist pre-campaign (introduced in `aec49f93`). Was absent from the
  revert list with no explanation either way. **Decision: keep it
  permanently** - it's a mobile UX improvement (primary CTA surfaces first)
  independent of the campaign's promotional content. Leave `styles.css:475`
  as-is when executing the revert.

## Unrelated changes bundled into the original campaign commit (aec49f93)

The original campaign commit's message lists a few things swept in alongside
the campaign that never made it into this doc's "Changes Made" summary above.
Checked each against `main` on 2026-07-06 - both still hold:

- **Em dashes removed from product descriptions** - confirmed still applied
  (zero product pages contain em dashes). Permanent content fix, unrelated to
  the campaign, nothing to do on revert.
- **FAQ link added to privacy policy footer** - confirmed still present
  (`privacy-policy/index.html:289`). Permanent nav fix, unrelated to the
  campaign, nothing to do on revert.
- **Product handle redirect stubs deleted** - `shop/products/panda/`,
  `shop/products/vases/`, `shop/products/monsterra-keychain/index.html`
  (misspelled duplicate) were removed in the same commit - confirmed still
  gone. Each was a `<meta http-equiv="refresh">` redirect to the
  correctly-named current product (`panda-figurine`, `decorative-vases`,
  `monstera-keychain`). Unrelated to the campaign and not part of this
  revert's scope, but flagged separately: if old bookmarks/backlinks/search
  results still point to the old `/shop/products/panda/`-style URLs,
  visitors now hit a 404 instead of being redirected. Worth a deliberate
  decision of its own at some point, since it was never actually decided on -
  just silently bundled into a campaign commit.

---

## Shopify Admin Cleanup Checklist (manual, not code) — do this only once the campaign actually ends (5th July)

Not covered by the code revert steps above - do these separately in Shopify Admin once the free gift is retired for good:

- [ ] Deactivate (or delete) the `FREEGIFT299` discount code
- [ ] Remove/hide the `all-products` collection that was created solely to support the `FREEGIFT299` discount conditions (currently excluded from the site via `HIDDEN_COLLECTIONS` in `build-shop.js` - if the collection is deleted, also remove it from that list)
- [ ] Confirm the Cat Cable Clip product itself is left untouched (it's a real sellable product, only the auto-gift/discount mechanism goes away)

---

## Files Modified (72 total)

### Core
- `styles.css` - Campaign banner, logo sticker, yellow buttons, mobile hero, FAB, layout offsets
- `shop/shop.css` - Trust strip, gift progress bar, free shipping banner, campaign overrides
- `shop/cart.js` - Free shipping threshold, gift progress, confetti, cart drawer layout
- `script.js` - Dynamic header sync, scroll padding fix
- `scripts/build-shop.js` - Template updates for generated pages

### Content
- `index.html` - Announcement bar, hero button, FAB
- `shipping-policy/index.html` - Celebration shipping offer
- `faq/index.html` - Updated shipping FAQ
- `shop/index.html` - Announcement bar, trust strip, OG meta

### All Other Pages (announcement bar + layout)
- `404.html`, `connect/`, `enroll/`, `enroll-adult/`, `gallery/`, `privacy-policy/`, `return-and-exchange-policy/`, `services/on-demand/`, `services/3d-design/`, `workshop/`, `shop/collage/`, `shop/account/`
- All `shop/products/*/index.html` pages
- All `shop/collections/*/index.html` pages
