# LayerWeaver — SEO & Sales Performance

*Site & Commerce Audit*

A pass over layerweaver.com's technical SEO and the connected Shopify store's traffic and sales data, looking for what's actually limiting revenue right now versus what's already working.

| | |
|---|---|
| **Site** | www.layerweaver.com |
| **Store** | LayerWeaver.com · Basic plan · INR |
| **Window** | last 30–60 days |
| **Run** | 2026-07-20 |
| **Fixes** | 6/6 shipped 2026-07-20 |

## At a glance

| Metric | Value | |
|---|---:|---|
| Sessions (30d) | 399 | ~13/day, 84% mobile |
| Orders (30d) | 89 | ₹51,685 total sales |
| Avg. order value | ₹472 | on tracked sessions |
| Reached checkout | 57.6% | 230 of 399 sessions |
| Completed checkout | 17.8% | 71 of 399 sessions |
| Returning customers | 5.8% | 5 of 90, last 60d |

## All 6 code fixes shipped — 2026-07-20

77/77 tests passing (43 unit, 34 E2E).

| Fix | Commit |
|---|---|
| Collection-page meta-description escaping bug — now runs through the same `escAttr()` + truncation as product pages | `1e1bfd65` |
| Full-size product images — Shopify CDN `width=` params added at all 9 render sites; JSON-LD image array left full-res | `e891d974` |
| Sitemap missing `<lastmod>` — added to all 50 product/collection URLs, driven off Shopify's `updatedAt` | `0dce3053` |
| Render-blocking Font Awesome — switched to the standard preload-then-swap pattern | `203611aa` |
| GA4 blind to cart activity — `add_to_cart` / `begin_checkout` gtag events added alongside the existing Meta Pixel calls | `16dcb8ea` |
| Order attribution lost at checkout handoff — first-touch UTM/referrer capture (30-day window) now attaches to the Shopify cart as order attributes | `01fbf39d` |

**The short version:** the on-page SEO fundamentals here are unusually solid for a small store — proper structured data, clean canonicals, full sitemap coverage, real 404s. That's not where the risk is. The risk is unresized product images hitting a mobile-heavy audience, GA4 missing standard cart/checkout events that Meta Pixel already tracks fine, and order attribution getting lost at the handoff to Shopify's checkout domain. Traffic volume — not conversion — is the real ceiling on revenue: 13 sessions a day, and once a one-day visibility campaign is separated out from ordinary sales traffic, the underlying sales funnel converts well. All six code fixes below have since shipped — findings are left in their original form for the audit trail, with a shipped note appended to each.

---

## 1. Traffic & Funnel — sessions are the ceiling, not conversion

399 sessions over 30 days is the entire top of the funnel — everything downstream is working with a small number to begin with. Within that, checkout completion (once someone reaches checkout) is a healthy ~31%.

### Daily sessions vs. sessions that reached checkout (Jun 20 – Jul 20)

| Date | Sessions | Reached checkout |
|---|---:|---:|
| Jun 20 | 1 | 0 |
| Jun 21 | 1 | 1 |
| Jun 22 | 2 | 2 |
| Jun 23 | 111 | 3 |
| Jun 24 | 10 | 6 |
| Jun 25 | 11 | 11 |
| Jun 26 | 0 | 0 |
| Jun 27 | 12 | 12 |
| Jun 28 | 18 | 15 |
| Jun 29 | 22 | 19 |
| Jun 30 | 25 | 21 |
| Jul 1 | 15 | 15 |
| Jul 2 | 31 | 30 |
| Jul 3 | 22 | 17 |
| Jul 4 | 15 | 12 |
| Jul 5 | 22 | 15 |
| Jul 6 | 6 | 6 |
| Jul 7 | 2 | 0 |
| Jul 8 | 2 | 0 |
| Jul 9 | 3 | 0 |
| Jul 10 | 2 | 1 |
| Jul 11 | 1 | 0 |
| Jul 12 | 3 | 1 |
| Jul 13 | 6 | 5 |
| Jul 14 | 1 | 1 |
| Jul 15 | 3 | 1 |
| Jul 16 | 16 | 12 |
| Jul 17 | 12 | 7 |
| Jul 18 | 12 | 8 |
| Jul 19 | 10 | 8 |
| Jul 20 | 2 | 1 |

