# Razorpay ↔ Shopify Orphan Recovery — Automated Pipeline

**The actual failure mode:** Razorpay captures the payment successfully,
then the post-payment redirect back to Shopify (which is what finalizes the
order from the checkout) fails or the customer closes the tab before it
completes. The checkout is left sitting in Shopify as an **abandoned
checkout with real cart contents and a real address** — not lost data, just
disconnected from the payment that already happened. Confirmed against
`.ai/plans/razorpay-shopify-reconciliation.md` (a real 3-day manual
reconciliation, Aug 6–8 2026): every real orphan there was "customer exists,
0 orders," consistent with a checkout that has an abandoned-checkout record
but never became an order.

Razorpay's integration here is Shopify's own native hosted payment gateway
(confirmed — no custom Razorpay code exists in either repo, just a UI label
in `shop/cart.js`). The redirect-completion gap is inside Shopify's gateway
plumbing, not something this codebase can patch directly — recovery has to
happen after the fact, by reconciling the two systems.

**Goal:** run this without a human/Claude in the loop — pure API polling,
matching, and (for high-confidence matches) automatic order creation.

---

## Is it possible? Yes, with one real constraint

Verified against the live store schema, not assumed:

- **`AbandonedCheckout` has no payment reference field** — no Razorpay
  payment ID, no "was this paid" flag. The join between "this Razorpay
  capture" and "this abandoned checkout" has to happen by **matching
  amount + phone + email**, the same three signals actually used doing
  this by hand — computed client-side after fetching both lists, since
  there is no server-side field that already links them.
- **Phone data on abandoned checkouts is real and usable**: checked live —
  `shippingAddress.phone` / `billingAddress.phone` are populated on actual
  abandoned checkouts (e.g. `9977731746`, `8291898201` from real Sep 10
  records). `customer` is usually null (guest checkout), so don't rely on
  `customer.phone`.
- **Email is the weak link — `AbandonedCheckout` has no usable email field
  for guest checkouts.** Checked live: there's no top-level `email` field
  on `AbandonedCheckout` at all (the GraphQL schema rejects it), and
  `MailingAddress` (`shippingAddress`/`billingAddress`) has no `email`
  field either — only `customer.email`, which was `null` on every real
  sample checked (guest checkout, no logged-in customer). So email can
  only strengthen a match when the buyer happened to be a returning,
  logged-in customer; it can't be relied on as a primary signal the way
  phone can. Treat it as a bonus signal when present, not something the
  pipeline can count on for most cases — this may be the reason manual
  email-matching worked better than expected: it was likely cross-checked
  against Razorpay's own captured email/contact.contact fields and the
  eventual Shopify *order* record (once one existed), not the abandoned
  checkout itself.
- **`abandonedCheckouts(query: "customer_phone:...")` does not work** —
  tested live, returns unfiltered results regardless of the phone value.
  Don't build the lookup as a server-side filtered query; fetch a bounded
  recent window (`first: N, sortKey: CREATED_AT, reverse: true`) and match
  client-side instead.
- **`completedAt`** on `AbandonedCheckout` is presumably set once a
  checkout does convert to an order — use it to exclude anything that
  self-resolved before the reconciliation job runs, avoiding a duplicate
  order.
- **No Razorpay API credentials exist yet** — `RAZORPAY_KEY_ID` /
  `RAZORPAY_KEY_SECRET` need to be generated (Razorpay dashboard → Settings
  → API Keys) and added to `.env`. This is genuinely new integration work,
  not wiring up something partial.
- **Write scope required.** This dashboard's existing Shopify app
  (client-credentials, used by `routes/shopify.js`) is read-only — checked
  `currentAppInstallation.accessScopes` live, only `read_*` scopes present.
  `draftOrderCreate` + `draftOrderComplete` need `write_draft_orders`
  granted in Shopify admin → Settings → Apps → Develop apps → this app →
  Configuration, before any of Phase 2 can run.

---

## Matching logic

