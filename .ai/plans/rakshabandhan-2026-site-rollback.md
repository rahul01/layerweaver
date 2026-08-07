# Raksha Bandhan 2026 — Site Rollback Plan

**Status:** Not to be executed before 2026-08-29. Written so a fresh Claude Code session can pick this up with no prior conversation context.
**Written:** 2026-08-06
**Updated 2026-08-07:** see new §1a — the masterplan was executed with one mechanism change (BXGY became a discount code, not automatic) and one scope addition (a cart-side rewards progress bar) beyond what this document originally anticipated. Sections below that reference the old automatic-discount GID or don't mention the cart system are corrected/extended accordingly; read §1a before executing.
**Updated 2026-08-07 (later same day):** see new §1b — the homepage hero carousel, previously explicitly out of scope (old §4), was converted to a full Rakhi takeover. It is now IN SCOPE for this rollback; see §3 item F. Read §1b before executing.
**Updated 2026-08-08:** see new §1c (discount code names dropped from copy, informational only), §1d (logo ribbon badge — expanded from homepage-only to sitewide same day, touching 16+ files — see rewritten §3 item H), §1e (cross-catalogue chip links added between regular shop and Rakhi pages — see §3 item G, the one change here that touches code shared with the non-Rakhi shop and needs a user judgement call before reverting), §1f ("All" chip renamed to "All Rakhi Gifts", Rakhi-only, low risk), and §1g (festive page-level theming — cream background, amber accent, ribbon badge, SVG thread motif — added to Rakhi pages, entirely additive/Rakhi-scoped, see §3 item I).
**Execute on:** 2026-08-29 (the day after the festival — 2026-08-28 — and after the Shopify discounts have expired)
**Depends on:** `.ai/plans/rakshabandhan-2026-site-masterplan.md` having actually been executed first. If that plan was never implemented (check `git log` for its commits before doing anything else here), there is nothing to roll back — stop and tell the user.

---

## 1. Why this document exists