### 30-day funnel

| Stage | Sessions | % of top |
|---|---:|---:|
| Sessions | 399 | 100% |
| Reached checkout | 230 | 57.6% |
| Completed checkout | 71 | 17.8% |

### Read this in context: one day was a visibility campaign, not a sales one

Jun 23 had 111 sessions in a single day (vs. a 2–30/day baseline) as part of a deliberate brand-visibility push, not a sales campaign — so 3 sessions reaching checkout and zero completing is exactly what awareness traffic looks like, not a conversion failure. The catch: that one day sits inside the same 30-day funnel as everything else, and it drags the headline numbers down.

**Strip it out** and the remaining 29 days (288 sessions) reached checkout at **78.8%** and completed at **24.7%** of sessions — a materially stronger funnel than the blended 57.6% / 17.8% above. Two follow-ups worth considering: track visibility campaigns on their own metric (reach, session count) rather than folding them into the sales funnel view, and build a retargeting audience from that day's visitors — exposure without a purchase is exactly what retargeting is for.

---

## 2. Sales Performance — revenue concentrates in a handful of products

₹51,685 across 89 orders in 30 days, ₹472 average order value. The top few products carry most of the revenue, and the picture is cleaner than the raw numbers first suggest — most of what looks like a data or margin issue turns out to be a known campaign or a shipping incident.

### Gross sales by product, last 30 days (top 9 of active products)

| Product | Gross sales |
|---|---:|
| Ghost balloon lamp | ₹13,095 |
| Custom builds (no listing)* | ₹9,825 |
| Dino box (pen holder) | ₹6,252 |
| Octopus table lamp | ₹5,420 |
| Cat cable clip | ₹4,634 |
| T-rex skeleton | ₹4,386 |
| Snail lamp | ₹2,032 |
| Monstera coaster set | ₹1,440 |
| Night Dragon | ₹1,353 |

\* 11 orders, ₹9,825 gross — custom on-request builds, entered as line items without a standard catalog product attached, consistent with the "Order on WhatsApp" custom-quote flow already on the site. Currently the #2 revenue line. Optionally worth giving these a descriptive name (e.g. "Custom Build – [description]") in Shopify so sales reports read clearly — no change to how they're fulfilled.

### Was: Critical → Fixed — you can't see which marketing channel drives orders

Across the last 60 days, 89 of 90 orders show a blank or generic `layerweaver` referrer — real source data (Instagram, Google, ads, direct) isn't reaching Shopify's attribution. That means ad spend or organic effort can't be evaluated by channel.

Root cause: clicks to WhatsApp and Instagram from the site are already tracked fine — a generic click tracker in `script.js` logs those to GA4. The actual leak is at checkout: shoppers browse `www.layerweaver.com`, but the "Checkout" button in `cart.js` sends them to a Shopify-hosted checkout URL on a *different domain*, via a plain link with no referrer or UTM data carried across. Whatever channel brought someone to the marketing site is invisible to Shopify by the time they check out.

**Shipped:** a top-level IIFE in `script.js` now captures UTM params / referrer / landing page into `localStorage` on first touch, with a 30-day window — a later visit with different campaign params doesn't overwrite the original source. `cart.js`'s `createCart()` attaches this as `CartInput.attributes` on the same mutation that already fires on first add-to-cart, so it shows up on the order itself in Shopify admin. Verified end-to-end with a headless Playwright run and covered by 4 new E2E tests.

### Context — the two biggest net/gross gaps are explained, not margin leaks

Net sales fall well short of gross on a few products. Both of the largest gaps turn out to be intentional or operational, not pricing bugs:

| Product | Orders | Gross | Net | Why |
|---|---:|---:|---:|---|
| Cat cable clip | 45 | ₹4,634 | ₹382 | Free gift-with-purchase on orders over ₹299, part of the ongoing 6-month campaign — working as intended |
| Octopus table lamp | 3 | ₹5,420 | ₹3,862 | One unit broke in shipping and was refunded — a return, not a discount |
| Decorative vases | 2 | ₹1,185 | ₹592 | Still unexplained, but only 2 orders — low stakes |

