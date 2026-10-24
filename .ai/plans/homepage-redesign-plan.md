# Homepage redesign plan

Drafted 2026-10-24. Status: approved by Rahul 2026-10-24 (decisions at the end), nothing built yet.

## Handoff - read this first (new session)

- **Repo:** `/Users/rahul/StudioProjects/layerweaver` (the storefront, GitHub Pages from `main`). Read its `CLAUDE.md` and its memory index first. The ops dashboard lives separately at `../LayerWeaverDashboard`.
- **Commands:**
  - `npm run build-shop`: regenerates the marked regions of `index.html`, plus `shop/` and `sitemap.xml`. Needs `JUDGEME_API_TOKEN` in `.env`. Uses Node built-ins only, so don't add npm dependencies to the build.
  - `npm run serve`: http://localhost:8080. Open pages there, not as `file://`.
  - `npm run test:unit` (vitest) and `npm run test:e2e` (Playwright). `npm test` runs both.
- **How the homepage is built:** `index.html` is hand-written, apart from regions between `<!-- X-START -->` / `<!-- X-END -->` markers that `build-shop.js` replaces (hero header, hero left, carousel slides and dots, rating badge, testimonials; see around lines 2327-2360). New generated sections follow the same pattern. Anything outside the markers is edited by hand.
- **Rules:**
  - One phase at a time: say which files change and how, Rahul approves, build with tests, run tests green, commit.
  - **Never push without an explicit OK.** The dashboard's "Rebuild shop" robot also commits to `main`, so pull before pushing.
  - No em dashes anywhere; use hyphens.
  - Customer-facing copy uses no internal terms (say "rest of India", never "far states") and no material jargon (no "PLA", no "plastic").
  - Product copy is short, punchy and concrete.
  - Links use `www.layerweaver.com` (the apex cert fails).
  - Don't hide reviews.
- **Seasonal timing:** Diwali is Sun Nov 8. The Nov 9 cleanup sets `HERO_FESTIVE = null` and removes the announcement bar and the Diwali touches. Build the hero so it works both ways: festive config on, and the evergreen version. The delivery line only shows while `ORDER_BY` has a festival ahead, so for later seasons (Rakhi, Christmas) you just update `ORDER_BY`.
- **Doc map:** the "Decisions" section at the end is final. Don't re-ask those questions.

## The problem

The homepage (`index.html`) never shows a product with a price. Top to bottom it is:

1. Announcement bar (next-order codes, e-gift card)
2. Hero: 3 link tiles + "Shop Diwali Gifts" button + rating badge | heading + auto-rotating carousel of two 5-image collages (Diwali, Halloween), no prices
3. Testimonials slider (8 store reviews)
4. About: 4 paragraphs of founder story
5. Get in touch: 4 cards (Phone, WhatsApp, Instagram, "Product Catalog", which repeats Shop)
6. Footer ("Affordable 3D Printing Solutions")

A visitor needs at least one tap to learn what we sell and what it costs. 84% of sessions are on phones (Jul 20 audit). On a phone the first screen holds the button, three tiles and the rating badge. The heading and images come below that.

## Who the homepage is for

[Likely] Meta ads land on collection and product pages, so the homepage mostly gets visitors who don't come from ads: the Instagram bio, Google, direct visits, WhatsApp shares and returning customers. In about 5 seconds they need to see:

- what we make and roughly what it costs
- that other people bought it and liked it
- when it will reach them (in festive weeks)
- one tap to a product

Custom orders, workshops and the founder story come after that.

## Phase 0 - measure first (1 day, no code)

Get a baseline so we can tell whether the redesign worked. Use the GA4 web UI (Reports > Engagement > Landing page, and Events > `hero_click`) or Shopify Analytics. Don't loop over the GA4 Data API from local test servers, because they share the live dashboard's quota. Write the numbers into this file under "Baseline".

- GA4 landing pages, last 30 days: homepage sessions as a share of all sessions, engagement rate, and the share that go on to view a product, add to cart or check out.
- GA4 `hero_click` events (already tracked, split by `link_text`: carousel / collection_link / shop_button). This shows whether anyone taps the carousel.
- Shopify orders whose landing page is `/`.

If the homepage gets under about 15% of sessions, do Phase 1 and pause before Phase 2.

## Proposed layout (phone first)

```
Announcement bar            (keep)
Header                      (keep)
1. Hero                     one message, one CTA, delivery promise, trust row
2. Bestsellers              6-8 product cards with price + rating
3. Shop by category         6-8 collection tiles
4. Reviews                  keep slider, add photo strip + product names
5. Made for you             custom-order strip, WhatsApp CTA
6. How it works / why us    3-4 icons: printed to order in Pune, ships in N days, free shipping 299+, easy returns
7. Our story (short)        photo + 2 lines + "Read our story"
8. Workshops (small strip)
Footer                      contact moves here
```

### 1. Hero