The site masterplan (`.ai/plans/rakshabandhan-2026-site-masterplan.md`) intentionally added **no auto-expiry logic** for any of its changes (see that plan's Step C and "Open items" section — the user explicitly did not want auto-expiry code, decisions were deferred to "ask when the time comes"). That time has come. This document is that decision, written in advance so it doesn't need to be re-litigated on the day.

**Do not run this before 2026-08-29.** The campaign runs through Raksha Bandhan (2026-08-28) and the Shopify discounts (RAKHI05, RAKHI10, free bunny keychain BXGY) are configured to expire automatically at `2026-08-28T18:30:xx Z`. Running this a day early would pull the site messaging while the offers are still technically live.

### 1a. What changed after this document was written (read before executing)

Two things happened after 2026-08-06 that this document's original text (§2 step 2, §3.A, §4) doesn't account for — corrected inline below, but noted here up front:

1. **The free Bunny Keychain discount is no longer automatic.** It was deleted and replaced with a code-based BXGY discount, `BUNNY499`, because Shopify wouldn't combine the automatic version with a percent-off code. When checking for expired discounts in §2, look for `BUNNY499` as an ordinary discount code (`DiscountCodeBxgy`), not `DiscountAutomaticBxgy` under the old GID.
2. **A cart-side rewards system was built on top of the masterplan** (unified free-shipping + Rakhi-tier progress bar in the cart drawer, auto-added/removed Bunny Keychain gift line, Subtotal/Discount/Total breakdown) — see `shop/cart.js`'s `REWARD_TIERS`/`syncRakhiPerks`/`renderRewardsBar` and the `.rewards-progress`/`.cart-discount-row` CSS in `shop/shop.css`. This is genuinely Rakhi-specific (it references `BUNNY499`/`RAKHI05`/`RAKHI10` by name and hides itself once no tier is reachable) and should be considered part of what this rollback removes — §3 and §4 below have been extended to cover it. The free-shipping portion of that same progress bar (₹299 tier) is **not** Rakhi-specific and predates this campaign in spirit even though it shipped in the same commit — don't remove free-shipping messaging entirely, only the Rakhi-tier portions layered onto it (use judgement/ask the user if the cart code doesn't cleanly separate the two by the time this runs).

### 1b. Homepage hero carousel is now IN SCOPE for this rollback (added 2026-08-07 — corrects §4's old "out of scope" note)

**This reverses what this document originally said.** The original §4 (below) said the hero carousel was untouched by the masterplan and needed no reversal — that was true when written (2026-08-06) but stopped being true on 2026-08-07, when the owner asked for a full Rakhi takeover of the homepage hero (see masterplan §0 item 4). As of that change:

- `scripts/build-shop.js` generates the hero carousel slides from `rakhiCollections` instead of the regular `collections` (one-line change at the `heroCarouselSlidesHtml(...)` call site, ~line 1972).
- `index.html`'s hand-authored `.hero-left` (service callouts + CTA button) and `.hero-eyebrow`/`h1` were rewritten with Rakhi-specific copy, replacing the original evergreen "3D Printed Products" / "Bringing Ideas to Life Layer by Layer" content and the 3 generic service links (On Demand Printing / 3D Design / Workshops).

**Reverting this means restoring the pre-campaign evergreen hero**, not just deleting something added — there's no "off" state, only "swap back." §3 below has a new item **F** for this. Before executing, check `git log -p` on `index.html`'s `.hero-left`/`.hero-right-header` block and `scripts/build-shop.js`'s `heroCarouselSlidesHtml` call site to confirm the exact pre-2026-08-07 copy/code to restore (don't trust this document's memory of the old copy if the code has drifted further since — quote what git shows, not what's written here).

### 1c. Discount code names removed from homepage copy (2026-08-08 — no new rollback action needed, informational only)

The announcement bar and the trimmed `.rakhi-promo` strip (§1b) no longer print `RAKHI05`/`RAKHI10` by name anywhere — only the benefit ("5% off ₹1,499+") since both offers auto-apply and there's no code to type (see masterplan §0 item 6). This doesn't change what §3 items A/C remove (the whole announcement bar / whole promo section still gets deleted wholesale either way) — it only means: if you're diffing against an *old* copy of this repo or an earlier draft of this document to sanity-check what the "current" copy says, don't be surprised the code names are gone from homepage-visible text. They're still correctly used internally in `shop/cart.js`'s `REWARD_TIERS` (§3.E) and in the Shopify discount system itself (§2/§4) — this change is cosmetic/copy-only, not a mechanism change.

### 1d. Logo ribbon badge added SITEWIDE (2026-08-08, expanded same day — see rewritten item H below)

`index.html`'s header logo markup was restructured (masterplan §0 item 7) to add a "Shop Rakhi Gifts" ribbon (torn-paper style, matching the retired 6-month-campaign's logo sticker treatment) below the logo, linking to `shop/rakhi/`. This required splitting the old single `<a class="logo-container logo-link">` into a wrapping `<div class="logo-container">` with two sibling `<a>` tags (nesting a second link inside the original anchor is invalid HTML). **This started homepage-only but was expanded the same day to every page on the site** — `shopHeaderHtml()` (covers all generated `shop/**`/`shop/rakhi/**` pages) plus 14 individually hand-edited pages (`404.html`, `workshop/`, `enroll/`, `enroll-adult/`, `privacy-policy/`, `faq/`, `gallery/`, `return-and-exchange-policy/`, `terms-of-service/`, `connect/`, `shipping-policy/`, `services/3d-design/`, `services/on-demand/`, `shop/collage/`). **This is now the single largest-surface-area change in this entire campaign** — touching more individual files than every other item in this document combined. See rewritten **item H** in §3 below; the old version (written when this was homepage-only) undercounted the revert scope significantly.

### 1e. Cross-catalogue chip links added — new item G below (2026-08-08)

`collectionNavHtml()` (`scripts/build-shop.js` ~line 732) — the shared chip-strip function used by **both** the regular shop and the Rakhi catalogue — gained an optional `crossLink` parameter that appends a "🪢 Rakhi Gifts" chip on regular shop/collection pages and a "← Full Shop" chip on Rakhi/collection pages (see masterplan §0 item 7). **This is the one piece of this rollback that touches code shared with the non-Rakhi shop** — every other change in this document is additive-and-isolated (announcement bar, nav link, promo banner, cart tiers) or Rakhi-only (hero, collection banners). Reverting it means removing the Rakhi-side call sites' `crossLink` argument, but the regular-shop call sites' argument should also come out **only if** the "🪢 Rakhi Gifts" chip is meant to disappear too — if the Rakhi catalogue itself stays live post-campaign (see §6 "Open items" below), it may be worth asking the user whether the regular-shop → Rakhi chip should stay as evergreen discoverability rather than being reverted. Don't assume either way; this is exactly the kind of judgement call §6 exists for. See new **item G** in §3 below.