**Four scored signals: amount + phone + email + time.** Amount and phone
are the two that were actually relied on doing this by hand, email helps
when available, and time is kept as a real scored component too (not
demoted to a pure filter) — it's one-sided rather than a symmetric window
since a checkout is created before the customer ever reaches Razorpay, and
gaps of up to ~10 minutes have been observed on real data. Keep it in the
score for now; if it turns out to just add noise once this runs against
real volume (e.g. it rarely agrees even on true matches, given how variable
checkout-to-payment timing is), drop it back to a pure lookback filter
rather than a scored signal — but don't do that pre-emptively before
there's real run data to justify it.

```
checkout_time = checkout.updatedAt ?? checkout.createdAt
delta = payment.created_at - checkout_time   // seconds

lookback_ok = delta >= -120 && delta <= 2700
              // -120: 2 min clock-skew slack for checkout appearing
              // "after" the payment
              // 2700: 45 min lookback bound — which checkouts are even
              // considered candidates at all, kept generous since 10 min
              // was observed with no confirmed upper bound

time_ok = delta >= -120 && delta <= 1200
          // 20 min — the *scored* window, tighter than the lookback
          // bound above: a candidate within this range gets the time
          // score point; one further out (up to the 45 min lookback) is
          // still considered a candidate, just without that point
```

```
For each Razorpay capture in the window:
  Skip if a Shopify order already exists with matching amount within a
  ±15 min window of the order's own createdAt (real order — not an
  orphan; this narrower window is fine here since a real order is
  created by Shopify near-simultaneously with the payment, unlike an
  abandoned checkout).

  Candidates = open abandoned checkouts (completedAt == null) where
  lookback_ok is true.

  For each candidate:
    score = 0
    if abs(checkout.totalPrice - payment.amount/100) < 0.01: score += 3
    if checkout.shippingAddress.phone == payment.contact: score += 3
    (fall back to billingAddress.phone if shippingAddress is null)
    if checkout.customer?.email == payment.email: score += 2
    // email is usually unavailable — customer is null on guest
    // checkouts (the common case here), so most real matches will
    // score on amount + phone (+ time) alone; email's absence should
    // never count against a candidate
    if time_ok: score += 1
    // a tiebreaker, not a gate — weighted lightest of the four since
    // it's the least reliable signal on its own

  Best-scoring candidate above a confidence threshold → candidate.
  No candidate above threshold → flag NEEDS_REVIEW, no auto-write.
  Multiple candidates tied at the same top score → flag NEEDS_REVIEW,
  never auto-pick between ambiguous candidates.
```

Confidence tiers, since a wrong auto-created order is worse than a missed
one:
- **HIGH** (amount + phone both match, regardless of email/time): auto-resolve.
  Email or time agreeing too pushes confidence higher still, but their
  absence shouldn't block auto-resolve once amount+phone already agree.
- **MEDIUM** (amount matches, phone missing/doesn't match, but email
  matches — the rarer logged-in-customer case): auto-resolve only if it's
  the sole candidate at that amount; otherwise NEEDS_REVIEW.
- **LOW** (amount match only — no phone or email agreement, time_ok alone
  isn't enough to lift this tier, or multiple candidates with no
  distinguishing signal): NEEDS_REVIEW always — never auto-write.

A 45-minute lookback increases the odds of more than one open checkout
landing near the same amount — this is exactly why phone (and email, when
present) carry the real weight, and why MEDIUM confidence requires a *sole*
candidate rather than just "best score." NEEDS_REVIEW is the release valve
for that tradeoff, not a wrong auto-created order.

---

## Pipeline

**Not Claude, not MCP — plain scheduled API calls.** Fits this dashboard's
existing pattern: a new Express route calling out to Razorpay + Shopify,
same shape as `routes/shopify.js` / `routes/delhivery.js`.

### `routes/reconcile.js` (new)

Two routes, deliberately different HTTP methods since one has side effects
and one doesn't:
- `POST /api/reconcile/run?date=YYYY-MM-DD&dryRun=true|false` — the actual
  trigger. Both the `launchd` scheduled job and the dashboard's "Run Now"
  button call this exact endpoint (one code path, not two to keep in sync).
  `POST` rather than `GET` since a `dryRun=false` call writes real orders —
  a `GET` with side effects is the wrong verb regardless of trigger source.
