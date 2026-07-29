# Remove Firebase Analytics, standardize on gtag/GA4

## Context

GA4's `begin_checkout` count looked inflated. Root cause: two independent analytics
pipelines both write into the same GA4 property (`G-00DMH9PYCG`) on the same user
action:

1. **Firebase Analytics** (`getAnalytics`/`logEvent`, exposed site-wide as
   `window.LW_LOG_EVENT`) — initialized with `measurementId: "G-00DMH9PYCG"`, so every
   `logEvent()` call lands directly in that GA4 property.
2. **gtag** (`gtag('config', 'GT-NC682MJG')`, a Google tag likely linked to Google Ads
   and to the same GA4 property) — commit `16dcb8ea` added explicit
   `gtag('event', 'begin_checkout'/'add_to_cart', ...)` calls believing "no gtag event
   calls existed," not realizing Firebase was already feeding GA4.

Every `begin_checkout` and `add_to_cart` click currently fires both, double-counting
in GA4. `view_item`, `view_cart`, `remove_from_cart`, `add_to_wishlist`/
`remove_from_wishlist` only go through Firebase today (no gtag equivalent), so they're
not doubled, but they also don't use GA4's recommended ecommerce `items[]` schema.

Decision: standardize on `gtag` (Google's directly-recommended method, already loaded
on every page) as the single event pipe, using GA4's recommended ecommerce parameter
shape (`currency`, `value`, `items: [{item_id, item_name, price, quantity}]`) for
every event. Drop Firebase Analytics (`getAnalytics`/`logEvent`) entirely. **Keep**
Firebase Performance Monitoring (`getPerformance`) — confirmed via repo search it's
the only real-user page-speed monitoring in place (no Web Vitals/Lighthouse
CI/Sentry/etc.), so `firebase-app.js` + `firebase-performance.js` stay, only the
analytics half goes.

## Scope

Two file classes carry this block:
- **Generated** (`scripts/build-shop.js` → regenerated into `shop/**/index.html` via
  `npm run build-shop`): edit the generator, not the generated files.
- **Hand-written static pages** (not touched by any build script): edit each file
  directly.

### 1. `scripts/build-shop.js` — the two source blocks

- `headHtml()` (lines 351–418) — feeds `generateShopIndex`, `generateProductPage`,
  `generateCollectionPage`.
- `generateAccountPage()`'s inline copy (lines 1243–1298), byte-identical to
  `headHtml()`'s block.

In both:
- Remove the `getAnalytics`/`logEvent` import, the `const analytics = getAnalytics(app)`
  line, and the `window.LW_LOG_EVENT = (name, params) => logEvent(analytics, name, params)`
  assignment. Remove the `window.LW_LOG_EVENT = () => {};` no-op default too — the
  global goes away entirely.
