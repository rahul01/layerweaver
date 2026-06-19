# cart.js Optimization - COMPLETE

## Overview
Optimized `shop/cart.js` from ~865 lines to ~847 lines (-51 net lines). Added a test suite first as a safety net, then applied 7 optimizations: XSS escaping, deduplication, event delegation, caching, and batched API calls.

**Status:** All steps complete. Tests pass (22 unit, 26 E2E). Committed as `1fffdad4`.

---

## Step 0: Test suite (safety net)

- [x] **0A. Playwright E2E tests** (`tests/cart.e2e.spec.js`) - 26 tests covering cart basics, personalization, gift reconciliation, progress bar, persistence, drawer UI, analytics, button states, variant selection, and edge cases
- [x] **0B. Vitest unit tests** (`tests/cart.unit.test.js`) - 22 tests for `fmt`, `esc`, `getQualifyingTotal`, `getGiftLine`, `cartQtyMap` via `shop/cart-utils.js`

## Optimizations

- [x] **1. `esc()` HTML-escape helper** - XSS protection on product title, variant title, alt text, custom attribute keys/values in `renderCart()`
- [x] **2. `refreshUI()` helper** - Replaced 7 `updateBadge(); renderCart(); updateCartBtns();` triples with a single call
- [x] **3. Dedup init gift reconciliation** - Replaced 14-line inlined gift logic with `await reconcileGift()`
- [x] **4. `addToCartCore()` extraction** - Shared cart-create-or-add + UI update + analytics; `handleAddToCart` keeps personalization validation, listing handler keeps button disable/enable
- [x] **5. `getQualifyingTotal()` caching** - Memoized by cart reference identity (`_qtCache`/`_qtCacheCart`)
- [x] **6. Event delegation + rapid-click guard** - Single delegated listener on `#cart-body` with `_drawerBusy` flag; removed per-render `addEventListener` loops from `renderCart()`
- [x] **7. Batched cart merge** - `addLines(cartId, lines)` accepts an array; `addLine` delegates to it; `syncCartFromServer()` merges in one API call

## Files modified

| File | Change |
|---|---|
| `shop/cart.js` | All 7 optimizations applied |
| `shop/cart-utils.js` | Extracted pure functions for unit testing |
| `tests/cart.e2e.spec.js` | 26 Playwright E2E tests |
| `tests/cart.unit.test.js` | 22 Vitest unit tests |
| `playwright.config.js` | Playwright config |
| `vitest.config.js` | Vitest config |
| `package.json` | vitest + @playwright/test deps, `npm test` script |