Nothing urgent to fix here. Two light optional follow-ups: since the Octopus Table Lamp is both fragile and one of the higher-revenue items, worth a quick check that its packaging protects it well in transit; and Decorative Vases is small enough (2 orders) that it's only worth a look if curious, not a priority.

### Note — returning-customer rate is low, but expected this early

5.8% (5 of 90 customers, last 60 days) return for a second order. Normal for a young store still building its first-time customer base — worth revisiting with a post-purchase WhatsApp or email flow once monthly order volume climbs.

---

## 3. Technical SEO & Tracking — the fundamentals are genuinely strong

LocalBusiness and Product structured data, correct canonicals, a sitemap that matches every real page 1:1, unique meta descriptions, real alt text, proper 404s and www/https redirects — this is better-built than most small-business Shopify sites. The findings below are refinements, not repairs, except where flagged.

### Was: Critical → Fixed — product images are served full-size to an 84%-mobile audience

Product photos are pulled from Shopify's CDN at their original size — sampled at **1254×1254px, ~1.2MB per PNG** — with no resize parameter. The shop grid alone (`shop/index.html`) loads **92** of these. Only one code path in `scripts/build-shop.js` (an internal, non-public tool page) appends a CDN width parameter; the product gallery, shop-grid, and homepage-carousel images don't. (Layout shift itself is already handled — `shop.css` reserves image box sizes via `aspect-ratio`/fixed dimensions before load. The cost here is pure payload weight and slower LCP, not CLS.)

**Shipped:** a `resizedImageUrl()` helper appends Shopify's `&width=` CDN param at all 9 render sites — grid thumbnail (500px), gallery rail (300px), main image (900px), collage banner + hero carousel (800px), and all three `og:image` tags (1200px). The JSON-LD structured-data image array was deliberately left at full resolution, per Google's rich-result guidance — it isn't rendered, so it costs no page weight.

### Was: Fix soon → Fixed — GA4 doesn't receive standard cart/checkout events

The Meta Pixel is wired correctly — `fbq('track','AddToCart', ...)` and `fbq('track','InitiateCheckout', ...)` both fire on every add-to-cart and checkout click. But no `gtag('event','add_to_cart', ...)` or `gtag('event','begin_checkout', ...)` exists anywhere in the codebase, even though `gtag` is loaded on every page. GA4's own ecommerce reports, and any Google Ads audience or conversion action built on GA4 events, are currently blind to cart activity. (Separately, Shopify's own session dashboard shows "cart additions" as 0 on every day — that's expected, not a bug: this storefront adds to cart via direct Storefront-API calls rather than Shopify's native `/cart` endpoints, which is what that particular metric is wired to, and it isn't worth rebuilding the cart on a stock theme just to populate one dashboard number.)

**Shipped:** `gtag('event', 'add_to_cart', ...)` and `gtag('event', 'begin_checkout', ...)` now fire in `cart.js` alongside the existing Meta Pixel calls, reusing the same item/price data already computed at each call site. Covered by 2 new E2E tests intercepting the live `gtag` calls.

### Was: Fix soon → Fixed — product meta descriptions can end on an awkward stray word

There's already a `truncateWords()` helper in `build-shop.js` that cuts product descriptions at 160 characters on a word boundary — it isn't broken. But it only trims trailing punctuation, not trailing filler words, so a cut can land right after a stray word like "…or as a…", which reads oddly in a search snippet even though it's technically not mid-word.

**Shipped:** `truncateWords()` now strips a trailing connector word (a/an/the/or/and/to/in/of/for) in a loop — handling chained cases like "…gift for a" — and the budget dropped 160 → 150 to leave room for the trim. Unit tested for the word-safe cut, single- and chained-stopword stripping, and trailing punctuation.

### Was: Critical → Fixed — collection-page meta descriptions have an unescaped-HTML bug

