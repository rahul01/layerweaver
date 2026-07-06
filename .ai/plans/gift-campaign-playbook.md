# Gift-with-Purchase Campaign Playbook (generic)

A reusable, product-agnostic reference for launching or retiring *any* future
threshold-based gift-with-purchase promotion (e.g. "free gift on orders above
₹X"), extracted from what the `FREEGIFT299` campaign (Cat Cable Clip, ₹299
threshold) got right and wrong. See `.ai/plans/free-gift-cart-integration.md`
for that specific implementation's full history; this doc is the pattern to
reuse for whatever gift comes next.

## Core principles

- **Shopify won't auto-add a gift.** The frontend must add the gift line item
  *and* apply a discount code that zeroes its price - both steps, every time.
- **Tag the auto-added line** with a custom cart attribute (e.g.
  `{ key: '_gift', value: '<DISCOUNT_CODE>' }`) so it can be distinguished
  from an identical product the customer bought themselves. Never touch what
  the user added - the free gift is always a separate, additional line.
- **Qualifying total = sum of non-gift line prices, computed directly.**
  Never subtract the gift price from Shopify's `cart.cost.totalAmount` -
  Shopify's total already reflects the discount deduction, so subtracting
  again causes a double-subtraction bug where the cart oscillates between
  adding and removing the gift.
- **Reconciliation architecture:** one async function (e.g. `reconcileGift()`)
  guarded by a busy-lock flag, called fire-and-forget after every cart
  mutation (add/remove/update). Keep UI rendering pure and side-effect-free -
  it should never itself decide to add/remove the gift.
- **Legacy-cleanup routines must check every condition independently.** If a
  cleanup pass exists for carts that outlive the campaign, check the leftover
  discount code and the leftover tagged line as two separate conditions, not
  one as a side effect of finding the other - otherwise a cart with just the
  code (no line) or just the line (no code) never gets cleaned up.
- **Parameterize, don't hardcode.** Gift variant GID, discount code, and
  threshold amount should be named constants at the top of the file, so
  swapping to a different product/threshold later is a one-line change per
  constant, not a rewrite.
- **No debug logging in the reconciliation path.** It runs on every cart
  interaction for every visitor - a stray `console.log` becomes permanent
  production noise.

## Launch checklist

- [ ] Decide the gift product, its variant GID, and the qualifying threshold
- [ ] Create the Shopify discount code that makes the gift product free
  - [ ] If the discount needs collection-scoping, create the supporting
    collection and add it to `HIDDEN_COLLECTIONS` in `build-shop.js` so it
    doesn't show up as a real collection on the site
- [ ] Add constants to `shop/cart.js`: gift variant GID, discount code,
  threshold, gift display name
- [ ] Implement `getQualifyingTotal()` (sum non-gift lines, cache invalidated
  on cart-reference change - see the memoization pattern in the current
  `shop/cart.js` for a template)
- [ ] Implement `getGiftLine()` (find the tagged line)
- [ ] Implement `reconcileGift()` (busy-lock, add-or-remove gift + discount
  code based on qualifying total, called after every cart mutation)
- [ ] Add progress bar UI, confetti on threshold-crossing (one-shot per
  session via a `sessionStorage` flag), and a cart-icon indicator if desired
- [ ] Update trust strip / announcement / shipping-policy / FAQ copy if the
  threshold overlaps with existing shipping messaging - check for duplicated
  copy in structured-data (JSON-LD) blocks, not just visible text
- [ ] Write unit tests for the qualifying-total calculation and e2e tests for:
  add/remove across the threshold, multi-tab cart sync, and the "user
  manually adds the gift product" scenarios (below threshold, above
  threshold, threshold reached by the gift item itself, threshold reached
  after the gift item was already in cart at regular price) - in every case
  the user's paid item stays untouched and a *second*, separate gift line
  gets added
- [ ] Confirm no debug logging shipped in the reconciliation path

## Retirement checklist

- [ ] Remove the reconciliation logic and associated UI (progress bar,
  confetti trigger, cart-icon indicator)
- [ ] Add a one-time legacy-cleanup pass for carts created during the
  campaign, checking the leftover discount code and leftover tagged line as
  independent conditions
- [ ] Deactivate the Shopify discount code
- [ ] Remove or hide the supporting collection (and remove it from
  `HIDDEN_COLLECTIONS` if deleted)
- [ ] Confirm the gift product itself is left untouched and still sellable
- [ ] Update tests to remove gift-specific coverage and restore whatever
  coverage it had replaced (e.g. a shipping progress bar)
- [ ] Revert announcement/trust-strip/shipping-policy/FAQ copy, including any
  duplicated structured-data (JSON-LD) blocks

## Known gotchas (learned the hard way)

- **Double-subtraction bug:** computing qualifying total by subtracting the
  gift price from Shopify's total causes add/remove oscillation. Always sum
  non-gift lines directly instead.
- **Independent-condition cleanup bug:** a legacy-cleanup routine that only
  clears a leftover discount code as a side effect of finding the tagged line
  will leave a code-only leftover stuck forever. Check both conditions on
  their own.
- **Reactivation via `git revert` is time-limited, not guaranteed.**
  Reverting a sunset commit to bring a campaign back only stays a clean,
  conflict-free two-command job if nothing else has touched the same files in
  between. It worked with zero conflicts once because the reactivation
  happened the same day as the sunset. Weeks or months later, expect other
  unrelated commits (rebuilds, content edits) to have touched the same
  generated pages, causing merge conflicts on a naive revert-of-revert.
  Budget time to hand-apply this playbook's pattern again instead of assuming
  a quick git-level toggle will work.