- **One season at a time.** The carousel and dual heading ("Light Up Diwali, Spook Up Halloween") go. Use one heading, one supporting line and one image (a strong lifestyle shot, or a 2-up on desktop).
- **Primary CTA:** "Shop Diwali gifts". **Secondary:** "Bestsellers" (jumps to section 2).
- **Delivery line, by zone.** Use the three zones that are already live in the pincode box (`ORDER_BY` + `pincodeZone()` in `shop/cart-utils.js`, Oct 16): Maharashtra Sun Nov 1, metro cities Fri Oct 30, rest of India Mon Oct 26. A small module script on the homepage imports `ORDER_BY` from `/shop/cart-utils.js`, so the dates live in one place, and renders "Order by: Rest of India Mon Oct 26 · Metros Fri Oct 30 · Maharashtra Sun Nov 1". A zone drops off the line once its date has passed. Once all three have passed, the line becomes "Too late to ship? Send an e-gift card". From `ORDER_BY.diwali` onward it is hidden. Optional: a pincode box that reuses `orderByForPincode()`.
- **Trust row** under the CTA: ★ 4.8 (132 reviews) · Free shipping over ₹299 · Made in Pune. (The rating badge already exists, it just moves here.)
- **Evergreen version** (no season): "3D printed gifts and decor, made to order in Pune", CTA "Shop bestsellers". Today the evergreen hero leads with services (On Demand Printing, 3D Design, Workshops). That's a positioning question, see Open questions.
- **Performance:** the hero image loads eagerly with `fetchpriority="high"` and has real alt text. Today all hero images are `loading="lazy"` with alt text like "Diwali".

Code: extend `HERO_FESTIVE` in `scripts/build-shop.js` with `subline`, `image`, `secondaryCta` and `fallback` (e-gift card). Delivery dates come from `ORDER_BY` at runtime, not from this config. Rewrite `heroHeaderHtml` / `heroLeftHtml` into a single `heroHtml`. Drop `heroCarouselSlidesHtml` and the carousel JS in `script.js` (lines ~307-332) once Phase 0 confirms low carousel use.

### 2. Bestsellers

- 8 products on desktop (4x2), 6 on phones (2x3), then "See all products".
- Reuse `productCardHtml()` so price, swatches, rating and sale badges look the same as in the shop.
- **Where the list comes from (decided: automatic):** Storefront `products(sortKey: BEST_SELLING)` [Likely supported on the Storefront API - verify on the first build]. If that sort isn't available, rank by review count from the `reviewsMap` we already build. No hand-picked list. The build rebuilds the list, and the dashboard's "Rebuild shop" button already triggers builds.
- Leave out gift cards, contact-only and custom-price items (`isGiftCard`, `isContactOnly`, `isCustomPrice` already exist).
- In festive weeks, put seasonal products first (from `SEASONAL_THEMES[...].featured`).
- **Add to cart on the cards (decided: whatever sells more, which means yes).** [Likely] One tap to the cart beats a trip through the product page, especially for gift buyers on phones. We can't A/B test at our traffic, so this is a judgement call, not data. `productCardHtml()` already makes the right choice per product: inline add-to-cart for single-variant and colour-swatch items, a link to the product page when variants have their own photos. This means the homepage needs what shop pages have:
  - a cart icon in the header. The homepage header has no cart at all today, so a returning visitor can't see their cart from `/`. `cart.js` injects the icon and the drawer itself into the `<!-- cart.js injects cart icon here -->` placeholder (see `shopHeaderHtml()`, ~line 712), so the homepage header only needs that placeholder.
  - `cart.js` (77 KB, not minified). It works out `SHOP_ROOT` from the URL and falls back to `/shop/` when the page isn't under `/shop/`, so it should work on `/` [Likely - check add-to-cart, the drawer, checkout and the next-order / free-shipping bars on `/` in the e2e test].
  - the card and cart-drawer CSS. `shop.css` is 78 KB, on top of the 60 KB `styles.css`. Measure first. Prefer splitting the listing-card and drawer rules into a file shared by the shop and the homepage over loading all of `shop.css`. Check that `shop.css` and `styles.css` don't clash on shared class names (header, `.btn-primary`).
  - `productCardHtml(product, productsBase)` with `productsBase = 'shop/products/'` from the root.
- Free-shipping progress and next-order code progress come with the cart drawer at no extra work.

New markers in `index.html`: `<!-- HOME-BESTSELLERS-START/END -->`, filled by `build-shop.js` the same way as the hero and testimonials.

### 3. Shop by category

- 6-8 tiles, each with an image, name and "from ₹X". Pull from the live collections, ordered by a `HOME_CATEGORIES` handle list. Suggested: Lamps & Lighting, Keychains & Pocket Charms, Page Pals, Articulated Fidgets, Toys, Games & Desk Buddies, Gifts for Her, Made for You, Bundles.
- The tile image is the first product's image, or a configured featured handle like the hero uses now.
- Phones: a 2-column grid. Don't use a horizontal scroller, because those hide items.
- Markers: `<!-- HOME-CATEGORIES-START/END -->`.

### 4. Reviews

- Keep `testimonialSlidesHtml`.
- Add the photo strip (`reviewPhotoStripHtml` already exists) above the slider. Customer photos of real prints are the strongest proof we have.
- Where a review is tied to a product, show the product name and link it.
- Keep showing all reviews, including mixed ones (no hiding, per the earlier decision).

