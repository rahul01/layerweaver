# CLAUDE.md

Guidance for Claude Code sessions in this repo (layerweaver.com, a static site on GitHub Pages).
Other notes live in `.ai/plans/` and `.claude/commands/`.

## Shop build and GitHub Actions

The shop pages are generated, not hand-written: `scripts/build-shop.js` fetches products from
Shopify's Storefront API and reviews from Judge.me, and writes `shop/` (product, collection,
account and index pages, `reviews-built.json`), `team/review/`, parts of the root `index.html`
(testimonials, hero rating) and `sitemap.xml`. The site goes live when those files are pushed to
`main` (GitHub Pages, legacy branch build from `/`).

Two ways to run it:

1. **Locally**: `npm run build-shop` (needs `JUDGEME_API_TOKEN` in `.env`, or it asks; without
   it the build warns and publishes no ratings). Commit the output as
   `chore: rebuild shop output - <what changed>` and push.
2. **GitHub Actions, "Rebuild shop"** (`.github/workflows/rebuild-shop.yml`): started from the
   ops dashboard (LayerWeaverDashboard, Tools tab -> Website -> Rebuild site, admins only) or
   from GitHub (Actions -> Rebuild shop -> Run workflow). **Manual only - there is deliberately
   no schedule.** It:
   - runs `node scripts/build-shop.js` with `REQUIRE_REVIEWS=true` and the repo secret
     `JUDGEME_API_TOKEN` - if Judge.me fails or returns no reviews, the build exits 1 and
     nothing is committed (otherwise every rating would vanish from the site);
   - commits only `shop`, `team/review`, `index.html` and `sitemap.xml`, as `github-actions[bot]`,
     message `chore: rebuild shop output (from dashboard - <reason>)`; no commit if nothing changed;
   - rebases on `main` before pushing (fails cleanly, asking to re-run, if a local rebuild was
     pushed meanwhile);
   - requests a Pages build explicitly (a push made with the workflow's own token may not
     trigger one);
   - runs one at a time (concurrency group `rebuild-shop`), 15-minute timeout.
   Inputs: `reason` (run name and commit message) and `requested_by` (the dashboard username).

What this means when working here:

- **Pull before you push.** The robot's commits land on `main` at any time.
- **Use the workflow to publish data-only changes** (new product, photos, price, reviews in
  Shopify / Judge.me): no local build or commit needed - press Rebuild site.
- **Template or code changes to `build-shop.js`** still need a local build to check the output;
  commit the script and the output together (or commit the script and run the workflow).
- The build needs only Node built-ins (no `npm install`), so keep it that way or add an
  install step to the workflow.
- `scripts/judgeme-review-replies.csv` (merchant replies, exported by hand from Judge.me) and
  `EXCLUDED_REVIEW_IDS` in the script are committed inputs - the workflow uses whatever is on
  `main`.
- Dashboard side: `routes/site-rebuild.js` there calls GitHub's API with a fine-grained token
  (`GITHUB_SITE_TOKEN`, this repo only, Actions read/write + Pages read). Changing the
  workflow's file name, inputs or step names means updating that route too.
