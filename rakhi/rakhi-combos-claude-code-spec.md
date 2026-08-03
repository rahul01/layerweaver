# Rakhi Combos — Claude Code Implementation Spec
## LayerWeaver Headless Shopify Site (Vanilla JS + HTML)

---

## Context

- **Site type:** Headless Shopify storefront, vanilla JS + HTML (no framework)
- **Backend:** Shopify Storefront API (GraphQL, `2024-01` or latest stable version)
- **Goal:** Build a Rakshabandhan Combos page (`/rakhi-combos.html` or a section embeddable into an existing page) that displays curated product bundles, shows combined pricing, and lets users add all items in a combo to the Shopify cart in one click.
- **Tone:** Festive but clean. Not over-decorated. LayerWeaver's existing purple brand color is `#A083D5`.

---

## What to Build

### 1. Combo Page / Section

A responsive grid of combo cards. Each card shows:
- Combo name + tagline
- Product thumbnails (2–4 items, pulled from Storefront API by handle)
- Individual item names and prices
- **Total combo price** (sum of all items)
- **"Add All to Cart"** button — adds every item in the combo as separate line items to the Shopify cart
- A subtle "Free shipping above ₹299" nudge where relevant

### 2. Cart Integration

Use the Shopify Storefront API Cart mutations to add items. If a cart already exists (stored in `localStorage` as `cartId`), add to it. Otherwise create a new cart.

**Create cart mutation:**
```graphql
mutation cartCreate($lines: [CartLineInput!]!) {
  cartCreate(input: { lines: $lines }) {
    cart {
      id
      checkoutUrl
    }
  }
}
```

**Add to existing cart:**
```graphql
mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      id
      checkoutUrl
    }
  }
}
```

Each `CartLineInput` needs a `merchandiseId` (variant GID) and `quantity: 1`.

**To get variant IDs by product handle**, use:
```graphql
query getProduct($handle: String!) {
  product(handle: $handle) {
    title
    featuredImage { url }
    variants(first: 1) {
      edges {
        node {
          id
          price { amount }
        }
      }
    }
  }
}
```

After cart creation/update, redirect to `cart.checkoutUrl` OR update a cart drawer if one exists.

---

## Storefront API Setup

```js
const SHOPIFY_DOMAIN = 'your-store.myshopify.com'; // replace
const STOREFRONT_TOKEN = 'your-public-storefront-token'; // replace
const API_URL = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;

async function shopifyFetch(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
```

---

## Combo Data

All product handles are derived from the LayerWeaver Shopify store. Prices are as listed on the site (INR). For products with variants (e.g. color options), default to the first/cheapest variant.

