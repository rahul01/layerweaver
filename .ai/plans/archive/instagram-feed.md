> **Archived Oct 25, 2026.** Vetted against the Oct 25 research and folded into the scaling plan: `/Users/rahul/StudioProjects/LayerWeaverDashboard/.ai/opus plans/scale-30-orders-plan.md`, section 9 ("Storefront work: homepage and Instagram feed"). That section decides what is built, what changed and in which order; where it differs from this file, it wins. Kept here for the build details (files, functions, page markers).

# Instagram feed on layerweaver.com

Our own version of the Instafeed Shopify app: recent @thelayerweaver posts, plus customer posts
that tag us (only with the customer's OK), as a strip on the homepage and the shop page. Each
tile links to its product where we have one. No app fee, no third-party script on the page.

Written Oct 24, 2026 (tagged posts added the same day). **Build after the freeze: Nov 9, with
the Diwali cleanup.**

## Start here (new session)

This file is meant to be enough to build the feature without the conversation that produced it.

**Two repos:**
- Site: `/Users/rahul/StudioProjects/layerweaver` (GitHub `rahul01/layerweaver`, GitHub Pages,
  `main` is live). CommonJS build scripts, vitest + Playwright.
- Dashboard: `/Users/rahul/StudioProjects/LayerWeaverDashboard` (Express, ES modules, vitest).
  Runs on the VPS `ops.layerweaver.com`; the Mac is a read-only standby.

**Read first:** both repos' `CLAUDE.md`; the site's section "Shop build and GitHub Actions";
the dashboard's `deploy/RUNBOOK.md` section "Website rebuild"; the site's Claude memory index
(`~/.claude/projects/-Users-rahul-StudioProjects-layerweaver/memory/MEMORY.md`).

**Rules that apply here:**
- Work one build step at a time: say which files change and how, Rahul approves, build with
  tests, tests green, commit. **Never push either repo without Rahul saying so.**
- Pull before pushing the site: the rebuild robot commits to `main` at any time.
- Before `git add`, check `git diff` - other sessions leave uncommitted edits in the same files.
- No em dashes anywhere (use hyphens). Customer-facing text: short and concrete, no internal
  terms, no material jargon (PLA, plastic).
- Never print, log or commit tokens. Tokens go in headers, never in URLs.
- The site build must stay Node built-ins only (no `npm install` in the workflow).
- Talk to Rahul directly, lead with risks, tag claims [Certain] / [Likely] / [Guessing].

**Status (Oct 24):** nothing of the feed is built. Done so far: `hero_click` tracking (commit
`75dd7aa25`, live) and this plan. Before step 1: Rahul does step 0 and answers the open
questions at the end. If a question is still open, ask him; don't assume the recommendation.

**Check these first (unverified):** the build depends on them, so test each against the real
API with the real token in step 0/1 and fix this plan if one is wrong.
1. `/{ig-user-id}/tags` exists for our account and returns `media_url` (photo) and `username`.
2. Which permissions `/tags` needs (expected: `instagram_basic`, `pages_read_engagement`,
   `pages_show_list`; [Guessing] also `instagram_manage_comments`).
3. A System User token with those permissions doesn't expire.
4. ImageMagick is on GitHub's `ubuntu-latest` runner, and whether it's `convert` (v6) or
   `magick` (v7).

**Test commands:** site `npm test` (vitest `tests/**/*.unit.test.js`, then Playwright e2e
against `npx http-server . -p 8080`); dashboard `npm test`.

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
| API version | Instagram API with **Facebook Login** (`graph.facebook.com`) | Only this one has the tagged-posts list [Likely], and it allows a non-expiring System User token |

**Hero data check, ~Nov 7:** GA4 event `hero_click` (fired by `script.js`, live Oct 24) carries
`link_text` = `<part>: <label>` where part is `carousel` / `collection_link` / `shop_button` /
`rating` / `other`, and `link_url`. Compare taps per part with homepage (`/`) views over the same
days. Query it with the dashboard's GA4 token (`ga4-token.json`, see `routes/analytics.js`;
built-in dimensions `eventName`, `linkText`, `linkUrl`, `pagePath`). If the carousel is barely
tapped, consider swapping it for hand-picked Instagram slides; if it's used, the feed stays
below the hero. Keep the check short: local GA4 queries spend the live dashboard's quota.

## How it works

### 1. Fetch at build time - `scripts/build-instagram.js` (site)

- CommonJS like `build-shop.js`. Exports `async function buildInstagram({ products })` and also
  runs alone (`if (require.main === module)`): `node scripts/build-instagram.js`.