- `GET /api/reconcile/status?date=YYYY-MM-DD` — reads back the stored
  result of the most recent run for that date (see step 3 below). Never
  triggers a run itself; this is what the dashboard card loads on page
  view.

```
POST /api/reconcile/run
  1. Fetch Razorpay captures for the IST day (Basic Auth,
     GET /v1/payments?from=&to=&count=100, paginate via skip,
     filter status == "captured")
  2. Fetch Shopify orders for the same IST day (existing fetchAllOrders
     pattern, reuse routes/shopify.js)
  3. Fetch open abandoned checkouts (completedAt == null) created within
     the last ~45 min of the query window's end, not a window matched to
     the day boundary — a checkout can predate its matching payment by up
     to ~10-20 min (observed), so the lookback has to extend before the
     IST day if captures near midnight are being reconciled
  4. Match Razorpay captures against Shopify orders by amount/time
     (paymentGatewayNames containing "manual" orders are correctly
     excluded — not part of Razorpay reconciliation at all)
  5. Unmatched captures -> score against open abandoned checkouts per the
     confidence tiers above
  6. dryRun=true (default): return the report, write nothing
  7. dryRun=false: for HIGH/MEDIUM auto-resolve candidates only ->
     draftOrderCreate, with note and tags set directly in the same input
     (both are real DraftOrderInput fields — confirmed against the live
     schema, no separate orderUpdate call needed):
       tags: ["webhook-recovery", "auto-resolved"]  // reuses the existing
                                                      // webhook-recovery
                                                      // convention already
                                                      // seen by hand on
                                                      // order #1520
       note: "Auto-recovered via Razorpay reconciliation.
              Razorpay payment: {payment.id} · ₹{payment.amount/100}
              captured {payment.created_at, IST}.
              Matched on: {amount, phone, email — whichever signals
              actually agreed} · confidence: {HIGH|MEDIUM}."
     -> draftOrderComplete
     `note` on Shopify orders is a single overwritable string, not an
     appendable log — if this order is ever touched by another process
     that also writes `note`, that process must preserve this text rather
     than clobber it. The Razorpay payment ID is the load-bearing part of
     the note: it's what makes an auto-created order traceable back to the
     specific capture that justified it, for any later manual audit or
     refund-vs-keep decision.
  8. Return { matched, autoResolved, needsReview, manual, summary }
```

### Trigger model: fully unattended, no button, no human in the loop

Confirmed deliberately: for HIGH/MEDIUM confidence matches, the order gets
created automatically the moment the scheduled run finds it — there is no
"Resolve" button, no per-order confirmation step. The only place a human
touches this is LOW-confidence NEEDS_REVIEW cases, surfaced read-only in
the dashboard card below. This is the main reason the safety rails further
down (note traceability, per-run cap, HIGH/MEDIUM-only) matter as hard
requirements rather than nice-to-haves — nothing stands between a matching
bug and a real order landing in Shopify.

### Scheduling

This dashboard has no existing cron/timer mechanism — `server.js` is a
plain always-on Express process with no scheduling library, run under
`launchd` (`com.layerweaver.dashboard.plist`) purely to keep it alive. The
natural fit is a second, separate `launchd` job
(`com.layerweaver.reconcile.plist`) on a `StartCalendarInterval`, matching
the existing pattern rather than adding an in-process timer/cron library —
calling `POST /api/reconcile/run?date=<yesterday>&dryRun=false` (e.g. via
`curl -X POST`) on the already-running dashboard server — the same
endpoint the dashboard's "Run Now" button calls.

Cadence: start with once daily, plus a same-day intraday pass (every few
hours) so genuinely urgent cases don't sit 24h before recovery — exact
cadence is a judgment call once real volume is known; tighten if orphans
turn out to be time-sensitive (e.g. limited stock).

### Safety rails
- `dryRun` always available and defaults true for any ad-hoc run.
- Auto-resolve only ever fires for HIGH/MEDIUM confidence; LOW always waits
  for a human.
- Every auto-resolved order's `note` must include the Razorpay payment ID,
  captured amount, and which signals matched — traceable back to source,
  same as the manual `webhook-recovery` tag already in use. This is a hard
  requirement, not a nice-to-have: without the payment ID in the note,
  there's no way to later audit an auto-created order against the Razorpay
  capture that justified it, or to tell a refund/dispute apart from a
  legitimate recovery.
