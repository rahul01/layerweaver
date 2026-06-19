# 6-Month Celebration Campaign - Change Summary

## Campaign Overview
- **Occasion:** 6 months of LayerWeaver
- **Dates:** 20 June - 1 July 2026
- **Offers:** Free shipping sitewide (no minimum) + Free Cat Cable Clip on orders above ₹299
- **Scope:** All pages across layerweaver.com
- **Commits:** 562e5ee, 3e9ad42, 52ac59a4, 453a9889

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
- **New item:** "Free Cat Cable Clip on ₹200+" added to marquee (orange #e67e22)

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
- **Trust strip:** "Free Shipping on All Orders" + "Free Cat Cable Clip on ₹200+" in marquee

---

## How to Revert (End of Campaign)

1. **Remove announcement bar HTML** from all pages (or remove `body.has-announcement` class)
2. **Revert `FREE_SHIPPING_MIN`** to `500` in `shop/cart.js`
3. **Remove gift progress** (`FREE_GIFT_MIN`, `FREE_GIFT_NAME`, gift bar HTML/CSS/JS) from `shop/cart.js` and `shop/shop.css`
4. **Revert shipping policy** and **FAQ** text to standard rates
5. **Revert trust strip** text to "Free Shipping Above ₹500", remove gift item
6. **Revert `.btn-primary`** color from yellow back to purple in `styles.css`
7. **Remove** `.cart-free-shipping-banner` from cart drawer
8. **Remove** `.fab-shop` HTML from `index.html` and CSS from `styles.css`
9. **Remove** logo `::after` sticker, `.announcement-bar` styles, and `@keyframes announcement-marquee` from `styles.css`
10. **Revert `scripts/build-shop.js`** - remove `announcementBarHtml()`, move trust strip back outside header, revert text
11. **Run `npm run build-shop`** to regenerate all shop pages
12. **Revert OG meta** on shop page

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