```js
const RAKHI_COMBOS = [
  {
    id: 'gamer-brother',
    name: 'The Gamer Brother',
    tagline: 'Desk toys he\'ll actually use',
    totalPrice: 797,
    badge: null,
    products: [
      { handle: 'wasd-mechanical-keycap-keychain', name: 'WASD Keycap Keychain', price: 349 },
      { handle: 'single-key-keyboard', name: 'Single Key Keyboard Clicker', price: 199 },
      { handle: 'cupcake-clicker-one-piece', name: 'Cupcake Clicker', price: 249 },
    ],
  },
  {
    id: 'bookworm-sister',
    name: 'The Bookworm Sister',
    tagline: 'She reads. Now she does it in style.',
    totalPrice: 347,
    badge: 'Free Shipping',
    products: [
      { handle: 'butterfly-bookmark', name: 'Butterfly Bookmark', price: 149 },
      { handle: 'cat-bookmark', name: 'Cat Bookmark', price: 99 },
      { handle: 'monstera-keychain', name: 'Monstera Keychain', price: 99 },
    ],
  },
  {
    id: 'aesthetic-sister',
    name: 'The Aesthetic Sister',
    tagline: 'Lights, flowers, and tiny joys',
    totalPrice: 647,
    badge: null,
    products: [
      { handle: 'ghost-balloon-lamp', name: 'Ghost Balloon Lamp', price: 399 },
      { handle: 'tulip-single-flower', name: 'Tulip Single Flower', price: 149 },
      { handle: 'bunny-keychain', name: 'Bunny Keychain', price: 99 },
    ],
  },
  {
    id: 'desk-setup-bro',
    name: 'The Desk Setup Bro',
    tagline: 'Practical + fun. The rare combo.',
    totalPrice: 847,
    badge: null,
    products: [
      { handle: 'hoodie-pen-pot', name: 'Hoodie Pen Pot', price: 549 },
      { handle: 'cat-cable-clip', name: 'Cat Cable Clip', price: 99 },
      { handle: 'infinity-cube', name: 'Infinity Cube', price: 199 },
    ],
  },
  {
    id: 'kid-sibling',
    name: 'The Kid Sibling',
    tagline: 'Four things to obsess over',
    totalPrice: 946,
    badge: null,
    products: [
      { handle: 'articulated-octopus', name: 'Articulated Octopus', price: 249 },
      { handle: 't-rex-skeleton', name: 'T-rex Skeleton', price: 249 },
      { handle: 'articulated-cute-spider', name: 'Articulated Cute Spider', price: 249 },
      { handle: 'cone-fidget', name: 'Cone Fidget', price: 199 },
    ],
  },
  {
    id: 'personalized',
    name: 'Made For You',
    tagline: 'Because generic is lazy',
    totalPrice: 1197,
    badge: 'Best Seller',
    products: [
      { handle: 'sweeping-sign-nameplate', name: 'Sweeping Sign Nameplate', price: 899 },
      { handle: 'custom-name-keyring', name: 'Custom Name Keyring', price: 149 },
      { handle: 'personalized-number-plate-keychain', name: 'Number Plate Keychain', price: 149 },
    ],
  },
  {
    id: 'music-quirky',
    name: 'The Weird One (Affectionate)',
    tagline: 'For the sibling who marches to their own beat',
    totalPrice: 447,
    badge: null,
    products: [
      { handle: 'bird-ocarina', name: 'Bird Ocarina', price: 199 },
      { handle: 'coffee-mug-clicker-one-piece-red-or-white-mug', name: 'Coffee Mug Clicker Keychain', price: 199 },
      { handle: 'butterfly-bookmark', name: 'Butterfly Bookmark', price: 149 },
    ],
  },
  {
    id: 'plant-parent',
    name: 'The Plant Parent Sister',
    tagline: 'She has 47 plants. She needs this.',
    totalPrice: 2147,
    badge: 'Premium',
    products: [
      { handle: 'monstera-coaster-set', name: 'Monstera Coaster Set', price: 1899 },
      { handle: 'tulip-single-flower', name: 'Tulip Single Flower', price: 149 },
      { handle: 'monstera-keychain', name: 'Monstera Keychain', price: 99 },
    ],
  },
  {
    id: 'car-guy',
    name: 'The Car Guy Brother',
    tagline: 'Niche. He\'ll get it.',
    totalPrice: 997,
    badge: null,
    products: [
      { handle: 'die-cast-car-garage-key-hanger', name: 'Car Garage Key Hanger', price: 499 },
      { handle: 'personalized-number-plate-keychain', name: 'Number Plate Keychain', price: 149 },
      { handle: 'wasd-mechanical-keycap-keychain', name: 'WASD Keycap Keychain', price: 349 },
    ],
  },
  {
    id: 'fidget-collector',
    name: 'The Fidget Collector',
    tagline: 'One for every meeting they zone out in',
    totalPrice: 846,
    badge: null,
    products: [
      { handle: 'cone-fidget', name: 'Cone Fidget', price: 199 },
      { handle: 'infinity-cube', name: 'Infinity Cube', price: 199 },
      { handle: 'single-key-keyboard', name: 'Single Key Keyboard Clicker', price: 199 },
      { handle: 'cupcake-clicker-one-piece', name: 'Cupcake Clicker', price: 249 },
    ],
  },
  {
    id: 'wfh-sister',
    name: 'The WFH Sister',
    tagline: 'Desk upgrade she wouldn\'t buy herself',
    totalPrice: 1997,
    badge: null,
    products: [
      { handle: 'cactus-headphone-stand', name: 'Cactus Headphone Stand', price: 1699 },
      { handle: 'coffee-mug-clicker-one-piece-red-or-white-mug', name: 'Coffee Mug Clicker Keychain', price: 199 },
      { handle: 'cat-cable-clip', name: 'Cat Cable Clip', price: 99 },
    ],
  },
  {
    id: 'tiny-budget',
    name: 'Tiny Budget, Big Feels',
    tagline: 'Crosses ₹299 for free shipping. Still thoughtful.',
    totalPrice: 327,
    badge: 'Free Shipping',
    products: [
      { handle: 'tree-articulated-legs', name: 'Tree Articulated Legs', price: 129 },
      { handle: 'bunny-keychain', name: 'Bunny Keychain', price: 99 },
      { handle: 'cat-bookmark', name: 'Cat Bookmark', price: 99 },
    ],
  },
  {
    id: 'lip-balm-and-name',
    name: 'Little Things, Her Name',
    tagline: 'Something for her lips, something with her name',
    totalPrice: 448,
    badge: 'Free Shipping',
    products: [
      { handle: 'lip-balm-holder-keychain', name: 'Lip Balm Holder Keychain', price: 299 },
      { handle: 'custom-name-keyring', name: 'Custom Name Keyring', price: 149 },
    ],
  },
];
```