### 5. Made for you (custom orders)

- Today custom orders are mentioned only in the WhatsApp contact card. Add one strip: "Have an idea? Name keychains, custom lamps, gifts with a photo - we design and print it."
- Buttons: "Chat on WhatsApp" (prefilled message with a `utm_content=home_custom` tag so the dashboard's chat codes pick it up) and "See made-for-you" (collection).
- Show 3 thumbnails of past custom work from `images/gallery/`.

### 6. How it works / why us

Four icons with one line each. Use wording customers understand; no internal terms or material jargon:

- Printed to order in Pune
- Dispatched in 1-2 days
- Free shipping over ₹299
- Easy returns (link to the policy)

### 7. Our story (short)

- Keep the collage photo. Cut the copy to 2 lines ("A family studio in Pune, started with our son Raghav's 3D printer when he was 4. He still checks every new design.") plus a "Read our story" link.
- The full 4 paragraphs move to a new hand-written `/about/` page (copy the head, header and footer from `faq/index.html`; add it to `sitemap.xml` via `STATIC_URLS` in `build-shop.js`, ~line 2384).
- Keep `id="about"` on the short-story section. About 110 pages (generated through `${base}#about` in `build-shop.js` around line 774, plus hand-written pages such as `faq/`, `gallery/`, `workshop/`) link to `/#about`. Those links keep working and land on the short version with its "Read our story" link. Don't rewrite them.

### 8. Workshops

One slim strip: "Hands-on 3D printing workshops for kids and adults in Pune" with a link to `/workshop/`.

### Footer and contact

- Remove the "Get in touch" card grid. Phone, WhatsApp and Instagram go into the footer, which already has the social icons; add the phone number.
- Remove the duplicate "Product Catalog" card.
- Change the tagline from "Affordable 3D Printing Solutions" to "3D printed gifts and decor · Pune, India".

## Bugs to fix along the way

- `apple-touch-icon` points to `images/spider-fevico n.svg`. The filename has a space in it, so the link is broken. iOS also ignores SVG for this, so it needs a 180x180 PNG.
- The shipping policy and FAQ use two tiers: Pune 1-2 business days, rest of India 2-5. The live Diwali cutoffs use three zones (Maharashtra / metro cities / rest of India), worked back from about 3-4 days to metros and 6-8 to far states. The homepage follows `ORDER_BY`. The policy and FAQ say 2-5 days for all of the rest of India, which is quicker than the 6-8 days far states actually take. Bring both onto the three zones with honest day ranges (separate small task).

## Tracking

- Generalise `hero_click` into a `home_click` event with a `section` param (hero / bestsellers / categories / custom / story / workshops) and `link_text`. Keep `hero_click` for one month so the numbers stay comparable.
- Update `tests/hero-tracking.e2e.spec.js` to match.

## Tests

- `tests/build-shop.unit.test.js`:
  - bestseller picker (manual list wins, excludes gift cards, contact-only and custom-price items, seasonal first, falls back cleanly)
  - category tiles (order, "from" price, missing collection skipped)
  - homepage delivery line from `ORDER_BY`: all three zones open, one zone passed (drops off), all passed (e-gift card), on/after Diwali (hidden)
- e2e:
  - the homepage shows at least 6 priced product cards and every card and tile link resolves
  - no horizontal scroll at 375px
  - the hero image is not lazy
  - `home_click` fires with the right section

## Rollout

| Phase | What | Size |
|---|---|---|
| 0 | Baseline from GA4 + Shopify | 1 day, no code |
| 1 | Hero: one message, delivery line, trust row, eager image; touch icon; footer tagline; remove catalog card | small |
| 2 | Bestsellers with inline add-to-cart (shop header + cart drawer on `/`) + Shop by category | medium-large |
| 3 | Made-for-you strip, why-us icons, short story + `/about/` page, workshops strip, contact into footer | medium |
| 4 | Compare 2-4 weeks against the baseline; drop or reorder sections that get no taps | review |

Every phase: `npm test` plus Playwright on desktop and 375px, then commit. Don't push without an explicit OK.

## Baseline

Not measured yet (Phase 0).

## Success measures (homepage landings, compared with Phase 0)

- Share that view a product page: target +50% relative
- Add-to-cart rate from homepage landings
- Engagement rate / bounce
- Orders with landing page `/`

The numbers are small (homepage sessions per day are likely in the tens), so read trends over 2-4 weeks, not days.

## Decisions (Rahul, 2026-10-24)

1. **Positioning:** shop first. Services (on-demand printing, 3D design) and workshops are secondary, so the evergreen hero leads with products, not services.
2. **Bestsellers:** automatic, by sales.
3. **Add to cart:** whatever sells more, so cards get inline add-to-cart and the homepage gets the cart.
4. **Founder story:** cut to 2 lines plus a new `/about/` page.
5. **Delivery dates:** the three zones in `ORDER_BY` (Maharashtra / metro / rest of India).
