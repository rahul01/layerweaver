# Raksha Bandhan 2026 — Site Update Masterplan

**Status:** Executed. Steps A–F below all shipped (commits `609f5622`, `7d772974`, `128003e6`, pushed to `main` 2026-08-07). Kept for history/context, not as a live to-do list — see "What actually shipped" below for what changed since this was written, including a 2026-08-07 hero-carousel takeover (§0 item 4) made after initial launch — not yet committed as of this edit.
**Written:** 2026-08-06
**Owner decisions already made:** see "Decisions locked" below — don't re-ask these.

---

## 0. What actually shipped (read this first — supersedes parts of the plan below)

The plan below was written and executed largely as designed, with two material changes discovered mid-implementation:

1. **Bunny Keychain discount mechanism changed.** The plan's research (line ~15) found the free-keychain offer live as an **automatic** BXGY discount. During implementation, Shopify was found to not combine an automatic BXGY discount with an order-level percent-off code on the same order — so a customer couldn't get both the free keychain and 5%/10% off. Fix: the automatic BXGY was deleted and replaced with a **code-based** BXGY discount, `BUNNY499`, so all three offers (`BUNNY499`, `RAKHI05`, `RAKHI10`) are ordinary discount codes and **mutually exclusive** — only the highest tier the cart qualifies for is ever applied. See `shop/cart.js`'s `REWARD_TIERS`.
2. **Cart-side progress bar was explicitly requested and built**, reversing "Decisions locked" item 7's "out of scope for this pass" note. It merges free shipping (₹299+) and all three Rakhi tiers into one evenly-spaced progress bar in the cart drawer, with an auto-added/removed gift line for `BUNNY499` and a Subtotal/Discount/Total breakdown in the footer. This was substantial follow-on work beyond the original 4-offer announcement/nav/banner scope — see `shop/cart.js` (`REWARD_TIERS`, `syncRakhiPerks`, `renderRewardsBar`) and `shop/shop.css` (`.rewards-progress` block).
3. **Ad creatives (`ads/rakhi/`) updated to mention the 3 offers.** The 8 per-collection ad creative pages (built by `ads/rakhi/build-ads.mjs`, screenshotted to PNG by `ads/rakhi/export.mjs`) originally only showed a "From ₹X" price badge and a generic "Free Shipping ₹299+" badge — none of the 3 site offers (`BUNNY499`/`RAKHI05`/`RAKHI10`) were mentioned anywhere in the ad creative, even though the live site had shipped them via the announcement bar and cart rewards bar. Fixed 2026-08-07 by adding a `.offer-strip` banner (brand purple background, white text) reading `Free Bunny Keychain ₹499+ · 5% off ₹1,499+ · 10% off ₹2,999+` to all 4 ad formats (Square, Story, Landscape, WhatsApp) across all 8 collections, then regenerated all 32 PNGs. Discount code names (`RAKHI05`/`RAKHI10`) are deliberately **not** shown on the creative — all three offers auto-apply in cart (per §0 item 1/2 above and `shop/cart.js`'s `REWARD_TIERS`/`syncRakhiPerks`), so there's no code for a customer to type or remember. See `ads/rakhi/build-ads.mjs`'s `OFFER_LINE` constant and `.offer-strip` CSS/markup. If the offer thresholds ever change, update `OFFER_LINE` and re-run `node ads/rakhi/build-ads.mjs && node ads/rakhi/export.mjs` (requires the local server running on port 8080) to keep the ad creative in sync with the live site.
4. **Homepage hero carousel converted to a full Rakhi takeover (2026-08-07, post-launch change — reverses "Decisions locked" item 4 below).** The hero was originally left untouched deliberately (see original item 4 in §2) because it was driven by non-Rakhi collections only. The owner later asked for the hero itself to become the Rakhi campaign moment, not just the promo banner beneath it. Changed:
   - `scripts/build-shop.js`: the call to `heroCarouselSlidesHtml(collections)` (~line 1972, inside the same block that also cleans up stale `shop/rakhi/` and `shop/collections/` output directories) now passes `rakhiCollections` instead of `collections` — the carousel slides are generated from the 8 `RAKHI_COLLECTION_HANDLES` collections instead of the regular non-Rakhi ones. `rakhiCollections` was already in scope at that call site (used just above for stale-file cleanup), so no new data fetch was needed.
   - `index.html`'s hand-authored `.hero-left` block: the 3 generic service links (On Demand Printing / 3D Design / Workshops) were replaced with 3 Rakhi offer callouts, all linking to `shop/rakhi/` instead of their original `services/*`/`workshop/` targets. The `.hero-shop-btn` CTA changed from "Shop Now" → `shop/` to "Shop Rakhi Gifts" → `shop/rakhi/`. The 3rd callout was originally "Ships in 3 Days" but was changed same-day to "Free Shipping / On every order above ₹299" instead — matching the announcement bar's shipping mention rather than a delivery-speed claim. Final 3 callouts: Free Bunny Keychain (₹499+) / Up to 10% Off / Free Shipping (₹299+).
   - `index.html`'s `.hero-eyebrow`/`h1`: changed from "3D Printed Products" / "Bringing Ideas to Life Layer by Layer" to "Raksha Bandhan 2026" / "Rakhi Gifts, Made to Last" (matches the `.rakhi-promo` section heading immediately below the hero, so the page reads as one continuous campaign moment rather than two competing headlines).
   - No CSS changes were needed — the existing `.hero-split`/`.hero-carousel`/`.hero-service-*` rules are copy-agnostic.
   - **This is a real scope/behavior change, not a bugfix** — it means the homepage no longer has an "evergreen" mode during the campaign window. See the rollback doc's new §1b for what this means for the post-campaign revert.
5. **`.rakhi-promo` section trimmed to remove redundancy with the new hero (2026-08-07, same day, after item 4 above).** Once the hero itself carried the Rakhi headline/eyebrow/Bunny-Keychain-offer/CTA, the `.rakhi-promo` section directly below it duplicated all of that verbatim. Trimmed `index.html`'s `.rakhi-promo` section down to just the `.rakhi-promo-offers` `<ul>` — the two offer bullets (5%/10% off) that the hero doesn't show. Removed: the `.rakhi-promo-eyebrow` paragraph ("Rakshabandhan 2026"), the `<h2>` ("Rakhi Gifts, Made to Last" — identical to the hero's `h1`), the `.rakhi-promo-sub` paragraph, the Bunny Keychain bullet (hero already has it), and the "Shop Rakhi Gifts" CTA button (hero already has one). Also removed the now-dead `.rakhi-promo-eyebrow`/`.rakhi-promo h2`/`.rakhi-promo-sub` CSS rules from `styles.css`, and reduced `.rakhi-promo`'s vertical padding from 64px to 28px to match the section's new, much shorter content. Net effect: the section is now a thin offer strip, not a second full promo block.
6. **Discount code names (`RAKHI05`/`RAKHI10`) removed from all homepage-visible copy (2026-08-08).** The announcement bar (both the hand-authored `index.html` version and the `announcementBarHtml()` generator function that produces it on every `shop/**` page — Step A's original spec text at line ~103 below is now stale, kept for history) originally read "...5% off ₹1,499+ (code RAKHI05) · 10% off ₹2,999+ (code RAKHI10)"; the "(code RAKHI0X)" parentheticals were removed, leaving just the benefit. Same for the trimmed `.rakhi-promo` strip (§0 item 5 above) — its two bullets now read "5% off ₹1,499+" / "10% off ₹2,999+" with no code name. **Reason: all three offers auto-apply in cart** (per §0 item 1, `shop/cart.js`'s `REWARD_TIERS`/`syncRakhiPerks`) — there's no code for a customer to type, so naming one is actively misleading (implies manual entry is needed). This matches the same logic already applied to ad creatives in §0 item 3. The Rakhi collection banner copy (`generateRakhiIndexPage`'s `collagebannerHtml` call and meta description, ~line 1460/1478) was already code-free and needed no change.
7. **"Shop Rakhi Gifts" ribbon badge added to the header logo, sitewide (2026-08-08, iterated same day).** `index.html`'s header logo markup was restructured: the single `<a class="logo-container logo-link">` (which combined "is the flex container" and "is the clickable link" in one element) was split into a wrapping `<div class="logo-container">` holding two siblings — `<a class="logo-link" href="#home">` (unchanged icon+wordmark, still the home link) and a new `<a class="logo-rakhi-ribbon" href="shop/rakhi/">Shop Rakhi Gifts</a>`. This split was necessary because nesting an `<a>` inside an `<a>` is invalid HTML (the browser auto-closes the outer one, breaking click targets) — the two links needed to be siblings under a shared `position: relative` container instead.
   - **Visual treatment matches the retired 6-month-campaign "logo sticker"** (see `git show aec49f93 -- styles.css`, the `body.has-announcement .logo-container::after` rule) rather than being designed from scratch: yellow (`--secondary`) background, `filter: drop-shadow(...)` instead of `box-shadow`, and a jagged jigsaw-style `clip-path` on the left/right edges only (giving a "torn paper strip" look) — reused that exact `clip-path` polygon. Final placement after iteration: horizontal (no rotation initially, then settled on `transform: rotate(-5deg)` to match the original's `-2deg` tilt direction), positioned `top: 100%` (directly below the wordmark, not overlapping it), `right: 4px` with `margin-top: -6px` (shifted up slightly to sit close under the logo).
   - **Sitewide, not homepage-only** (expanded from the initial homepage-only version): added to `shopHeaderHtml()` in `scripts/build-shop.js` (~line 524) — the same split-anchor restructuring — which propagates to every generated `shop/**` and `shop/rakhi/**` page automatically via one function edit. Also hand-added to all 13 other hand-authored pages that share the same `logo-container logo-link` header pattern: `404.html`, `workshop/`, `enroll/`, `enroll-adult/`, `privacy-policy/`, `faq/`, `gallery/`, `return-and-exchange-policy/`, `terms-of-service/`, `connect/`, `shipping-policy/`, `services/3d-design/`, `services/on-demand/`, and `shop/collage/` (a standalone hand-authored page, not part of the generated set). Each link's relative path (`shop/rakhi/`, `../shop/rakhi/`, or `../../shop/rakhi/`) matches that page's existing depth-appropriate href pattern (verify via the page's other relative links, e.g. its own logo `href` or `images/` path, before assuming a depth if editing further).
   - `styles.css` gained `.logo-link` (new — the flex/display rules the old combined selector used to carry) and `.logo-rakhi-ribbon`. `shop/shop.css` already had its own `.logo-link` (pre-existing, unrelated) but gained a new `.logo-container` rule (previously undefined there) and its own `.logo-rakhi-ribbon` (smaller font-size than the homepage version to fit the tighter shop header — `0.62rem` vs `0.68rem`), plus a `@media (max-width: 480px)` shrink (`0.5rem`, tighter padding, `right: 0`) since the shop header's logo already aggressively shrinks/stacks below 370px via existing `clamp()` rules and search-bar competition for space.
   - `team/review/index.html` deliberately excluded — it has no `logo-container`/header chrome at all (internal tool page). Ad creative pages (`ads/**`), workshop flyers (`workshops/**`), and `experiment/**` pages also excluded — none have the shared site header.
   - Verified via `npm test` (43/43 vitest, 40/40 Playwright) — no regressions from the header restructuring across any page.
8. **Pre-existing shop-header scroll bug fixed while investigating the ribbon (2026-08-08) — not Rakhi-specific, but touched in this same session.** `script.js`'s scroll handler (~line 149-181, shared by homepage and shop pages) toggles the header's vertical padding between `15px` (resting) and `10px` (scrolled past 100px) to shrink the header slightly on scroll. On the homepage this is seamless because `header`'s CSS baseline (`styles.css` ~line 170: `padding: 15px 0`) already matches the JS's resting-state value. On shop pages, `.shop-header .container`'s CSS baseline has **no vertical padding at all** (inherited `0` from the generic `.container` rule) — so the very first scroll event was jumping the header from its true ~80px compact height up to ~110px.
   - **First attempted fix (reverted same day, don't repeat it):** added `padding-top/bottom: 15px` to `.shop-header .container` in `shop/shop.css` to match the JS's resting-state value. This stopped the *jump* but made the shop header **permanently ~110px tall at all times** (user feedback: "now its always wide") — wrong outcome, since the shop header was never meant to carry that extra padding at all, on any page state.
   - **Actual fix:** in `script.js`'s scroll listener, gated the padding-toggle lines behind `if (!isShop)` (both the `> 100` branch and the `else` branch) — shop pages now skip the padding manipulation entirely and keep their original CSS-only compact height (no vertical padding, ~80px) at every scroll position; only the box-shadow scroll effect still applies on shop pages. Homepage behavior (`header`, not `.shop-header`) is completely unchanged — still shrinks from ~80px to ~73px past 100px scroll, exactly as before any of this session's work.
   - Verified via Playwright: shop header height is now a constant 80px at scrollY=0 and scrollY=300 (no change at all); homepage still shows the original 80px→~73px shrink. `npm test` still 40/40 e2e (+ unit) after this fix. **Discovered because**: investigating a user report of "header expands on scroll on shop pages" — initially suspected the new logo ribbon (§0 item 7) was the cause since it landed the same session, but reproduced the identical height jump on the pre-ribbon committed code (`git show HEAD:shop/shop.css`, tested via an isolated worktree) before making any ribbon changes, confirming the underlying bug predates the Rakhi campaign entirely and just happened to surface during this work. The first fix attempt (CSS baseline padding) then introduced a *new*, different regression (permanently taller header) that the second fix (JS gating) corrected.
9. **Rakhi catalogue's "All" chip renamed to "All Rakhi Gifts" (2026-08-08).** `collectionNavHtml()` (`scripts/build-shop.js` ~line 735) previously hardcoded the first chip's label as `'All'` for both the regular shop and the Rakhi catalogue (same shared function — see item 10 below for the cross-catalogue chip this function also produces). Added a 7th parameter, `allLabel = 'All'`, defaulting to the existing behavior everywhere except the two Rakhi call sites (`generateRakhiIndexPage`/`generateRakhiCollectionPage`, ~line 1479/1536), which now pass `'All Rakhi Gifts'` explicitly. Regular shop pages (`generateShopIndex`/`generateCollectionPage`) are unaffected — still show plain "All". Applies to both the desktop chip strip and the mobile dropdown (both read from the same `items` array).
10. **Cross-catalogue links added between the regular shop and Rakhi catalogue (2026-08-08).** Once the hero became a full Rakhi takeover (§0 item 4), the only way from a `shop/**` page back to `shop/rakhi/**` was the announcement bar (one-directional — it always links *to* Rakhi, never away from it), and there was no link in the other direction at all except the logo (→ homepage). Fixed by extending the shared `collectionNavHtml()` function (`scripts/build-shop.js` ~line 732) with an optional 6th `crossLink` param (`{ title, href }`) that appends one extra chip to the existing collection-filter chip strip (both the desktop `.collection-nav` row and the mobile `.collection-dropdown`) — not a new UI component, reuses the existing chip strip already present on every shop/collection page and every Rakhi/collection page. Wired at all 4 call sites: `generateShopIndex`/`generateCollectionPage` (regular shop, ~line 811/1401) pass `{ title: '🪢 Rakhi Gifts', href: shopBase + 'rakhi/' }`; `generateRakhiIndexPage`/`generateRakhiCollectionPage` (~line 1473/1530) pass `{ title: '← Full Shop', href: shopBase }`. The cross-link chip gets a distinct `--cross` modifier class (dashed border, brand-purple tint, `margin-left` gap from the filter chips) in `shop/shop.css` so it doesn't look like just another filter option — it's a "leave this catalogue" action, not a "narrow this catalogue" one. No change to `index.html`'s own nav (still has separate "Shop"/"Rakhi Gifts" links) or to `shopHeaderHtml()` (still has no nav links, unchanged) — this only affects the collection chip strip inside each catalogue.
11. **Festive page-level theming added to the Rakhi catalogue (2026-08-08).** Previously the Rakhi index and 8 sub-collection pages reused 100% generic shop-page chrome (same trust strip, same `collagebannerHtml()` banner, same product grid as any regular collection) — the only Rakhi-specific visual signal anywhere was the 🪢 emoji in text and the header ribbon (§0 item 7). Added, scoped to Rakhi pages only:
    - **New CSS vars** in `styles.css`'s `:root` (loaded on every page, `styles.css` before `shop/shop.css`): `--rakhi-cream: #FAF8F5` and `--rakhi-amber: #E8A020`, both taken directly from `.ai/plans/rakhi-creatives-ai-brief.md`'s existing brand-parameters section (the ad-creative brief already specified this exact festive palette — the site just hadn't adopted it yet) rather than inventing new colors.
    - **`body.rakhi-theme`** class added to both `generateRakhiIndexPage()` and `generateRakhiCollectionPage()`'s `<body>` tag (regular shop pages' `<body>` unaffected) — sets page background to `var(--rakhi-cream)` in `shop/shop.css`. Product cards keep their own white background (unchanged `.shop-product-card` rule) so photos still read cleanly against the cream page.
    - **`rakhiThreadMotifSvg()`** (`scripts/build-shop.js`, new helper near `collagebannerHtml()`) — a small inline SVG line-art rakhi thread/knot (two loop shapes + center knot + tassel lines), rendered in `currentColor` so it can sit in either the amber or purple palette without a separate asset per color.
    - **`rakhiFestiveBannerHtml()`** (new wrapper function, does NOT modify the shared `collagebannerHtml()` used by regular collections) — wraps the existing banner output in a `.rakhi-banner-wrap` and adds two absolutely-positioned overlays: `.rakhi-special-badge` (amber "Rakhi Special" pill, reusing the same torn-paper `clip-path` polygon as `.logo-rakhi-ribbon` for visual consistency with the header ribbon) top-left, and `.rakhi-banner-motif` (the thread SVG, amber `currentColor`, `drop-shadow` for contrast) positioned bottom-left near the title — deliberately placed over the banner's dark gradient-overlay side (not the plain product-image side) since a colored motif needs a dark backdrop to read; an earlier bottom-right placement over product photos had poor contrast and was moved. Both call sites (`generateRakhiIndexPage`/`generateRakhiCollectionPage`) swapped their direct `collagebannerHtml(...)` call for `rakhiFestiveBannerHtml(...)`.
    - **Active-chip amber accent**: `body.rakhi-theme .collection-nav-chip.active`/`.collection-dropdown-item.active` override the sitewide purple active-chip color to amber, scoped so the regular shop's chip strip (including its own "🪢 Rakhi Gifts" cross-link chip, §0 item 10) keeps the standard purple.
    - **Mobile**: motif hidden below 768px (`.rakhi-banner-motif { display: none }`) to avoid crowding the smaller banner; badge shrinks font-size/padding at the same breakpoint.
    - **Deliberately left generic** (per explicit decision, not an oversight): `shopTrustStripHtml()` — the trust strip (shipping/returns/reviews) stays unstyled/unthemed on Rakhi pages; it's functional/informational content, not a festive surface.
    - Verified via Playwright screenshots (desktop banner, collection sub-page, 390px mobile viewport) and `npm test` (40/40 e2e + unit, no regressions).
12. **Festive theming expanded beyond the banner to the full page — background, dividers, and product cards (2026-08-08, same day, after item 11 above).** Owner feedback: item 11's treatment was front-loaded entirely into the banner, and the product grid below (most of the page's actual height) was still plain white cards indistinguishable from a regular shop page. Added, still scoped to `body.rakhi-theme`/`.rakhi-*` selectors only:
    - **Repeating background pattern**: `body.rakhi-theme` now sets `background-image` to an inline data-URI SVG (a small tiled rakhi-thread motif at 16% opacity, 120×120px tile) layered under the existing `--rakhi-cream` solid color — no extra HTTP request, ambient texture visible in the gaps around product cards without competing with them.
    - **Bigger, bolder banner**: `.collection-banner` height increased (260px → 320px desktop, 180px → 220px mobile) when inside `.rakhi-banner-wrap`, plus a 2px solid `--rakhi-amber` border and an amber `box-shadow` glow around the whole banner. Badge and motif sizes increased to match (badge font 0.72rem→0.8rem/padding bumped; motif SVG 92px→120px wide).
    - **Second corner motif**: `rakhiFestiveBannerHtml()` now renders `rakhiThreadMotifSvg()` twice — the original near the title (bottom-left, over the dark gradient) plus a new smaller, rotated (`8deg`), lower-opacity (`0.7`) copy in the banner's top-right corner via a `.rakhi-banner-motif--corner` modifier class, reusing the same SVG function rather than a second asset.
    - **`rakhiGridDividerHtml()`** (new function) — a thin decorative divider (fading amber gradient lines flanking a small thread-motif SVG) inserted between the banner and the product grid on both `generateRakhiIndexPage()` and `generateRakhiCollectionPage()`, purely visual (`aria-hidden="true"`).
    - **Product card festive accent**: `body.rakhi-theme .shop-product-card` gets a subtle amber `border` plus a small triangular amber corner-ribbon via `::before` (CSS-only `border-*` triangle trick, no new markup — `productCardHtml()` itself was NOT touched, this is purely a descendant-selector override since the cards already render inside a `body.rakhi-theme` page). Hover glow color also switches from the sitewide purple to amber on Rakhi pages (`body.rakhi-theme .shop-product-card:hover`).
    - **Not changed**: `productCardHtml()` generator function (zero markup diff — all card styling is CSS-only via the `body.rakhi-theme` ancestor selector), `shopTrustStripHtml()` (still deliberately generic, per item 11's decision), regular shop pages (verified zero visual diff via Playwright — no border, no `::before` content, no background pattern).
    - Verified via Playwright screenshots (desktop full-page, banner close-up, 390px mobile) and `npm test` (40/40 e2e + unit, no regressions).
13. **Thread motif redesigned into an 8-petal mandala (2026-08-08, same day, after item 12 above).** Owner feedback: the original motif (two side loops flanking a center knot) read as "just 2 leaves," not festive/mandala-like. Redesigned `rakhiThreadMotifSvg()` in `scripts/build-shop.js`: instead of two hardcoded loop paths, it now programmatically generates 8 identical petal paths at 45° rotation increments around a center point (`Array.from({length: 8}, ...)` with a `transform="rotate(...)"` per petal), plus a filled+outlined center knot circle and the same 3-strand tassel beneath. ViewBox changed from a wide `120×40` to a square `80×96` to fit the now-radially-symmetric shape (previously the shape was intentionally wide/horizontal to flank text; the mandala needs to be roughly square). Also updated `body.rakhi-theme`'s tiled background-pattern SVG in `shop/shop.css` (previously an independent, differently-drawn 2-loop shape) to a matching but simpler 6-petal mandala built via `<use href="#p">` references to one `<path>` definition, so the ambient background texture and the foreground motifs now read as the same visual family instead of two different shapes.
    - **Sizing had to be retuned** after the viewBox/shape change: the old `120px`-wide banner motif rendered ~144px tall at the new square aspect ratio and started overlapping the banner's description text — shrunk to `64px` wide (`.rakhi-banner-motif .rakhi-thread-motif`). The corner accent (`.rakhi-banner-motif--corner .rakhi-thread-motif`) shrunk from `56px` to `40px` to stay clearly smaller/subordinate to the main motif. The divider motif (`.rakhi-grid-divider .rakhi-thread-motif`) was left at `56px`, which now reads well as a mandala centerpiece rather than a stretched horizontal shape.
    - Verified via Playwright (banner close-up confirming no text overlap, full desktop page, 390px mobile) and `npm test` (40/40, no regressions).

Everything else in this document (announcement bar, nav link, homepage promo banner, collection banner copy) shipped materially as planned.

---

## 1. Context — what already exists (verified, don't rebuild)

### Shopify offers — status as of 2026-08-06 research (see §0 for what changed since)

| Offer | Type | Mechanism | Status |
|---|---|---|---|
| ~~Free Bunny Keychain on orders ₹499+~~ | ~~Automatic BXGY discount~~ | ~~`gid://shopify/DiscountAutomaticNode/1696221003998`~~ | **Superseded — deleted, see below** |
| 5% off entire order, min ₹1,499 | Discount code | `RAKHI05` (`gid://shopify/DiscountCodeNode/1696219398366`) | ACTIVE, 2026-08-06 → 2026-08-28 |
| 10% off entire order, min ₹2,999 | Discount code | `RAKHI10` (`gid://shopify/DiscountCodeNode/1696220283102`) | ACTIVE, 2026-08-06 → 2026-08-28 |

**Post-implementation change (§0):** the automatic BXGY above was deleted and replaced with a **code-based** BXGY discount, `BUNNY499` (created directly in Shopify Admin), because Shopify won't combine an automatic BXGY with an order-level percent-off code. All three offers are now ordinary, mutually-exclusive discount codes — see `shop/cart.js`'s `REWARD_TIERS`. If any need editing, they already exist — fetch and update, don't duplicate. There is also an unrelated always-on `FAMILY15` code (15% off, no relation to this campaign — leave alone).

**Bunny Keychain stock:** shows `-3` available / `0` on hand in Shopify inventory. **This is not a problem** — the store owner confirmed inventory tracking is off for all products; everything is printed to order. Do not attempt to "fix" stock or gate the offer on inventory.

### Rakhi collection pages — already built, live

Generated by `scripts/build-shop.js` (functions `generateRakhiIndexPage` / `generateRakhiCollectionPage`, called around line 1870-1880). Output:

- `shop/rakhi/index.html` — "all" index, deduplicated products across all 8 collections
- `shop/rakhi/<handle>/index.html` — one page per collection, for each of:
  1. `the-book-worm-sister`
  2. `the-aesthetic-sister`
  3. `the-wfh-sister`
  4. `the-kid-sibling`
  5. `little-things-big-feels`
  6. `the-gamer-bro`
  7. `the-desk-setup-bro`
  8. `the-car-guy-brother`

These handles are defined in `RAKHI_COLLECTION_HANDLES` (top of `scripts/build-shop.js`, ~line 43). Product composition of each collection lives in Shopify itself (they're real Shopify collections) — `fetchRakhiCollections()` pulls them live at build time, same as every other collection. No hardcoded product lists in the JS to maintain.

**These collections are intentionally excluded from `shop/collections/` and the homepage hero carousel** — see `HIDDEN_COLLECTIONS` (~line 111: `['all-products', ...RAKHI_COLLECTION_HANDLES]`) and the comment at ~line 1403 ("Deliberately not linked from the main nav or collection chip strip... reachable via direct URL and the sitemap only"). That exclusion from `shop/collections/` should **stay** (avoids duplicate listing of the same products in two places) — but the *total invisibility* from nav/homepage is the gap this masterplan closes.

### Reference docs already in the repo (context only, not build inputs)

- `.ai/plans/rakhi-creatives-ai-brief.md` — ad creative brief for all 8 collections (Midjourney/Canva prompts, headlines, captions). Already accounts for the current 8-collection structure. The brief's own checklist didn't call out mentioning `BUNNY499`/`RAKHI05`/`RAKHI10` on the creative itself (it predates those being finalized as codes) — see §0 item 3 above for the fix applied to the actual built ad pages in `ads/rakhi/`.
- `.ai/plans/rakhi-combos-claude-code-spec.md` and `.ai/plans/rakhi-combos-page.md` — **superseded/historical**. Describe an earlier "fixed-price combo" concept that was replaced by the current real-Shopify-collections approach. Do not implement anything from these two files. Kept for history only.
- `.ai/plans/raksha-bandhan-2026-campaign.md` — Meta/Instagram ad campaign brief (separate from this site-changes plan). Confirms **Pixar lamp and Silk Song accessories are IP-excluded from all paid/catalog contexts** — keep excluding them from any Rakhi promotion you touch.

### Site architecture notes relevant to this work

- `index.html` (homepage) is a **hand-authored static file**, not generated by `build-shop.js`, EXCEPT for two marker-delimited regions that the build script rewrites in place:
  - `<!-- HERO-CAROUSEL-SLIDES-START -->...<!-- HERO-CAROUSEL-SLIDES-END -->`
  - `<!-- HERO-CAROUSEL-DOTS-START -->...<!-- HERO-CAROUSEL-DOTS-END -->`
  (see `heroCarouselSlidesHtml()` ~line 1298 and the regex replace ~line 1941-1946). Everything else in `index.html`, including the `<nav>` block, is edited directly by hand — build-shop.js does not touch it.
- All `shop/**/*.html` pages ARE fully generated by `scripts/build-shop.js` — never hand-edit files under `shop/`, edit the generator functions instead, then run the build.
- Shared header/nav/footer are produced by `shopHeaderHtml()` (~line 516), `shopTrustStripHtml()` (~line 539), `collectionNavHtml()` (~line 724), `footerHtml()` (~line 578) — all in `scripts/build-shop.js`. Edit these once, it propagates to every generated shop page.
- Run `npm run build-shop` (or the `buildshop` skill) after any `build-shop.js` change, then `npm run serve` (or the `serve` skill) to preview locally at `http://localhost:8080` before considering the work done. Per stored user preference, always preview via the local server URL, never `open file.html` directly.
- No existing "announcement bar" component anywhere in the codebase — this masterplan introduces a new one from scratch.
- **Fixed-header layout gotcha (read before writing CSS):** `.shop-header` is `position: fixed` with `top: 0` (`shop/shop.css` ~line 6-14), and the page compensates with `.header-spacer { height: 80px }` (~line 240) placed right after the header in every generated page. `.collection-topbar` (the collection chip strip) is separately `position: sticky; top: 80px` (~line 246-248), hardcoded to match the header height. The homepage's plain `header` (`styles.css` ~line 119) — check whether it's also fixed/sticky before assuming it behaves the same as `.shop-header`. **If the announcement bar is inserted above the fixed header without adjusting these three things (header `top` offset, `.header-spacer` height, `.collection-topbar`'s sticky `top`), it will either overlap the header or leave a visible gap.** Plan for this: either (a) make the announcement bar part of the fixed-position stack (increase the header's effective top offset by the bar's height, and bump `.header-spacer` height and `.collection-topbar`'s `top` by the same amount — likely needs a CSS custom property like `--announcement-height` referenced in all three places so they stay in sync), or (b) make the announcement bar `position: static` and place it so it scrolls away with content while the header stays fixed below it (simpler, but means the offer message disappears on scroll — decide which behavior is wanted, this wasn't specified and is worth a quick check with the user if ambiguous rather than guessing). Check both mobile and desktop breakpoints — `.header-spacer` height may change in mobile media queries, search for other `.header-spacer` or `top: 80px` overrides before shipping.

---

## 2. Decisions locked (don't re-ask the user)

1. **Sitewide announcement bar** — not scoped to just Rakhi pages. Runs on every page (homepage + all shop pages), since RAKHI05/RAKHI10 apply to any order storewide, not just Rakhi products.
2. **Always-on, no dismiss button.** No sessionStorage/close-X logic — simpler, always visible on every page load. Do not add dismiss functionality.
3. **Main nav gets a link** to the Rakhi catalogue (both `index.html`'s hand-authored nav and the shop-side nav used across `shop/**` pages).
4. ~~**Homepage also gets a dedicated promo banner/section** for Rakhi, separate from the existing (auto-generated, non-Rakhi) hero carousel — the hero carousel intentionally stays untouched since it's driven by `RAKHI_COLLECTION_HANDLES`-excluded collections only.~~ **Superseded 2026-08-07 (see §0 item 4):** the hero carousel itself was later converted to a full Rakhi takeover (headline, service callouts, CTA, and carousel slides all now Rakhi-specific). The dedicated `.rakhi-promo` banner section still exists separately, directly below the hero.
5. **Leave `shop/collections/` exclusion as-is** — do not un-hide the 8 Rakhi collections from the regular collections grid or the homepage hero carousel. Discoverability is handled entirely via items 1-4 above, not by exposing them in the standard collection listing.
6. **Collection banner subtitle copy** on `shop/rakhi/` and each of the 8 sub-collection pages should mention the 3 offers directly.
7. ~~**Out of scope for this pass:** cart-side progress-bar messaging ("add ₹X more for 10% off"), product-page-level offer badges, and anything from the retired combos spec. Don't build these unless separately requested.~~ **Superseded (see §0):** the cart-side progress bar was separately requested and built after this plan was written. Product-page-level offer badges and the retired combos spec remain out of scope.

---

## 3. Implementation steps

### Step A — Sitewide announcement bar (new component)

Add a new function in `scripts/build-shop.js`, e.g. `announcementBarHtml(base)`, following the same style/pattern as `shopTrustStripHtml()` (~line 539) — plain template literal returning an HTML string, no dependencies beyond `base` for relative links.

**Placement:** immediately above `shopHeaderHtml()`'s `<header class="shop-header">` in every generated shop page (call it right before `${shopHeaderHtml(base, shopBase)}` in each `generate*Page` function — there are several: `generateShopIndex`, `generateCollectionPage`, `generateRakhiIndexPage`, `generateRakhiCollectionPage`, product pages, etc. — search for all call sites of `shopHeaderHtml(` to find every page template that needs it).

**Content (copy, adjust tone to match existing site voice — see trust strip for reference):**
```
🪢 Rakhi Special: Free Bunny Keychain on orders ₹499+ · 5% off ₹1,499+ (code RAKHI05) · 10% off ₹2,999+ (code RAKHI10)
```
Link the whole bar (or a "Shop Now" fragment at the end) to `${shopBase}rakhi/` (adjust relative path per page depth, same convention as every other `base`/`shopBase` usage in this file).

**On the homepage (`index.html`):** since it's hand-authored, add the equivalent markup directly by hand near the top of `<body>`, above `<header>`. Match styling/copy exactly with the shop-page version for consistency. Link to `shop/rakhi/`.

**CSS:** add a new `.announcement-bar` rule block to `shop/shop.css` (for shop pages) and `styles.css` (for the homepage) — check both files' existing conventions (colors, font sizes) before writing new rules. Suggested treatment: solid brand purple (`#A083D5`) or amber accent (`#E8A020`) background, white text, small/compact height, centered text, sits full-width above the header. No JS needed since there's no dismiss behavior (decision #2 above) — pure CSS/HTML.

**Do not** make this dismissible. Do not add sessionStorage/localStorage logic for it.

### Step B — Main nav link

**In `index.html`** (hand-edit): in the `<ul class="nav-links">` block (~line 81-87), add a new `<li>` for Rakhi, e.g.:
```html
<li><a href="shop/rakhi/">Rakhi Gifts</a></li>
```
Place it sensibly relative to existing items (e.g. right after "Shop" or before "Gallery" — use judgement, keep nav from feeling cluttered; this is a seasonal item so consider whether to visually flag it, e.g. a small badge/pill, matching whatever pattern the site already uses for such things if any exists).

**In `scripts/build-shop.js`'s `shopHeaderHtml()`** (~line 516): this function currently only has logo, search, and an empty `<nav class="shop-nav">` (cart icon injected via JS). Check whether shop pages have a separate persistent nav-links element anywhere else (search for how `shop/` pages let users get back to collections — likely just the collection chip strip via `collectionNavHtml`, not a top-level nav). If shop pages don't have an equivalent primary nav to homepage's `<nav class="nav-links">`, the announcement bar (Step A) is the primary cross-page discovery mechanism for shop pages, and this nav-link step may only be meaningfully doable on the homepage. Confirm this before spending time trying to inject a nav-links-style element into `shopHeaderHtml()` that doesn't have an equivalent structure today — don't invent new persistent chrome beyond what's asked.

### Step C — Homepage promo banner

Add a new hand-authored `<section>` in `index.html`, separate from `<section id="home" class="hero">` (~line 97) and its auto-generated carousel. Reasonable placement: directly after the hero section, before whatever section currently follows it (read the file to find the right seam — don't insert mid-section).

Content should include:
- Headline referencing Raksha Bandhan 2026
- The 3 offers (free bunny keychain ₹499+, 5% off ₹1,499+, 10% off ₹2,999+)
- A CTA button linking to `shop/rakhi/`
- Visually distinct from the hero carousel (different background treatment, e.g. brand purple `#A083D5` or warm off-white `#FAF8F5` per the creative brief's brand parameters) so it doesn't look like a 9th carousel slide

Reuse `.collection-banner` / `.banner-collage` CSS classes if a similar collage treatment fits, or keep it simpler (single image + text) — use judgement, this is a lighter lift than a full new component. Check `.ai/plans/rakhi-creatives-ai-brief.md`'s "Brand Parameters" section for color/tone/tagline consistency ("Bringing Ideas to Life, Layer by Layer" tagline, festival label "Rakshabandhan 2026" or "Rakhi Special").

Since this section is hand-authored (not regenerated by build-shop.js), it will NOT be touched by future `npm run build-shop` runs — safe to leave in place after the campaign, or manually remove after Aug 28 if it should come down (confirm with user before removing later, don't preemptively add auto-expiry logic).

### Step D — Collection banner copy (offers mentioned on-page)

In `scripts/build-shop.js`:

- `generateRakhiIndexPage()` (~line 1417): currently calls `collagebannerHtml('Rakhi Gift Catalogue', 'Curated picks for every kind of sibling this Raksha Bandhan', bannerImages)`. Update the description string to also mention the offers, e.g.:
  `'Curated picks for every kind of sibling this Raksha Bandhan · Free Bunny Keychain ₹499+ · 5% off ₹1,499+ · 10% off ₹2,999+'`
  Keep it readable — consider whether this belongs in the `<p>` subtitle or as a separate small line; `collagebannerHtml()` (~line 1274) only supports title + one description paragraph today, so either extend that function to accept an optional secondary line, or fold the offer text into the existing description with a separator (simpler, prefer this unless it reads badly once rendered — check in browser).

- `generateRakhiCollectionPage()` (~line 1470): uses `collection.description` (pulled live from Shopify) as the banner subtitle — this is real Shopify collection copy, don't overwrite it wholesale. Instead, consider appending the offer line after the Shopify description, or rely on the sitewide announcement bar (Step A) being sufficient here since it's present on every page including these. Recommend: **skip per-collection banner edits** if the announcement bar (Step A) already covers it — avoid redundant/cluttered copy. Only add here if, after previewing, the announcement bar doesn't feel sufficiently prominent on these specific landing pages (likely first-touch pages for ad traffic).

Also update the meta description strings in `generateRakhiIndexPage()`'s `headHtml()` call (~line 1431-1433) if they should mention the offers for SEO/social-share purposes — currently just "Curated Raksha Bandhan gift picks... Free shipping above ₹299." Optional, low priority.

### Step E — Build, verify, preview

1. `npm run build-shop` (or `buildshop` skill) — confirm the process exits cleanly with no errors/warnings, and confirm via `git status` / `git diff --stat` that `shop/rakhi/index.html`, all 8 `shop/rakhi/<handle>/index.html`, `shop/index.html`, and a sample of `shop/collections/**` and `shop/products/**` pages actually changed (i.e. the new generator code ran and touched every template that calls `shopHeaderHtml(`, not just the Rakhi pages).
2. Spot-check the announcement bar renders correctly at every page depth (homepage depth 0, `shop/` depth 1, `shop/rakhi/` depth 2, `shop/rakhi/<handle>/` depth 3, `shop/products/<handle>/` depth 2) — relative link paths (`base`/`shopBase`) must resolve correctly at each depth, this is a common bug source in this codebase's link generation.
3. `npm run serve` (or `serve` skill), open `http://localhost:8080` — **never use `open file.html`**, per existing site convention.
4. Run `npm test` (or `test` skill) — this runs `vitest run` (unit, includes `tests/build-shop.unit.test.js` and `tests/cart.unit.test.js`) followed by `playwright test` (e2e, currently just `tests/cart.e2e.spec.js`, run against `http://localhost:8080` per `playwright.config.js`'s `webServer` block — Playwright will auto-start the server if one isn't already running on port 8080). Fix any breakage caused by the new markup; don't skip or delete failing tests to get this done faster. If `build-shop.unit.test.js` asserts on exact HTML output of any function you touched (`shopHeaderHtml`, `generateRakhiIndexPage`, etc.), expect it to fail until the assertions are updated to match the new markup — update the test expectations deliberately, don't loosen them just to pass.

#### Manual verification checklist (do all of these in the browser at `http://localhost:8080`, not by reading HTML source)

**Layout / fixed-header regression (see the "Fixed-header layout gotcha" note above — this is the highest-risk part of this change):**
- [ ] On every page type below, confirm the announcement bar does NOT overlap the header, and the header does NOT overlap the first row of page content (banner/hero/product grid). Scroll to top of page after load to check the resting state first.
- [ ] `.collection-topbar` (the collection chip strip / "All | The Book Worm Sister | ..." row) is not hidden behind the header or the announcement bar when the page loads scrolled-to-top, and remains correctly positioned when you scroll down and the topbar goes sticky.
- [ ] Resize the browser to a mobile width (≤480px) and repeat the same checks — `.header-spacer` and any `top: 80px`-style offsets may have separate mobile media-query overrides that also need updating.
- [ ] If the announcement bar is fixed/sticky (decision (a) in the gotcha note): scroll down a full page length and confirm it behaves as intended (stays pinned, or scrolls away, whichever was decided) with no flicker or jump.

**Cross-page presence — announcement bar must appear sitewide, not just on Rakhi pages:**
- [ ] `/` (homepage) — bar present, correct copy, links to `/shop/rakhi/`
- [ ] `/shop/` (shop index) — bar present
- [ ] `/shop/rakhi/` — bar present (may look redundant next to Step D's banner copy if that was also added — confirm it doesn't read as duplicated/awkward; if it does, revisit the Step D "skip per-collection banner edits" recommendation)
- [ ] At least 2 of the 8 `/shop/rakhi/<handle>/` pages
- [ ] At least 1 regular (non-Rakhi) `/shop/collections/<handle>/` page — confirms the bar is genuinely sitewide, not accidentally scoped to Rakhi templates only
- [ ] At least 1 `/shop/products/<handle>/` product detail page
- [ ] `404.html` — decide whether the bar should appear here too (not specified in this plan; use judgement, note the decision either way rather than leaving it inconsistent by accident)

**Nav link (Step B):**
- [ ] Homepage desktop nav shows the new "Rakhi Gifts" (or chosen label) link, positioned sensibly among existing items
- [ ] Homepage mobile hamburger menu also shows it (check the hamburger actually opens and the link is inside `.nav-links`, not missed because mobile uses a different element)
- [ ] Clicking it from the homepage lands on `/shop/rakhi/` with no 404/redirect issues
- [ ] If Step B's shop-side nav question was resolved by adding something to `shopHeaderHtml()`, verify it on at least one shop page too; if it was correctly scoped to homepage-only per the note in Step B, confirm that's a deliberate, not accidental, omission

**Homepage promo banner (Step C):**
- [ ] Renders in the correct seam (after hero, before next section) without breaking the layout/spacing of sections above or below it
- [ ] CTA button correctly links to `/shop/rakhi/`
- [ ] Visually distinct from the hero carousel — confirm a first-time viewer wouldn't mistake it for a 9th carousel slide
- [ ] Mobile layout check — text wrapping, button tap target size, image scaling if any images are used

**Collection banner copy (Step D, if implemented beyond the sitewide bar):**
- [ ] `/shop/rakhi/` banner subtitle reads naturally with the offer text appended (not truncated, not run-on)
- [ ] Meta description / OG description (view page source or use browser devtools → Elements → `<head>`) updated if that part of Step D was done — spot-check by pasting the URL into a Slack/WhatsApp preview or similar if you want to confirm social-card rendering (optional)

**Content accuracy (cross-check against Shopify, don't trust the copy you wrote without re-verifying):**
- [ ] Announcement bar and any banner copy say **₹499+** for the free bunny keychain, **₹1,499+** for RAKHI05 (5%), **₹2,999+** for RAKHI10 (10%) — these exact thresholds, matching what's live in Shopify (re-run the `graphql_query` from this plan's research phase, or check Shopify Admin directly, if there's any doubt the discounts have changed since 2026-08-06)
- [ ] Discount code spelling is exact: `RAKHI05`, `RAKHI10` (case as Shopify has them) — a typo here means customers can't apply the code
- [ ] No mention of a bundled/combo total price anywhere (per the creative brief's existing rule) — each offer is a threshold-based storewide discount, not a fixed bundle
- [ ] Nothing links to a retired `/rakhi-combos/` or similar URL that doesn't exist — all CTAs point to real, live URLs (`/shop/rakhi/`, specific collection handles)

**Sitemap / SEO (only if Step D touched `headHtml()` meta descriptions):**
- [ ] `sitemap.xml` (repo root, written by the `buildSitemapXml` call in the main build routine ~line 1979-1980) still includes `/shop/rakhi/` and all 8 collection URLs — this was already true before this change, just confirm the build didn't regress it

### Step F — Do not push automatically

Per stored user preference: **never `git push` after committing unless the user explicitly says to push in that session.** Commit locally if asked to commit, but stop there and let the user decide on pushing.

---

## 4. Open items to flag to the user (not to decide unilaterally)

- Exact announcement bar wording/tone — draft above is a starting point, not final copy. Show the user a preview before treating copy as final.
- Whether the homepage promo banner (Step C) should be removed/hidden after Aug 28 (festival date) — don't build auto-expiry logic, just ask when the time comes.
- If Step B turns out to need new persistent nav chrome on shop pages (not just the homepage), that's a bigger structural change than "add one nav link" — surface this to the user rather than silently expanding scope.