**Note (2026-08-08):** `collectionNavHtml()`'s signature gained an 8th positional parameter, `allLabel = 'All'` (masterplan §0 item 9, see §1f below), after the `crossLink` param above was added — so by the time this rollback runs, the function has 7 params total (`collections, shopBase, activeHandle, basePath, allHref, crossLink, allLabel`). Line numbers cited elsewhere in this document for `collectionNavHtml(...)` call sites may drift further if more params get added later — always re-grep rather than trust a hardcoded line number.

### 1f. Rakhi catalogue's "All" chip renamed to "All Rakhi Gifts" (2026-08-08 — Rakhi-only, no shared-code risk)

Unlike §1e's `crossLink` addition, this one is low-risk to revert: `collectionNavHtml()` gained an `allLabel = 'All'` parameter (defaults preserve existing behavior everywhere), and only the two Rakhi call sites (`generateRakhiIndexPage`/`generateRakhiCollectionPage`) pass `'All Rakhi Gifts'` explicitly — the regular shop's two call sites were never touched and still show plain "All" with no changes needed there. To revert: remove the `'All Rakhi Gifts'` argument from those two Rakhi call sites (or remove the `allLabel` parameter from `collectionNavHtml()` entirely if nothing else uses it by then). No CSS changes were involved. Covered by the same **item G** rebuild/verify steps in §3 — no separate checklist item needed.

### 1g. Festive page-level theming added to Rakhi catalogue pages (2026-08-08 — see new item I below)

Rakhi index + all 8 sub-collection pages gained a distinct visual theme: cream background (`--rakhi-cream`), amber accent color (`--rakhi-amber`) on active chips, a "Rakhi Special" ribbon badge, and a custom inline SVG rakhi-thread/knot motif on the collection banner (see masterplan §0 item 11 for full detail). This is **entirely additive and Rakhi-scoped** — no shared component was modified in place; a new wrapper function (`rakhiFestiveBannerHtml()`) was added alongside the existing `collagebannerHtml()` rather than editing it, and the new CSS is all gated behind `body.rakhi-theme` or `.rakhi-*`-prefixed selectors. Regular shop pages should be completely unaffected by reverting this. See new **item I** in §3 below.

---

## 2. Pre-flight check — confirm campaign is actually over before touching anything

Before reverting any code, verify state rather than assuming the date alone is sufficient:

1. **Check today's date** is 2026-08-29 or later. If a fresh session is asked to run this earlier, stop and confirm with the user before proceeding — don't silently execute early.
2. **Check the Shopify discounts actually expired.** Run (via the Shopify MCP tools):
   ```graphql
   query {
     discountNodes(first: 20, query: "status:active") {
       edges { node { id discount {
         ... on DiscountCodeBxgy { title status endsAt codes(first:1){edges{node{code}}} }
         ... on DiscountCodeBasic { title status endsAt codes(first:1){edges{node{code}}} }
       } } }
     }
   }
   ```
   Confirm `BUNNY499`, `RAKHI05`, and `RAKHI10` are no longer in the active list (see §1a — the keychain offer is a code-based BXGY discount named `BUNNY499`, not the automatic discount this section originally referenced). If any are still active (e.g. the owner manually extended the campaign), **stop and ask the user before reverting site messaging** — don't pull offer banners while the offers are still live and running.
3. **Check for a live order backlog.** If there's reason to believe Rakhi orders are still being fulfilled/shipped post-festival (normal for a print-on-order shop), that's fine — this rollback only touches marketing surface area (banners, nav links), not order processing, fulfillment, or the underlying Rakhi collection pages/products themselves (those stay live, see Section 4).

If both checks pass, proceed.

---

## 3. What gets reverted (maps to the masterplan's Steps A-D, plus §3.E for the cart system added afterward)

The cleanest execution path is `git revert` of the exact commit(s) the masterplan produced, **if** those changes were committed as a clean, isolated commit (or small set of commits) separate from unrelated work. Check first:

```
git log --oneline --grep="rakhi\|rakshabandhan\|announcement\|cart rewards\|bundle" -i --all
```

As of 2026-08-07 this turns up (newest first): `128003e6` (regenerated HTML output — mixes the announcement bar AND unrelated bundle-page thumbnail/variant fixes, see §3.note below), `7d772974` (generator source: announcement bar + bundle fixes, also mixed), `609f5622` (cart rewards system, clean — see §3.E), `a52a23ee` (this doc + the masterplan, docs only, nothing to revert). **Don't trust this list to still be accurate** if more work has landed since — re-run the command and re-derive which commits are actually clean before reverting anything.