- Called from `main()` in `scripts/build-shop.js` after products are fetched, before the
  homepage is written (around the "Update homepage hero carousel" block), so the strip HTML can
  go into `index.html` in the same pass. `build-shop.js` already loads `.env` itself.
- Graph API `v21.0` (same as the dashboard's Meta code). Token in `Authorization: Bearer`.
- Env: `INSTAGRAM_TOKEN` (secret), `INSTAGRAM_USER_ID` (the Instagram Business account ID, not
  secret). Find the ID once in step 0: `GET /me/accounts?fields=name,instagram_business_account`
  with the token; the `instagram_business_account.id` of the LayerWeaver Page.
- No token -> print a warning, keep the last feed, carry on (same as an API failure, section 8).
- Two sources:
  - Our posts: `GET /{ig-user-id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12`.
  - Posts that tag us: `GET /{ig-user-id}/tags?fields=id,username,caption,media_type,media_url,permalink,timestamp&limit=50`.
    Drop any whose `username` is ours. Skip (with a warning) any without an image URL.
- Media types: IMAGE uses `media_url`; VIDEO (reels) uses `thumbnail_url`; CAROUSEL_ALBUM uses
  the cover `media_url`.
- Shortcode = the path segment after `/p/`, `/reel/` or `/tv/` in `permalink`.

### 2. Save the images to the site

- Instagram's image URLs expire after a few days [Certain], so download each and write
  `images/instagram/<shortcode>.webp`. Delete files in that folder no longer in the feed.
- Resize to 480px wide, quality ~75, with ImageMagick via `child_process.execFileSync`
  (`magick` if present, else `convert`). On the Mac locally: `sips` can't write webp, so fall
  back to `.jpg` via `sips -Z 480`. If neither tool exists, keep the original and warn.
- Target: each image under 60KB.

### 3. Post -> product map - `scripts/instagram-products.json` (site, hand-edited)

```json
{ "DAbc123xyz": "ghost-balloon-lamp", "DAdef456uvw": "snail-lamp" }
```

- Key = shortcode. Works for our posts and approved customer posts. A handle not in the fetched
  Shopify products is a build warning and the tile falls back to the Instagram link.
- Alt text = the product's title when mapped, else the caption's first line (max 100 chars),
  else "Photo from Instagram". All of it through `escAttr()` from `build-shop-utils.js`.

### 4. Customer posts: ask, then approve - `scripts/instagram-approved.json` (site)

```json
{ "DXyz789abc": { "username": "priya.makes", "approvedOn": "2026-11-12", "by": "rahul" } }
```

- Missing file = no customer posts. The build shows a customer post **only if its shortcode is in
  this file and it's in this build's `/tags` response**. Deleted, untagged or gone private -> it
  drops off on the next build, no action needed.
- Flow: a new tag shows in the dashboard -> someone DMs the customer (dashboard copies the
  message) -> on a yes, Approve -> rebuild. The DM is the record of their OK.
- Message to copy (customer copy, editable): "Hi! We love your photo with our [product]. Can we
  show it on layerweaver.com, with credit to you?" Unknown product -> "with our piece".
- Customer tiles say "From @username".

### 5. Output - `shop/instagram.json` (site, committed by the build)

```json
{
  "builtAt": "2026-11-12T10:00:00.000Z",
  "fetchOk": true,
  "posts": [
    { "shortcode": "DAbc123xyz", "source": "ours", "username": "thelayerweaver",
      "image": "/images/instagram/DAbc123xyz.webp", "alt": "Ghost Balloon Lamp",
      "permalink": "https://www.instagram.com/p/DAbc123xyz/", "product": "ghost-balloon-lamp",
      "timestamp": "2026-11-10T08:00:00+0000" }
  ],
  "tagged": [ { "shortcode": "DXyz789abc", "username": "priya.makes", "permalink": "...", "timestamp": "..." } ]
}
```

- `posts` = what the site shows. `tagged` = every post that tags us (approved or not), so the
  dashboard can list new ones without its own Instagram call (see section 6).
- On a failed fetch: keep the previous file's `posts` and `tagged`, set `fetchOk: false` and
  `builtAt` to now.

### 6. Dashboard: "Instagram" panel (LayerWeaverDashboard)

- **Data:** reads `https://www.layerweaver.com/shop/instagram.json` like `fetchSiteReviewsBuilt()`
  reads `reviews-built.json` in `routes/shopify.js` (`SITE_REVIEWS_URL`, `?t=` cache-buster).
  Override with `SITE_INSTAGRAM_URL` for tests. No Instagram token on the VPS.
  Trade-off: new tags show only after a site rebuild. If that's too slow, step 6b adds a direct
  `/tags` call with `INSTAGRAM_TOKEN` in the VPS `.env`.
- **Files:** `routes/instagram.js` (router), `routes/lib/instagram-tags.js` (pure: which tagged
  posts are new, given approvals and local decisions; tests in `instagram-tags.test.js`).
  Decisions in `instagram-tags.local.json`: `{ "<shortcode>": { "status": "asked" | "skipped", "by", "at" } }`
  (gitignored by the existing `*.local.json` rule; state-sync copies it to the Mac).
- **Routes** (mount in `server.js` with `requireRole('admin')`, next to `/api/site`, after
  `app.use('/api', requireAuth)`; standby 409s every write automatically):
  - `GET /api/instagram/tags` -> `{ siteBuiltAt, fetchOk, posts: [{ shortcode, username, permalink, timestamp, status: 'new' | 'asked' | 'skipped' | 'approved' }] }`.
    Image thumbnails: link to the post, not hotlink (Instagram URLs expire; the site only stores
    approved images).
  - `POST /api/instagram/tags/:shortcode` `{ status: 'asked' | 'skipped' | 'new' }`.
  - `POST /api/instagram/tags/:shortcode/approve` -> step 6 below.
- **UI** (`public/index.html` `#body-tools`, after `#siteRebuildTool`; code at the end of
  `public/app.js` like `loadSiteRebuild()`): `<div id="instagramTool" hidden>`, shown to admins
  by `initSession()`. List newest first: username, date, "Open post", "Copy message", Asked /
  Approve / Skip. Use `esc()` for usernames. `.btn` classes for buttons. Check the phone layout
  (640px rules at the end of `styles.css`).
- **Today rows** (`todayItems()` in `app.js`, admins only, like `sitereviews`):
  - `igtags`: "N new Instagram posts tag us - ask to feature them" -> `{ tab: 'tools' }`, add
    `igtags: 'Review'` to `TODAY_CTAS`.
  - `igfetch`: when `fetchOk` is false: "The website couldn't load Instagram at the last
    rebuild" -> `{ tab: 'tools' }`, CTA 'Check'. The loader calls `todayChanged()`.
- **Approve** (`POST .../approve`): GitHub contents API on `rahul01/layerweaver`
  (`DEFAULT_SITE_REPO` in `routes/lib/site-rebuild.js`): `GET /contents/scripts/instagram-approved.json`
  (404 = new file) -> add the entry -> `PUT` with base64 content, the file's `sha` and message
  `Instagram: feature @<username>'s post <shortcode> (approved by <user>)`; on a 409 sha conflict
  re-read and retry once. Then start a rebuild the same way the Website panel does (reuse the
  dispatch code in `routes/site-rebuild.js`, reason `instagram approval`). Needs **Contents:
  write** added to `GITHUB_SITE_TOKEN` (open question 3). If the answer is no: Approve is left
  out, the panel shows the JSON line to paste, and the person commits it.

### 7. Token

- **System User token** from Meta Business Manager, the same kind as `META_ACCESS_TOKEN`: no
  expiry [Likely], so no renewal job. Assets: the LayerWeaver Page and Instagram account.
- Where it lives: site repo secret `INSTAGRAM_TOKEN`, repo variable `INSTAGRAM_USER_ID`, and the
  site's local `.env` for local builds. Not on the VPS unless step 6b is built.
- It can still die (password change, app removed): that's the `igfetch` Today row.

### 8. When it updates, and failures

- Every "Rebuild site" press (the dashboard already triggers these for new reviews, and Approve
  triggers one). **No schedule** - `rebuild-shop.yml` is manual-only on purpose. Open question 1.
- Instagram failing or no token: warn, keep the last `instagram.json` and images, carry on.
  Unlike Judge.me (`REQUIRE_REVIEWS`), a missing feed never stops products and reviews.
- Fewer than 4 posts -> leave the strip out of the page (empty markers).

### 9. Page changes (site)

- **Homepage** (`index.html`): add an empty `<!-- INSTAGRAM-STRIP-START --><!-- INSTAGRAM-STRIP-END -->`
  pair between the hero `</section>` and `<section id="testimonials">`. The build replaces it
  with `<section class="instagram-strip">...</section>` the same way as `HERO-RATING-BADGE`
  (regex replace in `main()`).
- **Shop** (`generateShopIndex()` in `build-shop.js`): the same HTML after the
  `<section class="shop-products">` block, before `${footerHtml(base)}`. Image paths: absolute
  (`/images/instagram/...`) so they work from both pages.
- One function `instagramStripHtml(posts)` in `scripts/build-instagram-utils.js` makes the HTML
  for both, with unit tests in `tests/build-instagram.unit.test.js`.
- CSS: homepage in `styles.css`, shop in `shop/shop.css` (both pages load their own); keep the
  rules identical, brand tokens only.
- Layout: heading "Seen on Instagram"; one row with sideways scroll-snap on phones, 6 visible on
  desktop; square tiles, `loading="lazy"`, `width`/`height` set; "Shop this" label on mapped
  tiles, "From @username" on customer tiles; last tile "Follow @thelayerweaver" ->
  `https://www.instagram.com/thelayerweaver/`. Instagram links: `target="_blank" rel="noopener"`.
  Mix: 12 tiles by date (open question 4).
- Tracking (`script.js`): add `['.instagram-strip', 'instagram_strip']` to `getClickSection()`,
  and next to the `hero_click` block send `instagram_tile_click` with `link_url` and
  `link_text` = `<ours|customer>: <product handle|instagram|follow>`. Built-in GA4 parameters,
  so no custom dimensions are needed. E2e test like `tests/hero-tracking.e2e.spec.js`.

### 10. Workflow and docs

- `.github/workflows/rebuild-shop.yml`: pass `INSTAGRAM_TOKEN: ${{ secrets.INSTAGRAM_TOKEN }}`
  and `INSTAGRAM_USER_ID: ${{ vars.INSTAGRAM_USER_ID }}` to the build step; add
  `images/instagram` to the `git add -A` list (`shop` already covers `shop/instagram.json`).
  Don't rename steps - `routes/site-rebuild.js` in the dashboard follows them by name.
- Site `CLAUDE.md` "Shop build and GitHub Actions": what the build now writes, the new secret and
  variable, the two hand-edited JSON files.
- Dashboard: `CLAUDE.md` architecture list (`routes/instagram.js`) and env table (only if 6b),
  `.env.example` (`SITE_INSTAGRAM_URL` optional), `deploy/RUNBOOK.md` "Website rebuild" (Approve
  commits to the site repo; token needs Contents write).

## Build steps (each: plan, Rahul approves, tests green, check 400px and desktop, commit)

| # | Repo | Step | Done when |
|---|---|---|---|
| 0 | - | **Rahul, manual** (Claude can guide): @thelayerweaver is a Business account linked to the LayerWeaver Facebook Page; Meta app (Facebook Login, Instagram API) in Business Manager; System User with the Page + Instagram account as assets; token with the permissions above; `INSTAGRAM_TOKEN` secret + `INSTAGRAM_USER_ID` variable in `rahul01/layerweaver`, and in the site's `.env` | The "check first" list is answered; `/media` and `/tags` return data |
| 1 | site | `build-instagram.js` + utils + unit tests: our posts, map, download, resize, `instagram.json` | Local `npm run build-shop` writes 12 images under 60KB and a valid JSON |
| 2 | site | Strip HTML/CSS on homepage + shop, tracking, e2e test | Looks right at both widths; e2e checks tiles and `instagram_tile_click` |
| 3 | site | Workflow: secret, variable, image commit; docs | A manual Actions run publishes the strip |
| 4 | site | Customer posts: `/tags`, approvals file, drop-off, "From @username" | Tests: unapproved never shown; approved but no longer tagged disappears |
| 5 | dashboard | Instagram panel (list, copy message, Asked/Skip), Today rows `igtags` / `igfetch` | Panel lists real tagged posts; Skip survives a reload; server.test.js green |
| 6 | dashboard | Approve -> commit to the site repo + rebuild (if question 3 is yes) | An approved post is live after the rebuild |
| 7 | site | Rahul fills `instagram-products.json` for current posts (Claude can draft it from captions) | Most tiles link to products |

About a day for steps 1-6 (half for our posts, half for customer posts and the dashboard).

## Open questions for Rahul

1. **Freshness:** new posts show up only on the next rebuild. Enough, or add a weekly schedule to
   the workflow? It's manual-only on purpose, and the reason isn't written down - recommend
   leaving it manual unless you know why it was.
2. **Unmapped posts:** show them (link to Instagram), or show only posts mapped to a product?
   Recommend show all - "only mapped" may leave too few tiles.
3. **Approve from the dashboard** needs `GITHUB_SITE_TOKEN` to gain Contents write on the site
   repo, so a stolen VPS token could change the site. The VPS already holds Shopify admin access,
   which is worse, so recommend yes. The alternative is pasting the line into
   `instagram-approved.json` by hand (or asking Claude) and pressing Rebuild.
4. **Tile mix:** by date (recommended, simplest), or customer posts first?
5. **Hero:** settled by the ~Nov 7 `hero_click` check above.
