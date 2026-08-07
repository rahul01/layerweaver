# Raksha Bandhan 2026 — Site Rollback Plan

**Status:** Not to be executed before 2026-08-29. Written so a fresh Claude Code session can pick this up with no prior conversation context.
**Written:** 2026-08-06
**Updated 2026-08-07:** see new §1a — the masterplan was executed with one mechanism change (BXGY became a discount code, not automatic) and one scope addition (a cart-side rewards progress bar) beyond what this document originally anticipated. Sections below that reference the old automatic-discount GID or don't mention the cart system are corrected/extended accordingly; read §1a before executing.
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
- [ ] Remove the entire hand-authored `<section>` added to `index.html` for the Rakhi promo banner (the one placed after the hero section, per masterplan Step C). Confirm you're removing the right section — it should contain the Raksha Bandhan headline, the 3 offers, and a CTA to `/shop/rakhi/`, and should be visually distinct from the hero carousel (which stays — see Section 4 below, the hero carousel is unrelated and auto-regenerates from live non-Rakhi collections regardless).
- [ ] Remove any CSS added specifically for this banner section, if it wasn't reusing existing `.collection-banner`/`.banner-collage` classes wholesale.

**D. Collection banner copy / meta description offer mentions**
- [ ] In `generateRakhiIndexPage()` (`scripts/build-shop.js`), revert the `collagebannerHtml(...)` description string back to just `'Curated picks for every kind of sibling this Raksha Bandhan'` (remove the appended offer text, e.g. "· Free Bunny Keychain ₹499+ · 5% off ₹1,499+ · 10% off ₹2,999+" or whatever was actually shipped).
- [ ] If per-collection (`generateRakhiCollectionPage()`) banner copy was also touched (masterplan recommended skipping this unless the sitewide bar felt insufficient — check whether it was actually done), revert those too, restoring reliance on the live Shopify `collection.description` only.
- [ ] If `headHtml()` meta descriptions in `generateRakhiIndexPage()` were updated to mention offers, revert to the original: title `'Rakhi Gift Catalogue – LayerWeaver'`, description `'Curated Raksha Bandhan gift picks for every kind of sibling – gamers, bookworms, WFH sisters, car guys, and more. Free shipping above ₹299.'` (verify against `git log -p` on that specific string rather than trusting this document's memory of it, in case it was tweaked during execution).

**E. Cart rewards system (not in the original masterplan — added per §1a, see commit `609f5622`)**
- [ ] In `shop/cart.js`, remove the Rakhi tiers (`BUNNY499`/`RAKHI05`/`RAKHI10` entries) from `REWARD_TIERS`, leaving only the free-shipping (₹299) tier — don't delete the whole progress-bar mechanism, since free shipping isn't Rakhi-specific and may be worth keeping as evergreen cart messaging (confirm with the user rather than assuming either way).
- [ ] Remove `syncRakhiPerks()`'s gift-line and discount-code sync logic (the auto-add/remove of the Bunny Keychain line, the `setDiscountCodes` calls tied to `RAKHI_TIERS`), and its call sites, once the Rakhi tiers are gone from `REWARD_TIERS` this function may become a no-op worth deleting entirely — check.
- [ ] Remove the Subtotal/Discount/Total breakdown in the cart footer (`renderDiscountBreakdown`, `#cart-discount-row`/`#cart-savings-row` and related markup) if it was purely in service of showing Rakhi savings — check whether it's generic enough to keep (e.g. useful for `FAMILY15` too) before removing; ask the user if unclear.
- [ ] Remove the corresponding `.rewards-progress`/`.cart-discount-row` CSS additions in `shop/shop.css` for whatever was actually removed above (don't remove CSS still used by the free-shipping-only bar if that's being kept).
- [ ] Update/remove the Rakhi-specific tests in `tests/cart.e2e.spec.js` (the `describe('Rakhi rewards ...')` block and any `REWARD_TIERS`-dependent assertions elsewhere) to match whatever cart.js ends up looking like post-revert — don't leave tests asserting on removed behavior.
- [ ] Run `npm test` after this section specifically — the cart test suite is large and easy to leave partially broken.

---

## 4. What does NOT get reverted — explicitly out of scope

Don't touch these. They're either permanent site infrastructure that predates the campaign, or seasonal-but-intentionally-kept content:

- **The 8 Rakhi Shopify collections and their generated pages** (`shop/rakhi/index.html`, `shop/rakhi/<handle>/index.html`, and the `generateRakhiIndexPage`/`generateRakhiCollectionPage`/`RAKHI_COLLECTION_HANDLES`/`fetchRakhiCollections` machinery in `scripts/build-shop.js`). These existed **before** this campaign's site-update work and are reachable via direct URL/sitemap per the original design — that's independent of the announcement-bar/nav-link/promo-banner additions this rollback removes. Leave them live unless the user separately asks to retire the Rakhi catalogue entirely (different, bigger decision — don't make it unilaterally here).
- **The Shopify discounts themselves** (`BUNNY499`, `RAKHI05`, `RAKHI10` — see §1a for the `BUNNY499` naming/mechanism change). These expire on their own via their `endsAt` dates — don't delete or archive them manually unless Section 2's pre-flight check found them still active for some reason (e.g. manually extended) and the user then confirms they should be turned off.
- **The free-shipping (₹299) tier of the cart progress bar**, if §3.E's revert kept it as evergreen, non-Rakhi cart messaging rather than removing the whole mechanism — confirm this was the actual outcome of §3.E before assuming it's still there.
- **`.ai/plans/rakhi-creatives-ai-brief.md`, `.ai/plans/rakhi-combos-claude-code-spec.md`, `.ai/plans/rakhi-combos-page.md`, `.ai/plans/raksha-bandhan-2026-campaign.md`** — historical/reference docs, not live site code. Leave as-is; they're campaign history, not something to clean up.
- **`ads/rakhi/` (ad creative pages + exported PNGs, including the `.offer-strip` offer copy added 2026-08-07 per masterplan §0 item 3).** Not live site code — these are static marketing assets for external ad platforms (Meta, WhatsApp), not served/linked from the site itself. Leave as-is; if ad campaigns using these creatives are still running past 2026-08-29, that's a separate ad-platform decision (pausing/archiving the campaign in Meta Ads Manager etc.), not something this rollback's git-level reversal touches.
- **The homepage hero carousel** (`HERO-CAROUSEL-SLIDES-START/END` markers, `heroCarouselSlidesHtml()`) — this was never touched by the masterplan (it's driven by non-Rakhi collections only) and needs no reversal.
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
- Whether next year's Raksha Bandhan campaign (2027) should reuse this same announcement-bar/nav-link/promo-banner pattern (i.e. treat this rollback as "pause," with a mental note to re-run a similar masterplan next year) or whether the approach should change. Just flag the question; don't answer it here.