- **If a clean, isolated commit (or commits) exists covering exactly the masterplan's Steps A-D and nothing else:** prefer `git revert <sha>` (or multiple, oldest-to-newest if several) over hand-editing. This is safer and self-documenting. Confirm with `git show <sha> --stat` that the file list matches Section 3's list below before reverting — if unrelated files were bundled into the same commit, fall back to manual reversal for just the relevant hunks instead of reverting the whole commit.
- **If the changes are mixed into unrelated commits, or were never committed as a clean unit:** revert manually per the checklist below. In that case, read each file's current state first (don't assume the masterplan's plan text describes the final implementation exactly — it may have evolved during execution) and remove precisely what the campaign added.
- **Note on `128003e6`/`7d772974` specifically:** both bundle the announcement-bar work with unrelated bundle-product (dino skeletons, named & glossy) thumbnail/variant-labeling fixes that have nothing to do with this campaign and must NOT be reverted. Don't `git revert` these two commits wholesale — use manual reversal (the A-D checklist below) for just the announcement-bar hunks. `609f5622` (cart rewards) is clean and safe to revert wholesale if the entire cart system (not just the Rakhi tiers within it) should go — but see §3.E below, since that commit's free-shipping tier is arguably not campaign-specific and worth keeping.

### Manual reversal checklist (use if git revert isn't clean)

**A. Sitewide announcement bar**
- [ ] Remove the `announcementBarHtml()` (or whatever it was actually named) function from `scripts/build-shop.js`.
- [ ] Remove its call site from every `generate*Page` function it was wired into (search for the function name to find every call site — the masterplan intended this on every page that calls `shopHeaderHtml(`, so check `generateShopIndex`, `generateCollectionPage`, `generateRakhiIndexPage`, `generateRakhiCollectionPage`, product page generator, and any others).
- [ ] Remove the equivalent hand-authored markup from `index.html` (near the top of `<body>`, above `<header>`).
- [ ] Remove the `.announcement-bar` CSS rules from `shop/shop.css` and `styles.css`.
- [ ] **Critical:** if the announcement bar's height was wired into `.header-spacer` height, `.shop-header`'s fixed offset, or `.collection-topbar`'s sticky `top` value (per the masterplan's "Fixed-header layout gotcha" note — check if a `--announcement-height` custom property or similar was introduced), revert those offsets back to their pre-campaign values (`.header-spacer { height: 80px }`, `.collection-topbar { top: 80px }` as of 2026-08-06 — confirm these are still the right pre-campaign values by checking `git log -p` on those specific CSS rules, in case they changed for unrelated reasons since). Getting this wrong will leave a gap or overlap at the top of every page after the bar is removed — this is the most likely thing to be missed in a rushed reversal.

**B. Main nav link**
- [ ] Remove the "Rakhi Gifts" (or whatever label was actually used) `<li>` from `index.html`'s `<ul class="nav-links">`.
- [ ] Remove the mobile hamburger-menu equivalent if it was a separate element rather than the same one.
- [ ] If Step B of the masterplan resulted in any addition to `shopHeaderHtml()` in `scripts/build-shop.js` (the masterplan flagged this as uncertain/needs-confirmation at plan-writing time — check what was actually built), remove that too.

