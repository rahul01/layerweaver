# Task: Trust Improvements

**Problem:** A trust audit identified several gaps that could erode buyer confidence or create
legal exposure before a customer places their first order.

## Progress

### Done — High Priority

- [x] **1. Create Privacy Policy page** (`privacy-policy/index.html`)
- [x] **2. Fix stale copyright year** — `&copy; 2025` → `&copy; 2026` (all pages)
- [x] **3. Add policy links to non-shop page footers** (index, connect, gallery, workshop, policies, services, enroll)
- [x] **4. Add Privacy Policy link to shop footer nav** (via build-shop.js + rebuild)
- [x] **5. Move payment methods note into cart drawer** — removed from footer; always visible in cart even when empty; COD removed
- [x] **6. Update footer tagline** — `for Everyone` → `· Pune, India` (all pages)
- [x] **7. Normalise product title capitalisation** (via toTitleCase in build-shop.js + rebuild)
- [x] **8. Add Back to Shop button on account page** — left of Sign In button
- [x] **9. Add feedback5 and feedback6 to homepage testimonial slider** — converted to webp; slider now shows 6 slides

### To Do — Medium Priority

- [x] **M1. Add meta description + Open Graph tags to non-shop pages**
  - Affected: `index.html`, `gallery/`, `workshop/`, `connect/`, `privacy-policy/`,
    `shipping-policy/`, `return-and-exchange-policy/`, `services/`
  - Shop pages already have these via `headHtml()` in build-shop.js
  - Add `<meta name="description">`, `<meta property="og:title">`, `og:description`,
    og:image, og:url to each page's `<head>`

- [x] **M2. Add robots.txt and sitemap.xml**
  - Neither file exists — crawlers get no guidance
  - `robots.txt`: allow all, point to sitemap
  - `sitemap.xml`: list all canonical URLs (homepage, shop, collections, products, policy pages, gallery, workshop, connect)
  - Can be generated as part of `npm run build-shop` or as a separate script

- [x] **M3. Add social links (Instagram + WhatsApp) to footer**
  - Instagram and WhatsApp are only linked from the Connect page — not discoverable from the shop or other pages
  - Add icon links to `footerHtml()` in build-shop.js and to all manually-written footers
  - Existing handles: `instagram.com/thelayerweaver`, `wa.me/917558783018`

- [x] **M4. Add custom 404 page** (`404.html`)
  - No custom error page; broken links show a raw server error
  - Should have the site header, a friendly message, and a "Go to Shop" / "Go Home" CTA

- [x] **M5. Convert shop trust strip to scrolling marquee**
  - Replaced the static 2-item trust strip below the shop header with a CSS marquee
  - 9 items scroll continuously at 40s/cycle, pausing on hover
  - Items: Free Shipping Above ₹500 · Eco-Friendly & Renewable PLA · 3D Printed in Pune · UPI · Cards · Net Banking · Easy Returns & Exchanges · 3D Printing Workshops for All Ages · Chat with Us on WhatsApp · Customer Reviews · Custom Orders Welcome
  - 7 clickable items link to relevant pages; 2 non-informational items (PLA, payment) are plain grey spans — no pointer, no underline on hover
  - Each icon is individually coloured (blue, green, purple, orange, WhatsApp green, gold, etc.)
  - Defined in `shopTrustStripHtml()` in `build-shop.js`; styles in `shop/shop.css`

### To Do — Low Priority

- [x] **L1. Add LocalBusiness structured data to homepage**
  - Added `@type: LocalBusiness` JSON-LD with name, address (Pune), telephone, url, sameAs (Instagram + WhatsApp)

- [x] **L2. Add breadcrumb navigation on product pages**
  - `Home › Shop › [Collection] › [Product]` breadcrumb added below shop header on all product pages
  - `BreadcrumbList` JSON-LD added to product structured data via `@graph` alongside `Product`
  - Orphan products (not in any collection) fall back to 3-level breadcrumb

- [x] **L3. FAQ page** (`faq/index.html`)
  - Standalone page at `/faq/` with 6 accordion items (PLA material, delivery, custom orders, returns, shipping, workshops)
  - Styled to match policy pages (gradient hero, policy-content layout, whatsapp contact section)
  - `FAQPage` JSON-LD for SEO rich results
  - Anchor IDs on all items (`#material`, `#delivery`, `#custom`, `#returns`, `#shipping`, `#workshops`) with auto-open JS on hash nav
  - FAQ link added to all page footers and sitemap
  - Trust strip "Eco-Friendly & Renewable PLA" item links to `faq/#material`

- [x] **L4. Web app manifest** (`manifest.json`)
  - Created at root; linked from all pages including shop/account (build-shop.js) and manually maintained pages

- [ ] **L5. Show relevant testimonials on product pages and shop listing**
  - Currently all feedback images are generic (no product tag); the homepage slider shows all 6
  - Approach: tag each feedback image with the product(s) it mentions, then surface matched
    testimonials on the relevant product page and collection listing card
  - Implementation options:
    1. **Static map in build-shop.js** — maintain a `TESTIMONIALS` map of
       `{ handle: [feedbackN, ...] }` and inject matched images into the product page template
    2. **Shopify metafields** — store testimonial references on each product in Shopify admin;
       read via Storefront API at build time
  - Option 1 is simpler and doesn't require Shopify changes; start there
  - On product pages: show matched testimonials as a small "What customers say" strip above
    the footer, falling back to the full slider if no match
  - On listing cards: optionally show a star/quote badge if a testimonial exists for that product
  - Prerequisite: **C1** (replace AI renders) — testimonials only add trust if the feedback
    image clearly shows the actual product being reviewed