- Keep `initializeApp(...)` (Performance needs the app instance — leave the config
  object, including `measurementId`, as-is; it's harmless/unused by Performance) and
  `getPerformance(app)`.
- Add `gtag('config', 'G-00DMH9PYCG');` next to the existing
  `gtag('config', 'GT-NC682MJG');` (same hostname gate:
  `if (location.hostname === 'www.layerweaver.com')`), so gtag reports to the GA4
  property directly rather than depending on whatever GT-NC682MJG happens to be linked
  to in the Ads/GA4 admin console.

`generateTeamReviewLinksPage()` has no tracking block — no change needed there.

### 2. Replace every `LW_LOG_EVENT` call site with a direct `gtag('event', ...)` call

Same `typeof gtag === 'function'` guard already used for the existing `begin_checkout`/
`add_to_cart` gtag calls. Use GA4's recommended ecommerce shape everywhere
(`currency`, `value`, `items: [...]`) instead of the old ad-hoc flat params
(`item_name`/`item_id` at top level).

- **`scripts/build-shop.js:1084`** (`view_item`, per generated product page) → build
  `items: [{ item_id: handle, item_name: title, price }]`, `currency`, `value: price`.
  Sits right next to the existing `fbq('track', 'ViewContent', ...)` call at line 1090
  — mirror its structure.
- **`shop/cart.js:592`** (`add_to_cart` via `LW_LOG_EVENT`) → delete. The equivalent
  `gtag('event', 'add_to_cart', ...)` already exists at line 606 with the correct
  schema — no new code needed here, just remove the redundant call.
- **`shop/cart.js:285`** (`begin_checkout` via `LW_LOG_EVENT`) → delete for the same
  reason; the existing `gtag('event', 'begin_checkout', ...)` at line 297 already
  covers it.
- **`shop/cart.js:500`** (`view_cart`, in `openDrawer()`) → replace with a `gtag`
  call built the same way `begin_checkout` builds its `items[]` (map over
  `cart.lines.edges`), plus `currency`/`value` from `cart.cost.totalAmount`.
- **`shop/cart.js:657`** (`remove_from_cart`, in `handleRemoveLine()`) → the `line`
  snapshot taken before `removeLine()` already has full `merchandise` data (price,
  quantity, currencyCode) — replace with a `gtag` call using
  `items: [{ item_id, item_name, price, quantity }]`.
- **`shop/wishlist.js:246`** (`add_to_wishlist`/`remove_from_wishlist`) → replace
  with `gtag('event', added ? 'add_to_wishlist' : 'remove_from_wishlist', ...)`.
  `item.price` is a dataset string with no currency attribute available here; default
  `currency` to `'INR'` matching the existing fallback convention in `cart.js:292`
  (this is a single-market INR store).

### 3. Hand-written static pages (no generator — edit directly)

Same head-block edit as above, applied by hand to each (mechanical, identical diff
in every file, no `LW_LOG_EVENT` call sites in any of them — just the init block):

`index.html`, `workshop/index.html`, `enroll/index.html`, `enroll-adult/index.html`,
`privacy-policy/index.html`, `faq/index.html`, `gallery/index.html`,
`return-and-exchange-policy/index.html`, `terms-of-service/index.html`,
`connect/index.html`, `shipping-policy/index.html`, `services/on-demand/index.html`,
`services/3d-design/index.html`.

These pages have no ecommerce events to migrate — just strip
`getAnalytics`/`logEvent`/`LW_LOG_EVENT`, add `gtag('config', 'G-00DMH9PYCG')`, keep
Performance. (Bonus: this also stops Firebase's automatic page_view/Enhanced
Measurement from double-counting page views against gtag's automatic page_view on
these pages — broader than just the checkout issue.)

### 4. Tests — `tests/cart.e2e.spec.js`

- Three tests stub `window.LW_LOG_EVENT` directly (lines 563, 579, 595 — `add_to_cart`,
  `view_cart`, `remove_from_cart`). Since `LW_LOG_EVENT` no longer exists, rewrite
  these to stub `window.gtag` instead (same pattern as the existing two gtag tests at
  616/637) and update assertions to the new `items[]` schema, e.g.
  `params.items[0].item_name` instead of `params.item_name`.
- The two existing gtag-stubbing tests (`add_to_cart` at 616, `begin_checkout` at 637)
  need no changes — those code paths are untouched.
- `tests/cart.unit.test.js` / `tests/build-shop.unit.test.js` have no references to
  touch.

### 5. Rebuild + verify

- `npm run build-shop` to regenerate all `shop/**/index.html` from the updated
  generator.
- `npm test` (vitest unit + Playwright e2e) — must pass with the rewritten analytics
  tests.
- Manual spot check via the `serve` skill: open a product page and the cart drawer in
  a browser, stub `window.gtag` in devtools console, walk through view_item →
  add_to_cart → view_cart → remove_from_cart → begin_checkout → wishlist toggle, and
  confirm exactly one `gtag('event', ...)` call per action with the correct
  `items[]` payload, and that `window.LW_LOG_EVENT` no longer exists anywhere.
- Confirm `firebase-performance.js` still loads in the network tab (Performance kept)
  and `firebase-analytics.js` no longer does.
- Real GA4 DebugView confirmation requires a deploy to `www.layerweaver.com` (the
  hostname gate) — call this out as a follow-up after merge, not part of local
  verification.