**C. Homepage promo banner**
- [ ] Remove the entire hand-authored `<section class="rakhi-promo">` from `index.html`. **As of 2026-08-07 (same day as the §1b hero takeover) this section was trimmed down to just a `.rakhi-promo-offers` `<ul>` with two offer bullets** (5% off ₹1,499+ / 10% off ₹2,999+, no discount code names shown — see §1c/masterplan §0 item 6 for why) — the original eyebrow/`<h2>`/sub-line/Bunny-Keychain-bullet/CTA button were removed because they'd become verbatim duplicates of the new hero content (see masterplan §0 item 5). Don't expect to find the fuller original markup described by earlier drafts of this checklist — check `git log -p` on this section if you need the pre-trim version for reference, but the removal action is the same either way: delete the whole `<section class="rakhi-promo">` block.
- [ ] Remove the `.rakhi-promo`/`.rakhi-promo-inner`/`.rakhi-promo-offers`/`.rakhi-promo-offers li`/`.rakhi-promo-offers i` CSS rules from `styles.css` (the `.rakhi-promo-eyebrow`/`.rakhi-promo h2`/`.rakhi-promo-sub` rules were already deleted as dead code on 2026-08-07 when the section was trimmed — don't go looking for them).

**D. Collection banner copy / meta description offer mentions**
- [ ] In `generateRakhiIndexPage()` (`scripts/build-shop.js`), revert the `collagebannerHtml(...)` description string back to just `'Curated picks for every kind of sibling this Raksha Bandhan'` (remove the appended offer text, e.g. "· Free Bunny Keychain ₹499+ · 5% off ₹1,499+ · 10% off ₹2,999+" or whatever was actually shipped).
- [ ] If per-collection (`generateRakhiCollectionPage()`) banner copy was also touched (masterplan recommended skipping this unless the sitewide bar felt insufficient — check whether it was actually done), revert those too, restoring reliance on the live Shopify `collection.description` only.
- [ ] If `headHtml()` meta descriptions in `generateRakhiIndexPage()` were updated to mention offers, revert to the original: title `'Rakhi Gift Catalogue – LayerWeaver'`, description `'Curated Raksha Bandhan gift picks for every kind of sibling – gamers, bookworms, WFH sisters, car guys, and more. Free shipping above ₹299.'` (verify against `git log -p` on that specific string rather than trusting this document's memory of it, in case it was tweaked during execution).

**E. Cart rewards system (not in the original masterplan — added per §1a, see commit `609f5622`)**
- [ ] In `shop/cart.js`, remove the Rakhi tiers (`BUNNY499`/`RAKHI05`/`RAKHI10` entries) from `REWARD_TIERS`, leaving only the free-shipping (₹299) tier — don't delete the whole progress-bar mechanism, since free shipping isn't Rakhi-specific and may be worth keeping as evergreen cart messaging (confirm with the user rather than assuming either way).
- [ ] Remove `syncRakhiPerks()`'s gift-line and discount-code sync logic (the auto-add/remove of the Bunny Keychain line, the `setDiscountCodes` calls tied to `RAKHI_TIERS`), and its call sites, once the Rakhi tiers are gone from `REWARD_TIERS` this function may become a no-op worth deleting entirely — check.
- [ ] Remove the Subtotal/Discount/Total breakdown in the cart footer (`renderDiscountBreakdown`, `#cart-discount-row`/`#cart-savings-row` and related markup) if it was purely in service of showing Rakhi savings — check whether it's generic enough to keep (e.g. useful for `FAMILY15` too) before removing; ask the user if unclear.
- [ ] Remove the corresponding `.rewards-progress`/`.cart-discount-row` CSS additions in `shop/shop.css` for whatever was actually removed above (don't remove CSS still used by the free-shipping-only bar if that's being kept).

**F. Homepage hero carousel takeover (added per §1b, 2026-08-07 change — NOT in the original masterplan commits)**
- [ ] In `scripts/build-shop.js`, change the `heroCarouselSlidesHtml(rakhiCollections)` call (~line 1972) back to `heroCarouselSlidesHtml(collections)` — restores hero slides sourced from regular (non-Rakhi) collections.
- [ ] In `index.html`, restore `.hero-eyebrow` to `3D Printed Products` and the `h1` to `Bringing Ideas to Life <span class="brand-text">Layer by Layer</span>` (confirm exact pre-2026-08-07 text via `git log -p` on this block rather than trusting this document's memory of it).
- [ ] In `index.html`'s `.hero-left`, restore the original 3 `hero-service-item` entries (On Demand Printing → `services/on-demand/`, 3D Design → `services/3d-design/`, Workshops → `workshop/`) in place of the 3 Rakhi offer callouts (Free Bunny Keychain / Up to 10% Off / Free Shipping — the 3rd was briefly "Ships in 3 Days" before being changed same-day, see masterplan §0 item 4), and restore the `.hero-shop-btn` CTA to `Shop Now` → `shop/` (from `Shop Rakhi Gifts` → `shop/rakhi/`).
- [ ] Rebuild (`npm run build-shop`) so the carousel slides regenerate from non-Rakhi collections, and visually confirm the homepage hero looks like the pre-campaign evergreen version — no Rakhi persona-collection slides, no Rakhi copy anywhere above the (already-removed, per item C) promo banner.

**G. Cross-catalogue chip links (added per §1d, 2026-08-08 — the one change that touches shared, non-Rakhi-only code)**
- [ ] **Ask the user first** whether the "🪢 Rakhi Gifts" chip on regular shop pages should be removed, or kept as evergreen discoverability even if the Rakhi catalogue itself stays live post-campaign (see §1d and §6 — this is explicitly not a call to make unilaterally).
- [ ] If removing entirely: in `scripts/build-shop.js`, drop the 6th `crossLink` argument from all 4 `collectionNavHtml(...)` call sites (`generateShopIndex` ~line 811, `generateCollectionPage` ~line 1401, `generateRakhiIndexPage` ~line 1473, `generateRakhiCollectionPage` ~line 1530) — or just the Rakhi-side two if only the Rakhi→Shop direction should go (e.g. because the Rakhi catalogue is being retired) while Shop→Rakhi discoverability is kept.
- [ ] If the whole `crossLink` mechanism is being removed (not just its call-site usage), also remove the parameter and its handling from `collectionNavHtml()` itself, and the `.collection-nav-chip--cross`/`.collection-dropdown-item--cross` CSS from `shop/shop.css` — but only if nothing else uses it by then (check for other `crossLink` call sites first, in case this pattern got reused elsewhere between now and whenever this rollback runs).
- [ ] Rebuild and confirm the chip strip on `/shop/` and `/shop/rakhi/` (and their sub-collection pages) looks correct either way — no dangling dashed-border chip with a dead link if the Rakhi catalogue itself was retired but this cleanup step was missed.

**H. Sitewide "Shop Rakhi Gifts" logo ribbon badge (added/expanded per §1d, 2026-08-08 — touches more files than any other item in this document)**

This one needs a full-repo sweep, not a fixed file list — by the time this rollback runs, more pages may have been added to the site (or this pattern may have been reused elsewhere) since 2026-08-08. Start with:
```
grep -rl "logo-rakhi-ribbon" --include="*.html" .
```
and revert every match. As of 2026-08-08 that's expected to include:
- `index.html` (homepage, hand-authored)
- `scripts/build-shop.js`'s `shopHeaderHtml()` function (~line 524) — **the single highest-leverage revert**, since it propagates to every generated `shop/**` and `shop/rakhi/**` page on the next `npm run build-shop`. Don't hand-edit any generated `shop/**/index.html` file directly — revert the generator function and rebuild.
- 14 individually hand-authored pages: `404.html`, `workshop/index.html`, `enroll/index.html`, `enroll-adult/index.html`, `privacy-policy/index.html`, `faq/index.html`, `gallery/index.html`, `return-and-exchange-policy/index.html`, `terms-of-service/index.html`, `connect/index.html`, `shipping-policy/index.html`, `services/3d-design/index.html`, `services/on-demand/index.html`, `shop/collage/index.html`

For each match:
- [ ] Remove the `<a href="...shop/rakhi/" class="logo-rakhi-ribbon">Shop Rakhi Gifts</a>` element.
- [ ] Collapse the split-apart structure back to a single link: `<div class="logo-container"><a class="logo-link" href="...">...</a></div>` → `<a href="..." class="logo-container logo-link">...</a>` (same href, same depth-appropriate relative path the page already used). Confirm exact pre-2026-08-08 markup via `git log -p` on that specific file rather than trusting this document's memory, in case the pattern drifted further between now and whenever this rollback runs.
- [ ] In `styles.css`, remove `.logo-rakhi-ribbon`. Check whether `.logo-link` should also be removed — it didn't exist in `styles.css` before this change (only in `shop/shop.css`, pre-existing/unrelated) — if nothing else in `styles.css` uses it after reverting, remove it too.
- [ ] In `shop/shop.css`, remove `.logo-rakhi-ribbon` (including its `@media (max-width: 480px)` override) and the `.logo-container` rule that was added specifically for this (confirm via `git log -p` that `.logo-container` didn't exist in `shop/shop.css` before this change and isn't needed for anything else before deleting it).
- [ ] Rebuild (`npm run build-shop`) and spot-check the header logo across page types (homepage, shop index, a product page, a Rakhi page, and at least 2 of the hand-authored pages) — single link, no ribbon, hovering/clicking behaves as one unit again everywhere.
- [ ] Run `npm test` (43 vitest + 40 Playwright as of 2026-08-08) — confirm the same pass count as before the revert; investigate any new failures rather than assuming they're pre-existing.
- [ ] Update/remove the Rakhi-specific tests in `tests/cart.e2e.spec.js` (the `describe('Rakhi rewards ...')` block and any `REWARD_TIERS`-dependent assertions elsewhere) to match whatever cart.js ends up looking like post-revert — don't leave tests asserting on removed behavior.
- [ ] Run `npm test` after this section specifically — the cart test suite is large and easy to leave partially broken.

**I. Festive Rakhi page theming (added per §1g, 2026-08-08 — additive/Rakhi-scoped, low risk)**
- [ ] In `scripts/build-shop.js`: remove `rakhiThreadMotifSvg()` and `rakhiFestiveBannerHtml()` (both new functions, near `collagebannerHtml()`). In `generateRakhiIndexPage()` and `generateRakhiCollectionPage()`, revert the `rakhiFestiveBannerHtml(...)` call back to plain `collagebannerHtml(...)`, and remove the `rakhi-theme` class from each function's `<body>` tag.
- [ ] In `shop/shop.css`: remove the "Rakhi festive theme" block (`body.rakhi-theme`, `.rakhi-banner-wrap`, `.rakhi-special-badge`, `.rakhi-banner-motif`, `.rakhi-thread-motif`, the `@media (max-width: 768px)` overrides for those, and the `body.rakhi-theme .collection-nav-chip.active`/`.collection-dropdown-item.active` amber overrides).
- [ ] In `styles.css`'s `:root`: remove `--rakhi-cream` and `--rakhi-amber` — confirm via grep (`grep -rn "rakhi-cream\|rakhi-amber"`) that nothing else references them first (they were added specifically for this theming and shouldn't have spread elsewhere, but verify rather than assume).
- [ ] Rebuild and confirm Rakhi pages look like plain shop pages again — white background, standard purple active-chip color, no badge/motif on the banner. Regular shop pages should show zero diff (this change never touched anything outside `body.rakhi-theme`/`.rakhi-*` selectors and the two Rakhi generator functions).
- [ ] Run `npm test` — no test assertions were written against this theming specifically (it's purely visual/CSS), so this should be a clean pass with no test-file edits needed, unlike item E above.

---

## 4. What does NOT get reverted — explicitly out of scope

Don't touch these. They're either permanent site infrastructure that predates the campaign, or seasonal-but-intentionally-kept content:

- **The 8 Rakhi Shopify collections and their generated pages** (`shop/rakhi/index.html`, `shop/rakhi/<handle>/index.html`, and the `generateRakhiIndexPage`/`generateRakhiCollectionPage`/`RAKHI_COLLECTION_HANDLES`/`fetchRakhiCollections` machinery in `scripts/build-shop.js`). These existed **before** this campaign's site-update work and are reachable via direct URL/sitemap per the original design — that's independent of the announcement-bar/nav-link/promo-banner additions this rollback removes. Leave them live unless the user separately asks to retire the Rakhi catalogue entirely (different, bigger decision — don't make it unilaterally here).
- **The Shopify discounts themselves** (`BUNNY499`, `RAKHI05`, `RAKHI10` — see §1a for the `BUNNY499` naming/mechanism change). These expire on their own via their `endsAt` dates — don't delete or archive them manually unless Section 2's pre-flight check found them still active for some reason (e.g. manually extended) and the user then confirms they should be turned off.
- **The free-shipping (₹299) tier of the cart progress bar**, if §3.E's revert kept it as evergreen, non-Rakhi cart messaging rather than removing the whole mechanism — confirm this was the actual outcome of §3.E before assuming it's still there.
- **`.ai/plans/rakhi-creatives-ai-brief.md`, `.ai/plans/rakhi-combos-claude-code-spec.md`, `.ai/plans/rakhi-combos-page.md`, `.ai/plans/raksha-bandhan-2026-campaign.md`** — historical/reference docs, not live site code. Leave as-is; they're campaign history, not something to clean up.
- **`ads/rakhi/` (ad creative pages + exported PNGs, including the `.offer-strip` offer copy added 2026-08-07 per masterplan §0 item 3).** Not live site code — these are static marketing assets for external ad platforms (Meta, WhatsApp), not served/linked from the site itself. Leave as-is; if ad campaigns using these creatives are still running past 2026-08-29, that's a separate ad-platform decision (pausing/archiving the campaign in Meta Ads Manager etc.), not something this rollback's git-level reversal touches.
- ~~**The homepage hero carousel** (`HERO-CAROUSEL-SLIDES-START/END` markers, `heroCarouselSlidesHtml()`) — this was never touched by the masterplan (it's driven by non-Rakhi collections only) and needs no reversal.~~ **No longer true as of 2026-08-07 — see §1b and §3 item F.** The hero carousel and surrounding `.hero-left` copy were converted to a full Rakhi takeover after this document was originally written; it is now IN SCOPE and must be reverted.
- **The `isShop` padding-toggle guard in `script.js`'s scroll handler (masterplan §0 item 8, 2026-08-08).** This fixes a genuine, pre-existing bug (the shop header visibly jumped taller on the first scroll event because its CSS had no baseline vertical padding to match what the scroll handler's `else` branch expected) that predates the Rakhi campaign and has nothing to do with Rakhi content — it was only discovered and fixed during this campaign's work. The actual fix is in `script.js` (the `if (!isShop)` guards around the padding-toggle lines in the scroll listener) — **not** in `shop/shop.css` (an earlier same-day attempt added `padding-top/bottom: 15px` to `.shop-header .container` there, but that made the shop header permanently taller instead of fixing the jump, and was reverted; `shop/shop.css` should NOT have that padding rule). **Keep the `script.js` fix permanently** — do not remove the `isShop` guards as part of undoing the Rakhi campaign.
- **This document and the masterplan document itself** — keep both in `.ai/plans/` as a record of what was built and unbuilt. Don't delete them as part of "cleanup."

---

## 5. Execution steps

1. Run the Section 2 pre-flight checks. Stop and ask the user if anything looks off (offers still active, date is wrong, masterplan was never actually executed).
2. Identify the masterplan's commit(s) via `git log`. Decide revert-by-commit vs. manual reversal per Section 3's guidance.
3. Make the reversal (git revert, or manual edits per the Section 3 checklist).
4. `npm run build-shop` (or `buildshop` skill) — rebuild all generated pages so the reverted `build-shop.js` code actually propagates to `shop/**/*.html`.
5. `npm run serve` (or `serve` skill), preview at `http://localhost:8080` — **never `open file.html` directly**, per existing site convention.
6. **Verify the reversal is clean** — this matters as much as verifying the original rollout did:
   - [ ] Announcement bar is gone from homepage and every shop page (spot-check the same page set as the masterplan's verification checklist: homepage, `/shop/`, `/shop/rakhi/`, 2 sub-collection pages, 1 regular collection page, 1 product page).
   - [ ] **No layout gap or overlap** where the announcement bar used to be — confirm `.header-spacer` height and `.collection-topbar`'s sticky `top` are back to matching the header's actual height exactly (this is the same risk as the original rollout, just in reverse — a leftover offset with no bar to fill it leaves a dead gap at the top of every page).
   - [ ] Homepage nav no longer shows "Rakhi Gifts" (or whatever label), desktop and mobile hamburger both checked.
   - [ ] Homepage promo banner section is gone; hero carousel and surrounding sections have normal spacing (no leftover empty gap where the banner section used to be).
   - [ ] `/shop/rakhi/` banner subtitle back to the pre-campaign, offer-free copy.
   - [ ] Cart drawer no longer offers/auto-applies `BUNNY499`/`RAKHI05`/`RAKHI10` or auto-adds the Bunny Keychain gift line (§3.E) — add items to a test cart at various price points and confirm no Rakhi tier language or codes appear. If the free-shipping tier was intentionally kept, confirm it still works correctly on its own with no leftover Rakhi references.
   - [ ] Run `npm test` (vitest + Playwright) — fix any failures caused by the reversal, don't skip.
   - [ ] Confirm `/shop/rakhi/` and all 8 collection sub-pages are **still live and functioning** (Section 4 — these should NOT have been touched; this check exists specifically to catch accidental over-deletion during the reversal).
7. Show the user a diff summary and the local preview URL. **Do not push to git** unless the user explicitly asks in that session — same rule as the original masterplan's Step F.

---

## 6. Open items to flag to the user (not to decide unilaterally)

- Whether the 8 Rakhi Shopify collections and their pages should eventually be retired/unpublished for next year, or left live year-round as evergreen gift-guide content. Not this document's call — ask if it comes up.
- Whether the "🪢 Rakhi Gifts" cross-link chip on regular shop pages (§1d/§3 item G) should be removed alongside everything else, or kept as a permanent discoverability link to the Rakhi catalogue regardless of what's decided about the point above.
- Whether next year's Raksha Bandhan campaign (2027) should reuse this same announcement-bar/nav-link/promo-banner pattern (i.e. treat this rollback as "pause," with a mental note to re-run a similar masterplan next year) or whether the approach should change. Just flag the question; don't answer it here.
