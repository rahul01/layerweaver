# Instagram feed on layerweaver.com

Our own version of the Instafeed Shopify app: recent @thelayerweaver posts as a strip on the
homepage and the shop page, each tile linking to its product where we have one. No app fee, no
third-party script on the page.

Written Oct 24, 2026. **Build after the freeze: Nov 9, with the Diwali cleanup.**

## Why

- Social proof from real photos, next to the Judge.me reviews we already show.
- Where the traffic is (GA4, last 30 days to Oct 23): homepage 4,204 views (#2 page), `/shop/`
  3,016. The gallery got 476 (about 1.4% of views), almost all from the site menu - so the
  gallery stays as it is and the feed goes where people are.

## Decisions taken

| Question | Decision | Why |
|---|---|---|
| Replace the gallery? | No | Curated services portfolio for custom/corporate buyers; a date-ordered feed can't filter by service |
| Put it in the homepage hero? | Not by default - first section below the hero | Hero links all lead into the shop; Instagram tiles are mixed quality and many link off-site. Revisit with the hero data (below) |
| Shop page | Strip below the product grid, above the footer | Products stay first on phones (ad traffic) |
| Tile links | Mapped post -> product page; unmapped -> the Instagram post, new tab | Keep people on the site where we can |

**Hero data check, ~Nov 7:** `hero_click` events (live since Oct 24, commit `75dd7aa25`) per hero
part vs homepage views. If the carousel is barely tapped, consider swapping it for hand-picked
Instagram slides. If it's used, the feed stays below the hero.

## How it works

### 1. Fetch at build time - `scripts/build-instagram.js`

- Called from `build-shop.js` (one build, one workflow), but in its own file so it can also run
  alone: `node scripts/build-instagram.js`.
- Instagram API with Instagram Login: `GET graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp`,
  token in the `Authorization` header (never the URL). Latest 12 posts.
- Media types: IMAGE uses `media_url`; VIDEO (reels) uses `thumbnail_url`; CAROUSEL_ALBUM uses
  the cover `media_url`.
- Writes `shop/instagram.json`: `{ builtAt, tokenRefreshedAt, posts: [{ id, shortcode, image, alt, permalink, product }] }`.
- Pure parts (pick posts, apply the product map, render the strip HTML) go in
  `scripts/build-instagram-utils.js` with vitest tests, like `build-shop-utils.js`.

### 2. Save the images to the site

- Instagram's image URLs expire after a few days [Certain], so download each to
  `images/instagram/<id>.webp` and delete files no longer in the feed.
- Resize to 480px wide with ImageMagick on the runner (12 full-size photos would be ~3MB on the
  homepage). [Likely] ImageMagick is on GitHub's ubuntu runners - check in step 1; if not,
  add an `apt-get install` step. No npm packages - the build stays Node built-ins only.
- Locally (`npm run build-shop`) use `sips` on the Mac, or skip resizing with a warning.

### 3. Post -> product map - `scripts/instagram-products.json`

```json
{ "DAbc123xyz": "ghost-balloon-lamp", "DAdef456uvw": "snail-lamp" }
```

- Key = the post's shortcode (the part after `/p/` or `/reel/` in its link), so it's easy to
  fill in by hand. A handle that doesn't exist in Shopify is a build warning, not a failure.
- Alt text = the product's title when mapped, else the caption's first line (trimmed).

### 4. Token renewal

- Long-lived token, 60 days, renewable after it is 24h old [Certain]. It lives in the repo secret
  `INSTAGRAM_TOKEN`.
- Each rebuild renews it and writes the new one back with `gh secret set` (needs a second secret,
  `SECRETS_PAT`: fine-grained, this repo only, Secrets read/write). `gh` handles the encryption.
- If no rebuild happens for 60 days the token dies. The dashboard warns first: it already reads
  the site's `shop/reviews-built.json` (`lib/review-sync.js`), so it reads
  `shop/instagram.json` the same way and shows a Today row at 45 days, linking to More > Tools >
  Website (rebuild). Dashboard change, separate commit there.

### 5. When it updates

- Every "Rebuild site" press (the dashboard already triggers these for new reviews) picks up new
  posts. **No schedule** - `rebuild-shop.yml` is manual-only on purpose (site CLAUDE.md).
  See open question 1.

### 6. If Instagram fails

- Keep the last `shop/instagram.json` and images, print a warning, carry on. Unlike Judge.me
  (`REQUIRE_REVIEWS`), a missing feed must never stop products and reviews from publishing.
- Fewer than 4 posts (or none) -> the strip isn't rendered at all.

### 7. Page changes

- **Homepage** (`index.html`): new `<section class="instagram-strip">` between the hero and
  `#testimonials`, filled between `<!-- INSTAGRAM-STRIP-START -->` / `-END -->` markers like the
  hero and testimonials.
- **Shop** (`generateShopIndex()` in `build-shop.js`): the same strip after `.shop-products`.
- Layout: one row, sideways swipe with scroll-snap on phones, 6 visible on desktop. Tiles are
  square, `loading="lazy"`, width/height set (no layout shift). Mapped tiles carry a small
  "Shop this" label. Last tile: "Follow @thelayerweaver".
- Heading: "Seen on Instagram". No material jargon in captions or alt text (customer copy
  rules).
- Tracking: add `.instagram-strip` -> `instagram_strip` to `getClickSection()` in `script.js`,
  and send `instagram_tile_click` with `link_url` / `link_text` (`product: <handle>` or
  `instagram`) - same reason as `hero_click`: GA4 built-in parameters, no custom dimensions needed.

### 8. Workflow changes - `.github/workflows/rebuild-shop.yml`

- Pass `INSTAGRAM_TOKEN` and `SECRETS_PAT` to the build step; renew the secret after.
- Add `images/instagram` to the `git add` list.
- Dashboard `routes/site-rebuild.js` depends on the workflow's step names - update it if a step
  is renamed.

## Build steps (each: tests green, check both widths, commit)

| # | Step | Done when |
|---|---|---|
| 0 | **Rahul, manual:** confirm @thelayerweaver is a Business/Creator account; Meta app with Instagram Login, own account as tester; generate a long-lived token; add `INSTAGRAM_TOKEN` and `SECRETS_PAT` repo secrets | Token returns posts from `/me/media` |
| 1 | `build-instagram.js` + utils + tests; fetch, map, download, resize, write JSON | Local run writes 12 images under 60KB each and a valid `instagram.json` |
| 2 | Strip HTML/CSS on the homepage and shop page, tracking event | Looks right at 400px and desktop; e2e test checks tiles and the click event |
| 3 | Workflow: token renewal, image commit | A manual Actions run publishes the strip and the secret's "updated" date changes |
| 4 | Dashboard: Today row for token age | Row appears in a test with `tokenRefreshedAt` 46 days ago |
| 5 | Fill `instagram-products.json` for current posts | Most tiles link to products |

About half a day for steps 1-4.

## Open questions for Rahul

1. **Freshness:** new posts show up only on the next rebuild. Enough, or add a weekly schedule to
   the workflow? It's manual-only on purpose, and the reason isn't written down - recommend
   leaving it manual unless you know why it was.
2. **Unmapped posts:** show them (link to Instagram), or show only posts mapped to a product?
   Recommend show all - "only mapped" may leave too few tiles.
3. **Hero:** settled by the ~Nov 7 `hero_click` check above.
