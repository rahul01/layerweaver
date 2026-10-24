# Instagram feed on layerweaver.com

Our own version of the Instafeed Shopify app: recent @thelayerweaver posts, plus customer posts
that tag us (only with the customer's OK), as a strip on the homepage and the shop page. Each
tile links to its product where we have one. No app fee, no third-party script on the page.

Written Oct 24, 2026 (tagged posts added the same day). **Build after the freeze: Nov 9, with
the Diwali cleanup.**

## Why

- Social proof from real photos, next to the Judge.me reviews we already show. Customer photos
  are the strongest part of it.
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
| Posts that tag us | Yes, **approved ones only** - never automatic | They're the customer's photos: showing them without asking is a copyright problem and the thing customers complain about |
| Stories that tag us | No | Gone after 24h, no API list of past ones; the only route is catching each one live from a webhook, with the same permission problem. Team habit instead: reply asking them to share the photo |

**Hero data check, ~Nov 7:** `hero_click` events (live since Oct 24, commit `75dd7aa25`) per hero
part vs homepage views. If the carousel is barely tapped, consider swapping it for hand-picked
Instagram slides. If it's used, the feed stays below the hero.

## How it works

### 1. Fetch at build time - `scripts/build-instagram.js`

- Called from `build-shop.js` (one build, one workflow), but in its own file so it can also run
  alone: `node scripts/build-instagram.js`.
- **Instagram API with Facebook Login** (`graph.facebook.com`), not the Instagram Login version:
  only this one has the tagged-posts list [Likely]. Needs @thelayerweaver as a Business account
  connected to the LayerWeaver Facebook Page. Token in the `Authorization` header, never the URL.
- Two sources:
  - Our posts: `GET /{ig-user-id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` - latest 12.
  - Posts that tag us: `GET /{ig-user-id}/tags?fields=id,username,caption,media_type,media_url,permalink,timestamp`.
    [Likely] Public accounts only, photo tags only (a caption @mention alone isn't in it).
    Confirm the fields come back in step 1.
- Media types: IMAGE uses `media_url`; VIDEO (reels) uses `thumbnail_url`; CAROUSEL_ALBUM uses
  the cover `media_url`.
- Writes `shop/instagram.json`: `{ builtAt, fetchOk, posts: [{ id, shortcode, source: "ours" | "customer", username, image, alt, permalink, product }] }`.
- Pure parts (pick and mix posts, apply the product map and approvals, render the strip HTML) go
  in `scripts/build-instagram-utils.js` with vitest tests, like `build-shop-utils.js`.

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
  fill in by hand. Works for our posts and approved customer posts. A handle that doesn't exist
  in Shopify is a build warning, not a failure.
- Alt text = the product's title when mapped, else the caption's first line (trimmed).

### 4. Customer posts: ask, then approve - `scripts/instagram-approved.json`

```json
{ "DXyz789abc": { "username": "priya.makes", "approvedOn": "2026-11-12", "by": "rahul" } }
```

- The build shows a customer post **only if its shortcode is in this file and the post is still
  in Instagram's tagged list**. If the customer deletes the post, untags us or goes private, it
  drops off the site on the next build - no action needed.
- Flow: a new tag appears in the dashboard -> someone DMs the customer (dashboard copies the
  message: "Hi! We love your photo of the snail lamp. Can we show it on layerweaver.com, with
  credit to you?") -> on a yes, Approve in the dashboard -> the next rebuild shows it.
  Keep the DM: it's the record of their OK.
- Customer tiles say "From @username" (credit, and it shows they're real customers).

### 5. Dashboard: "Tagged posts" (LayerWeaverDashboard, separate commits)

- More > Tools > **Instagram**: new tagged posts not yet decided, newest first - thumbnail,
  username, date, link to the post, "Copy message", and **Asked** / **Approve** / **Skip**.
  Asked and Skip are stored in `instagram-tags.local.json` on the VPS so the same post doesn't
  keep coming back.
- Today row: "N new tagged posts" when there are undecided ones, linking to that panel (calls to
  action rule).
- **Approve** writes the shortcode into `scripts/instagram-approved.json` in the site repo
  (GitHub contents API) and starts a rebuild. That needs **Contents: write** added to
  `GITHUB_SITE_TOKEN` (today: Actions read/write + Pages read). See open question 3.
- The dashboard fetches `/tags` itself, so the VPS `.env` also gets the Instagram token.
- Admin-only routes (`requireRole('admin')`), like the other Tools panels.

### 6. Token

- A **System User token** from Meta Business Manager, the same kind as `META_ACCESS_TOKEN` for
  ads: it doesn't expire [Likely], so no renewal job. Permissions: `instagram_basic`,
  `pages_read_engagement`, `pages_show_list` (and whatever `/tags` asks for in step 1 [Guessing]
  `instagram_manage_comments`). Assets: the LayerWeaver Page and Instagram account.
- Lives in the site repo secret `INSTAGRAM_TOKEN` and the VPS `.env`.
- Tokens still die if someone changes a password or removes the app, so the build writes
  `fetchOk`; the dashboard reads `shop/instagram.json` like it reads `reviews-built.json`
  (`lib/review-sync.js`) and shows a Today row when the last build couldn't fetch.

### 7. When it updates

- Every "Rebuild site" press (the dashboard already triggers these for new reviews, and Approve
  triggers one) picks up new posts. **No schedule** - `rebuild-shop.yml` is manual-only on
  purpose (site CLAUDE.md). See open question 1.

### 8. If Instagram fails

- Keep the last `shop/instagram.json` and images, print a warning, carry on. Unlike Judge.me
  (`REQUIRE_REVIEWS`), a missing feed must never stop products and reviews from publishing.
  Exception: customer posts are re-checked against the tagged list on every successful build;
  if the fetch fails, the last good list stays.
- Fewer than 4 posts (or none) -> the strip isn't rendered at all.

### 9. Page changes

- **Homepage** (`index.html`): new `<section class="instagram-strip">` between the hero and
  `#testimonials`, filled between `<!-- INSTAGRAM-STRIP-START -->` / `-END -->` markers like the
  hero and testimonials.
- **Shop** (`generateShopIndex()` in `build-shop.js`): the same strip after `.shop-products`.
- Mix: 12 tiles by date, approved customer posts and ours together (open question 4).
- Layout: one row, sideways swipe with scroll-snap on phones, 6 visible on desktop. Tiles are
  square, `loading="lazy"`, width/height set (no layout shift). Mapped tiles carry a small
  "Shop this" label; customer tiles "From @username". Last tile: "Follow @thelayerweaver".
- Heading: "Seen on Instagram". No material jargon in captions or alt text (customer copy
  rules).
- Tracking: add `.instagram-strip` -> `instagram_strip` to `getClickSection()` in `script.js`,
  and send `instagram_tile_click` with `link_url` / `link_text` (`ours: product <handle>`,
  `customer: instagram`, ...) - same reason as `hero_click`: GA4 built-in parameters, no custom
  dimensions needed.

### 10. Workflow changes - `.github/workflows/rebuild-shop.yml`

- Pass `INSTAGRAM_TOKEN` to the build step.
- Add `images/instagram` to the `git add` list.
- Dashboard `routes/site-rebuild.js` depends on the workflow's step names - update it if a step
  is renamed.

## Build steps (each: tests green, check both widths, commit)

| # | Step | Done when |
|---|---|---|
| 0 | **Rahul, manual:** @thelayerweaver is a Business account linked to the LayerWeaver Facebook Page; Meta app (Facebook Login, Instagram API) added to Business Manager; System User token with the permissions above; `INSTAGRAM_TOKEN` repo secret + VPS `.env` | Token returns our posts from `/media` and tagged posts from `/tags` |
| 1 | `build-instagram.js` + utils + tests: our posts, fetch, map, download, resize, write JSON | Local run writes 12 images under 60KB each and a valid `instagram.json` |
| 2 | Strip HTML/CSS on the homepage and shop page, tracking event | Looks right at 400px and desktop; e2e test checks tiles and the click event |
| 3 | Workflow: token, image commit | A manual Actions run publishes the strip |
| 4 | Customer posts in the build: `/tags`, `instagram-approved.json`, drop-off when untagged/deleted, "From @username" tiles | Tests: unapproved never shown, approved-then-deleted disappears |
| 5 | Dashboard: Tools > Instagram panel (list, copy message, Asked/Skip), Today rows (new tags, fetch failed) | Panel lists real tagged posts; Skip keeps one gone after reload |
| 6 | Dashboard: Approve -> commit to the site repo + rebuild | Approved post is live after the rebuild |
| 7 | Fill `instagram-products.json` for current posts | Most tiles link to products |

About a day for steps 1-6 (half a day for our posts, half for customer posts and the dashboard).

## Open questions for Rahul

1. **Freshness:** new posts show up only on the next rebuild. Enough, or add a weekly schedule to
   the workflow? It's manual-only on purpose, and the reason isn't written down - recommend
   leaving it manual unless you know why it was.
2. **Unmapped posts:** show them (link to Instagram), or show only posts mapped to a product?
   Recommend show all - "only mapped" may leave too few tiles.
3. **Approve from the dashboard** needs `GITHUB_SITE_TOKEN` to gain Contents write on the site
   repo, so a stolen VPS token could change the site. The VPS already holds Shopify admin access,
   which is worse, so recommend yes. The alternative is editing `instagram-approved.json` by hand
   (or asking Claude) and pressing Rebuild.
4. **Tile mix:** by date (recommended, simplest), or customer posts first?
5. **Hero:** settled by the ~Nov 7 `hero_click` check above.
