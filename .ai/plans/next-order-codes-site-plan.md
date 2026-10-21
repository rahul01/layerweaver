# Next-order codes - main site plan (layerweaver repo)

Written Oct 21, 2026 (moved here from the dashboard repo the same day). Built in its own session,
independent of the dashboard build. Dashboard plan and business decision live in the dashboard repo:
`/Users/rahul/StudioProjects/LayerWeaverDashboard/.ai/opus plans/next-order-codes-dashboard-plan.md`
and `diwali-2026-plan.md` in the same folder (Oct 21 next-order offer entries).

Before the first edit: read that repo's memory
(`~/.claude/projects/-Users-rahul-StudioProjects-layerweaver/memory/MEMORY.md`). Commit, but
**never push without Rahul saying "push" in that turn**. No em dashes. www.layerweaver.com links only.
Storefront change during the Oct 13-30 freeze: Rahul approves the wording and the push.

Status Oct 21: plan written; wording below needs Rahul's OK before building. The dashboard side
(email block, code creation, WhatsApp) went live Oct 21, so the site lines can go live whenever
Rahul approves them.

## Why

Without site messaging, customers only learn of the offer after paying (email + WhatsApp). The site
lines make it a reason to add one more item now.

## The offer (must match the dashboard exactly)

- Orders placed **Oct 22 - Nov 1, 2026** (IST).
- Order value = products **after discounts, before shipping, gift cards left out**.
  - ₹599+ -> ₹50 off the next order; ₹999+ -> ₹100 off.
- Code: next order of ₹399+, once, works at once, till Dec 15. Sent by email and WhatsApp right
  after the order.
- The site promises nothing the dashboard won't give: if the cart says "unlocked", the order must
  qualify. So the cart counts the value the same way (see below).

## What to build

### 1. Cart progress (shop/cart.js, the existing rewards progress bar)
- `REWARD_TIERS` today is free shipping only (₹299). Add the two offer tiers, shown only while
  `istToday()` is between `2026-10-22` and `2026-11-01` (constants at the top, like
  `ORDER_BY_DIWALI`):
  - below ₹599: "Add ₹X more to get ₹50 off your next order"
  - ₹599 - ₹998: "₹50 off your next order unlocked - add ₹X more for ₹100"
  - ₹999+: "₹100 off your next order unlocked 🪔 - we'll send the code after you order"
- Value: **after discounts**, gift cards out. `cartSubtotal()` sums pre-discount line prices and
  skips only non-shipping lines (gift cards). For this tier use the lines' discounted cost
  (`line.cost.totalAmount`, or subtract `cart.discountAllocations`) so an applied code can't make
  the cart claim a tier the order won't get. Keep free shipping on its existing calculation.
- Where several cart messages show (free shipping, Diwali order-by pincode), keep the cart tidy:
  free shipping first, the next-order line second; one line each on phones.
- Mirror the pure logic in `shop/cart-utils.js` with a test, like `shippingProgress()`.

### 2. Shop banner (shop/index.html, near the gift card banner)
- One slim banner, shown Oct 22 - Nov 1 only (hide by date in JS, not by hand):
  "🪔 Spend ₹599, get ₹50 off your next order. Spend ₹999, get ₹100 off. Sent to your email and WhatsApp."
- Diwali look: reuse the `seasonal--diwali` / gift card banner styles; no new colours.
- From Nov 2 the gift card banner stays as the only offer (per the Diwali plan).

### 3. Product pages (optional - ask Rahul)
- A small line under the price on products ₹599+: "Get ₹50 off your next order with this." Skip
  unless Rahul wants it; product pages are generated (`scripts/build-shop.js`), so it is a build
  change, more than the two items above.

## Wording rules
- Brand voice (dashboard `public/brand.html`): short, concrete, no fake urgency, no em dashes,
  no "premium/curated", no material jargon. Real dates only.
- Say "next order", "₹399 or more", "till 15 Dec" consistently with the email and WhatsApp.

## Checks before asking to push
- Local server (`http://localhost:8080`, per the repo memory), desktop and phone width.
- Cart at ₹598 / ₹599 / ₹998 / ₹999, with and without a discount code applied, with a gift card.
- Date switch: fake `istToday()` to Oct 21, Oct 22, Nov 1, Nov 2 - lines appear and disappear.
- Tests green; commit; ask Rahul to push. Go live together with or after the dashboard go-live
  (the site must not promise codes before the email/WhatsApp are live; they went live Oct 21) - check
  with Rahul.

## After Nov 1
- The lines hide themselves by date. Remove the code in the Nov 9 cleanup.