Product-page descriptions correctly run through both truncation and HTML-escaping before being written into `<meta content="...">`. Collection pages skip both — the raw Shopify collection description is written directly into the tag. A description containing a `"` or `<`/`>` character would break the attribute or inject markup into `<head>`. It hasn't caused visible damage yet only because none of the current 7 collection descriptions happen to contain those characters.

**Shipped:** collection descriptions now run through the same `escAttr()` + `truncateWords()` helper product pages already used — a one-line change, as expected. Verified post-build: every collection `<meta>` description is escaped and well under the 150-char budget.

### Was: Fix soon → Fixed — two small, cheap Core Web Vitals wins

The full Font Awesome icon set loads render-blocking from cdnjs on every page for what's likely a handful of icons. `sitemap.xml` has no `<lastmod>` on any of its 61 URLs, so Google has no signal for which of the 43 product pages changed most recently.

**Shipped:** Font Awesome now loads via `rel="preload"` with an `onload` swap to `stylesheet` (plus a `<noscript>` fallback), applied through one shared helper used by both page templates that reference it. `updatedAt` was added to both GraphQL queries and flows straight into `<lastmod>` for all 50 product/collection URLs; the 11 static, non-Shopify-backed URLs intentionally stay bare rather than getting stamped with a false "today" freshness signal.

### Working well — structured data, crawlability, and coverage are all clean

LocalBusiness schema on the homepage; Product + AggregateRating + BreadcrumbList schema on all 43 product pages; canonical tags and Open Graph tags present site-wide; sitemap's 43 products and 7 collections match the live folders exactly; non-www and http both 301 to `https://www.`; unknown URLs return a real `404`; every sampled image carries alt text; lazy-loading is applied consistently.

---

## 4. Priority Order — what to fix first

Ranked by revenue impact against effort. Everything here is a build-script or tracking-config change, not a redesign — and a few things that looked like problems on the surface turned out not to need any fix at all. Six of the seven items below have since shipped; only the optional Shopify-admin naming task remains open.

1. **Fix the collection-page meta-description escaping bug** — *Shipped* · `1e1bfd65`
   A real correctness bug (unescaped HTML in a meta tag) sitting one line away from the fix product pages already use — smallest, safest change to ship first.
2. **Resize product images in `build-shop.js` via Shopify CDN width params** — *Shipped* · `e891d974`
   Directly improves mobile load speed for 84% of traffic — the single biggest performance lever on the site.
3. **Capture first-touch referrer/UTM data and attach it to the Shopify cart** — *Shipped* · `01fbf39d`
   The real fix for invisible attribution — outbound WhatsApp/Instagram clicks are already tracked; the gap is the handoff to Shopify's checkout domain.
4. **Add GA4 (`gtag`) `add_to_cart` / `begin_checkout` events in `cart.js`** — *Shipped* · `16dcb8ea`
   Meta Pixel already tracks these correctly — GA4 is the one destination currently blind to cart activity, which also limits Google Ads audience-building.
5. **Tighten product meta-description truncation to avoid stray trailing words** — *Shipped* · `1e1bfd65`
   Cosmetic SERP-snippet fix, small effort.
6. **Optional: name custom-build line items descriptively in Shopify** — *Open, manual, admin-side*
   These are legitimate on-request builds, not a data error — naming them just makes sales reports easier to read. Not a code change, so outside this round of fixes.
7. **Add `<lastmod>` to sitemap.xml and make Font Awesome non-render-blocking** — *Shipped* · `0dce3053` + `203611aa`
   Low effort, incremental crawl and speed gains.

---

*Audit based on live site inspection (layerweaver.com), the repository's build output, Shopify analytics for LayerWeaver.com (last 30–60 days, ending 2026-07-20), and business context on the cat-cable-clip gift-with-purchase campaign, the Jun 23 visibility push, and the Octopus Table Lamp shipping return. Session-funnel and referrer figures come from Shopify's own session tracking and may undercount orders placed manually (e.g. via WhatsApp) outside a tracked storefront session.*

**Update, 2026-07-20:** all six code fixes above shipped same-day as individual commits, each rebuilt and verified before the next landed. Test coverage added afterward (commits `99590a46`, `5ecc0909`) — 77/77 tests passing (43 unit, 34 Playwright E2E) across all six fixes.