### To Do — Content / Shopify Admin

These require action in Shopify admin (product handle + image changes), not code.

- [ ] **C1. Replace AI-generated lead images with real product photos**
  - The following products have a ChatGPT or Gemini image as their primary/only photo:
    | Product | Current lead image |
    |---|---|
    | `aquarium-cave` | ChatGPT image |
    | `illuminated-sign-board` | ChatGPT image |
    | `sweeping-sign-nameplate` | ChatGPT image |
    | `tree-articulated-legs` | ChatGPT image |
    | `personalized-number-plate-keychain` | ChatGPT image |
    | `night-dragon` | Gemini generated image |
  - Real photos significantly improve buyer trust vs AI renders

- [ ] **C2. Fix product handle/slug errors in Shopify**
  - `cat-bookmark-copy` → rename to the actual product variant name (e.g. `cat-bookmark-standing`)
    — "copy" is a Shopify duplicate artefact that leaked into the live URL
  - `monsterra-keychain` → rename to `monstera-keychain` (typo; correct plant is "Monstera")
    — inconsistent with `monstera-coaster-set` which is already correct
  - `floating-ghost-lamp-with-balloon-3d-printed-led-tea-light-decor` → shorten
    (e.g. `ghost-balloon-lamp`) — URL is excessively long
  - `vases` → rename to something descriptive (e.g. `decorative-vases`)
  - `panda` → rename to something descriptive (e.g. `panda-figurine`)
  - **Note:** changing a handle changes the URL — set up Shopify URL redirects from old → new
    so existing links and any indexed pages don't 404. After renaming, run `npm run build-shop`
    to regenerate local pages.

## Notes

- Shop pages (shop/index.html, all collections, all products) are **generated** by
  `scripts/build-shop.js`. Footer changes to those pages go in the `footerHtml()` function
  and require a rebuild (`npm run build-shop`).
- Non-shop pages (homepage, gallery, workshop, connect, policy pages, services, enroll) have
  **manually written** footers — edited directly.
- Title casing: `toTitleCase()` added to build-shop.js capitalises the first letter of each
  all-lowercase word. Safe for mixed-case product names (e.g. "3D", "LED", "UNO").
- Payment methods line removed from footer; moved inside the cart drawer (`shop/cart.js`)
  outside `#cart-checkout-section` so it shows even when the cart is empty.
- COD removed from payment text — payment note now reads:
  "UPI · Debit/Credit Cards · Net Banking via Razorpay"
- Account page sign-in block updated: Back to Shop button added to the left of Sign In.
- Footer nav added to `enroll/index.html` and `enroll-adult/index.html`.
- Footer nav CSS moved into `styles.css` (was only in `shop/shop.css`) so non-shop pages
  render the nav correctly.
- `feedback5.png` and `feedback6.png` added to `images/feedback/standard/` and converted
  to webp. Homepage testimonial slider updated from 4 → 6 slides.
- PNG fallback paths for feedback1–4 corrected to point at `images/feedback/standard/`
  (previously pointed at non-existent `images/feedback/` root).
- Meta description + Open Graph tags added to all non-shop pages. OG image uses the gallery
  collage (`images/gallery/standard/20251207_090320-COLLAGE.jpg`). Policy/services pages
  omit `og:image` intentionally.
- `robots.txt` created; `sitemap.xml` with 57 URLs (11 static + 7 collections + 39 products)
  now auto-generated by `build-shop.js` on every rebuild. FAQ page included.
- Instagram + WhatsApp icon links added to every footer (`footer-social` div) — all manual
  pages and `footerHtml()` in build-shop.js. CSS in `styles.css`.
- `404.html` created at root with site header, "Page not found" message, Go to Shop / Go Home
  CTAs, `noindex` meta tag, meta description, and OG tags.
- Trust strip expanded to 10 items (added Instagram follow item); scrolls at 40s/cycle.
  All items with relevant pages are clickable links. Non-clickable items (PLA, payment) are
  grey with no underline on hover. PLA item links to `faq/#material`.
- Cart shipping bubble suppressed on page load — only shows on user-triggered cart changes
  (`_cartReady` flag in `shop/cart.js`).
- Em dashes removed site-wide (58 files); replaced with hyphens. Never use em dashes.
- `shop/account/index.html`: added manifest, favicon, and theme-color via build-shop.js.
- `shop/collage/index.html`: added manifest link (manually maintained).
- FAQ page styled to match policy pages — uses `.policy-hero` (gradient, 100px top padding
  fixes header overlap), `.policy-content` container, WhatsApp contact card section.

## Verification

1. `http://localhost:8080/privacy-policy/` — renders with header, all sections, footer with policy links.
2. `http://localhost:8080/` — footer shows policy links, "Pune, India" tagline, © 2026. Feedback slider shows 6 slides.
3. `http://localhost:8080/shop/` — footer shows Privacy Policy link; cart drawer shows payment note when empty.
4. `grep -r "&copy; 2025" --include="*.html" .` → zero results.
5. Product titles display with consistent title case on shop grid and product pages.
6. `http://localhost:8080/shop/account/` — Back to Shop button appears left of Sign In.
7. `http://localhost:8080/enroll/` and `/enroll-adult/` — footer nav visible on desktop.

**Estimated Effort:** Small (2–3 hours) — completed