---

## Page Structure (HTML)

```
/rakhi-combos.html
  ├── Hero banner (festive headline + subtext)
  ├── Filter tabs (optional): All | Under ₹500 | Under ₹1000 | Premium
  ├── Combo grid (CSS grid, 2-col on desktop, 1-col on mobile)
  │     └── ComboCard × N
  └── Sticky bottom bar on mobile: "X items added to cart → Checkout"
```

### ComboCard structure:
```html
<div class="combo-card" data-combo-id="gamer-brother">
  <div class="combo-badge">Free Shipping</div>       <!-- if badge exists -->
  <h3 class="combo-name">The Gamer Brother</h3>
  <p class="combo-tagline">Desk toys he'll actually use</p>
  <div class="combo-products">
    <div class="combo-product">
      <img src="..." alt="WASD Keycap Keychain" />
      <span class="product-name">WASD Keycap Keychain</span>
      <span class="product-price">₹349</span>
    </div>
    <!-- repeat for each product -->
  </div>
  <div class="combo-footer">
    <span class="combo-total">Total: ₹797</span>
    <button class="btn-add-combo" data-combo-id="gamer-brother">
      Add All to Cart
    </button>
  </div>
</div>
```

---

## JavaScript Behaviour

### On page load:
1. For each combo, fetch product images + variant IDs from Storefront API using the handles in `RAKHI_COMBOS`.
2. Render combo cards with real images from Shopify.
3. Cache results in `sessionStorage` to avoid repeat API calls.

### On "Add All to Cart":
1. Collect all `merchandiseId`s for the combo.
2. Check `localStorage` for existing `cartId`.
3. Call `cartCreate` (new) or `cartLinesAdd` (existing).
4. Store returned `cartId` in `localStorage`.
5. Show success state on button ("Added! → View Cart") with a link to `checkoutUrl`.
6. Do NOT hard-redirect — let user continue browsing combos.

### Loading state:
- While fetching product data on load, show skeleton cards (grey placeholder boxes).
- While adding to cart, show spinner on the button and disable it to prevent double-clicks.

---

## Styling Notes

- Brand purple: `#A083D5`
- Use CSS custom properties for theming so it matches the rest of the site.
- Combo cards: white background, subtle box-shadow, 12px border-radius.
- Badge pill: brand purple background, white text.
- "Add All to Cart" button: solid brand purple, white text, hover darkens 10%.
- Mobile: full-width cards, stacked layout. Thumbnail images in a horizontal scroll strip if 4 products.
- Font: match whatever the existing site uses (likely system font or Google Font already loaded).

---

## Personalized Products Note

Three combos include products that require personalization input (custom name, number plate text):
- `sweeping-sign-nameplate`
- `custom-name-keyring`
- `personalized-number-plate-keychain`

For these, the "Add All to Cart" button should instead link directly to the product page on Shopify (or open a modal) so the user can enter their personalization text before adding. Flag these combos with a note: `"Includes personalized items — you'll enter details at checkout."`

---

## Deliverables Expected from Claude Code

1. `rakhi-combos.html` — standalone page with embedded CSS and JS (single file, no build step needed)
2. Alternatively: `rakhi-combos-section.js` + `rakhi-combos-section.css` if the combos need to be injected into an existing page layout
3. Replace `SHOPIFY_DOMAIN` and `STOREFRONT_TOKEN` with placeholder comments for the developer to fill in
4. All combo data should live in a single `RAKHI_COMBOS` const at the top of the JS — easy to update

---

## Out of Scope (don't build)

- A/B testing
- Combo discount codes (can be added later via Shopify discount API)
- Backend/serverless functions — keep it fully client-side
- Analytics events (can be wired in later)