- Cap auto-resolve at some sane per-run ceiling (e.g. 20 orders) and alert
  rather than silently mass-creating orders if a run's orphan count spikes
  unexpectedly — a spike is more likely a bug in the matching than a real
  traffic event.

---

## UI (this dashboard, not a separate app)

**Read-only by default, with an explicit manual-run button.** Two separate
things, kept clearly distinct so they can't be confused:
- **Viewing the card** never triggers anything — it loads the most recent
  stored run result. Opening the dashboard can never cause a write.
- **A "Run Reconciliation Now" button** fires an actual `dryRun=false` run
  immediately, on demand — for re-checking after noticing a spike,
  re-running a specific day, or just not wanting to wait for the next
  scheduled pass. This is in addition to the unattended cron, not instead
  of it: both the `launchd` job and this button call the exact same
  `/api/reconcile/run` endpoint, so there's only one code path to trust,
  not two.

A new card in `public/index.html`, matching the existing ops-card pattern:

| Card | Endpoint(s) | Shows |
|---|---|---|
| Payment Reconciliation | `GET /api/reconcile/status?date=` (loads the most recent stored run, read-only) · `POST /api/reconcile/run?date=&dryRun=false` (the button — fires a real run) | Today's/yesterday's run: matched count, auto-resolved count (with links to the orders it created), needs-review list with amount/phone/checkout link, manual-payment total, timestamp of the last run and whether it was scheduled or manually triggered |

Needs-review rows link straight to the abandoned checkout
(`abandonedCheckoutUrl` field) and show the Razorpay payment ID for a quick
manual refund/contact decision — this is the one place a human still acts,
for LOW-confidence cases only.

The button should show a plain confirmation before firing (e.g. "This will
create real Shopify orders for any HIGH/MEDIUM match found — continue?"),
since unlike the scheduled run it's one click away from someone browsing
the dashboard, not gated behind a `launchd` config change.

---

## Build order

**Goal: get to fully unattended (HIGH+MEDIUM auto-resolve on the `launchd`
schedule) as directly as possible.** No week-long watch periods or staged
confidence rollout for their own sake — the one gate that isn't optional is
proving the matcher's correctness against known-good historical data
*before* it's allowed to write anything, because a wrong auto-created order
(wrong address, wrong customer) is a worse outcome than the orphan it was
trying to fix, and that's not a caution that fades with time — it applies
identically on day one and day 100. Once that gate is passed, there's no
reason to hold back HIGH+MEDIUM or the schedule separately.

1. **Razorpay client** — `routes/lib/razorpay.js`: Basic Auth fetch wrapper,
   pagination, `status: "captured"` filter. Add
   `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to `.env.example`.
2. **Matching only, dry-run, no writes** — implement the amount/phone/email/
   time scoring, then run it against the days already covered by the Aug 8
   manual report and confirm it reproduces those matches/orphans. This is
   the one required checkpoint, not a multi-day soak — a single correct
   comparison run is enough to move on.
3. **Run-result storage** — a JSON file under the project root (same
   lightweight pattern as `print-status.local.json` in `routes/print.js`),
   so the status card and the `launchd` job both have something to read
   back without re-running live.
4. **Grant `write_draft_orders`** on the Shopify app — this is a manual
   step in the Shopify admin, the one place a human has to act outside the
   code itself.
5. **Build the full pipeline in one pass**: HIGH+MEDIUM auto-resolve
   (per the confidence tiers above), the dashboard status card + "Run Now"
   button, and the `launchd` scheduled job (`com.layerweaver.reconcile.plist`)
   — all together, not sequenced apart with waiting periods in between.
   Turn the schedule on as soon as step 2's dry-run check has passed and
   `write_draft_orders` is granted.

What still isn't negotiable, because these are what make unattended
operation safe rather than what's slowing the build down: LOW confidence
never auto-writes, every auto-created order's `note` carries the Razorpay
payment ID (see Pipeline above), and the per-run cap/spike-alert stays in
place from the first scheduled run, not added later.
trying to fix.
