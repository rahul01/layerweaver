# Free Gift Cart Integration - FREEGIFT299

> **Status: Retired.** This feature was removed as part of the 6-month campaign
> revert (commit `209c6513`, 2026-07-02) - see `.ai/plans/6-month-campaign.md`.
> Kept here for historical reference only; nothing below reflects the current
> `shop/cart.js`.

## Overview
Automatically add a free Cat Cable Clip to the cart and apply the `FREEGIFT299` discount code when the cart subtotal reaches ₹299. The discount is configured in Shopify Admin - the frontend needs to handle adding the gift item and applying/removing the code.

## Key Principle
Shopify won't auto-add the gift. The frontend must:
1. Add the Cat Cable Clip to the cart
2. Apply the discount code to make it free at checkout

---

## Implementation Steps

### 1. Detect the cart threshold
Watch the cart subtotal in `shop/cart.js`. When it reaches ₹299, trigger the code application.
- **Only the auto-added gift line (tagged `_gift`) is excluded from the threshold calculation.** User-added Cat Cable Clips count normally.
- Calculate qualifying subtotal: total cart amount minus only the `_gift`-tagged line item's price
- The gift progress bar already tracks this via `FREE_GIFT_MIN = 299` - update it to use the qualifying subtotal
- Hook into `renderShippingBar()` (now the gift bar renderer) which runs after every cart update

### 2. Apply the discount code via Storefront API
Use the `cartDiscountCodesUpdate` mutation:

```graphql
mutation {
  cartDiscountCodesUpdate(cartId: "gid://shopify/Cart/xxx", discountCodes: ["FREEGIFT299"]) {
    cart {
      discountCodes {
        code
        applicable
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### 3. Add the gift to cart
The discount only applies if the Cat Cable Clip is in the cart. When the threshold is hit, add the product using `cartLinesAdd`.
- Need the Cat Cable Clip's variant GID (fetch from product or hardcode)
- Use the existing `addLine()` function in cart.js
- Mark the line with a custom attribute (e.g. `_gift: true`) so it can be identified for removal

### 4. Handle the applicable flag
Check `discountCodes[].applicable` in the cart response:
- If `false`: the code didn't apply (gift not in cart, already used, or conditions not met)
- Show an appropriate message or silently skip
- Retry after adding the gift item if needed

### 5. Remove if cart drops below ₹299
If the subtotal falls back below the threshold:
- Remove the discount code by calling `cartDiscountCodesUpdate` with an empty array `[]`
- Remove the gift line item from the cart
- Use the `_gift` attribute to identify which line to remove

---

## Assumptions
- Gift item (Cat Cable Clip) will never go out of stock during the campaign
- One gift per order regardless of cart total
- Discount code is single-use per customer (enforced by Shopify)
- Gift is only free via the discount code - without the code it shows at regular price

---

## Implementation Notes

### Files to modify
- `shop/cart.js` - Add discount code and gift item logic

### Discount code
- Code: `FREEGIFT299`
- Configured in Shopify Admin as a discount that makes the Cat Cable Clip free

### User manually adds Cat Cable Clip - 4 scenarios

**Important: Never modify what the user added. The free gift is always a separate auto-added line. User-added Cat Cable Clips are regular purchases that count towards the ₹299 threshold. Only the auto-added gift line (tagged `_gift`) is excluded from the qualifying subtotal.**

**1. Below threshold, user adds Cat Cable Clip**
User adds Cat Cable Clip at regular price (e.g. ₹99). This counts towards the ₹299 threshold like any other product. No gift added yet. If the cart later reaches ₹299 (by adding other items, or the clip itself pushing it over), we auto-add a SECOND Cat Cable Clip tagged with `_gift` and apply the discount code. User keeps their paid clip, gets an additional free one.

**2. Above threshold, user adds Cat Cable Clip**
Cart is already >= ₹299 and a free gift clip (`_gift` tagged) is already in the cart. User adds another clip manually. Now there are 2 clips: one free (auto-added), one paid (user's). Both stay. The user's clip is never touched.

**3. Threshold reached by adding Cat Cable Clip**
User adds a Cat Cable Clip and that pushes the cart total to >= ₹299. The clip's price counts towards the threshold. We auto-add a SECOND clip tagged `_gift` and apply the discount code. User has their paid clip + one free gift clip.

**4. Threshold reached when Cat Cable Clip is already in cart**
User added a clip earlier (below threshold, at regular price). Later adds other items pushing the total to >= ₹299. We auto-add a SECOND clip tagged `_gift` and apply the code. User keeps their paid clip, gets an additional free one.

**Key rules:**
- Never modify or convert what the user added into a free item
- The free gift is always a separate auto-added line with `_gift` attribute
- User-added Cat Cable Clips count towards the ₹299 threshold like any other product
- Only the `_gift`-tagged line is excluded from the qualifying subtotal
- When removing the gift (cart drops below ₹299), only remove the `_gift`-tagged line

### Other edge cases
- User manually removes the auto-added gift (don't re-add aggressively, respect the removal)
- Multiple tabs open (cart state syncs via localStorage cart ID)
- Discount code already used by this customer (check `applicable` flag, show message if false)

### Gift line identification
Tag the auto-added gift line with a custom attribute so it can be distinguished from a user-added Cat Cable Clip:
```js
attributes: [{ key: '_gift', value: 'FREEGIFT299' }]
```

### Qualifying total calculation
**Critical:** Calculate by summing non-gift line prices directly, NOT by subtracting from `cart.cost.totalAmount`. Shopify's total already reflects the discount code deduction, so subtracting the gift price again causes a double-subtraction bug that makes the cart oscillate between adding and removing the gift.

```js
function getQualifyingTotal() {
    let sum = 0;
    for (const edge of cart.lines.edges) {
        const line = edge.node;
        const isGift = line.attributes?.some(a => a.key === '_gift' && a.value === 'FREEGIFT299');
        if (!isGift) sum += parseFloat(line.merchandise.price.amount) * line.quantity;
    }
    return sum;
}
```

### Architecture
- **`reconcileGift()`** - async function with `_giftBusy` lock. Checks qualifying total, adds/removes gift and discount code as needed. If it makes changes, re-renders once.
- **Every cart handler** (add, remove, update) does its mutation, renders immediately, then calls `reconcileGift()` fire-and-forget.
- **`renderShippingBar()`** is pure UI - no side effects, no gift sync calls.
- **Init** does an inline awaited gift reconciliation before the first render.
- **Cart total display** uses `getQualifyingTotal()` so the gift's price is never shown.

### Order of operations when threshold is reached
1. Add Cat Cable Clip to cart (with `_gift` attribute)
2. Apply `FREEGIFT299` discount code
3. `reconcileGift` re-renders cart with gift line showing "FREE"

### Order of operations when dropping below threshold
1. Remove the `_gift`-tagged line item
2. Remove discount code (empty array)
3. `reconcileGift` re-renders cart without gift line

### Shopify setup
- Discount code `FREEGIFT299` configured in Shopify Admin
- Required creating an "all-products" collection in Shopify for the discount conditions
- The `all-products` collection is hidden from the site via `HIDDEN_COLLECTIONS` in `build-shop.js`
- Cat Cable Clip variant GID: `gid://shopify/ProductVariant/48173905576158`
