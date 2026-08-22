# Return Gift Combos

Product combo collages for return-gift bundles. Each combo folder has the
source `collage.html` (self-contained, editable) and the rendered PNG.

## Combo 1 — Desk Buddy Combo

Folder: `combo-1-desk-buddy/`
Image: `desk-buddy-combo.png` (2400x1800)

| Product | Handle | Price |
|---|---|---|
| Personalized Pencil Topper | `personalized-pencil-topper` | ₹99 |
| Coffee Mug Clicker Keychain | `coffee-mug-clicker-one-piece-red-or-white-mug` | ₹199 |
| Multi Purpose Dino Box (pen holder, toothbrush holder) | `multi-purpose-box-pen-holder-toothbrush-holder` | ₹399 |

**Combo total (individual):** ₹697
**Combo price:** ₹550 (~21% off)

## Combo 2 — Little Things Combo ("Small Charms, Big Feels")

Folder: `combo-2-little-things/`
Image: `small-charms-big-feels.png` (2400x1800)

| Product | Handle | Price |
|---|---|---|
| Butterfly Bookmark | `butterfly-bookmark` | ₹149 |
| Custom Name Keyring | `custom-name-keyring` | ₹149 |
| Lip Balm Holder Keychain | `lip-balm-holder-keychain` | ₹299 |

**Combo total (individual):** ₹597
**Combo price:** ₹520 (~13% off)

## Combo 3 — Desk & Carry Combo ("Pocket Meets Desk")

Folder: `combo-3-desk-and-carry/`
Image: `pocket-meets-desk.png` (2400x1800)

| Product | Handle | Price |
|---|---|---|
| Lip Balm Holder Keychain | `lip-balm-holder-keychain` | ₹299 |
| Custom Name Keyring | `custom-name-keyring` | ₹149 |
| Multi Purpose Dino Box (pen holder, toothbrush holder) | `multi-purpose-box-pen-holder-toothbrush-holder` | ₹399 |

**Combo total (individual):** ₹847
**Combo price:** ₹699 (~17% off)

## Notes

- Product images pulled from each product's canonical `og:image` on the live
  site (`shop/products/<handle>/index.html`), so they'll go stale if those
  products get new hero photos — re-download from the product page if the
  collage needs a refresh.
- Collages are rendered at 1200x900 (2x scale) via Playwright from the
  self-contained `collage.html` in each folder — reopen and rerun through
  Playwright (`chromium.launch()` → `page.screenshot()`) to regenerate after
  edits.
- Brand palette/fonts pulled from `styles.css` (`--primary: #A083D5`,
  `--secondary: #EFCF20`, Science Gothic + Montserrat).
