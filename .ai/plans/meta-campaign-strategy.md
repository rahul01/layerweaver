# LayerWeaver — Meta Campaign Strategy
*Data-driven. Built from actual account history, GA4, Shopify analytics, and SEO audit.*

| | |
|---|---|
| **Account** | Ad Account 204133601493657 (Surbhi tiwari / The Layer Weaver) |
| **Market** | India (nationwide) |
| **AOV** | ₹472 |
| **Pixel** | Connected & verified |
| **Attribution** | Fixed 2026-07-20 — UTMs now attach to Shopify orders |
| **GA4 cart events** | Fixed 2026-07-20 — add_to_cart / begin_checkout now fire |
| **Run date** | 2026-07-20 |

---

---

## Execution status — 2026-07-20

### Doing right now

**Hi Value Sales July — resumed today**
- Status: Active, delivering
- Budget: ₹1,000/day
- End date: Jul 31, 2026
- Targeting: Age 22–50 · Engaged Shoppers · Household income India Top 41–50% · Parents (All) · Online shopping (retail)
- Format: Catalogue ad (dynamic product images, no custom creative)
- Products: ₹499+ items prioritised, Advantage+ can override
- Copy: Generic (no primary text added yet — test planned for after 7 days)
- ⚠️ **To do immediately:** Turn off Personalized destinations → Product browsing and Browser add-ons (both currently ON — routes some clicks away from website, breaking Pixel attribution)

**Sales Campaign — paused**
- Reason: Both are cold-audience catalogue campaigns with overlapping audiences. Running simultaneously causes auction overlap — both campaigns bid against each other, driving CPP up on both. Hi Value Sales July has proven history (11 purchases, ₹243 CPP); Sales Campaign had 1 purchase at ₹589 CPP in 4 days.
- Resume only if Hi Value Sales July is paused or a separate distinct audience is available.

**Retargeting audiences — created, populating**
- "LW - Website Visitors 30d (excl. Purchasers)" — pixel-based, Purchase event excluded. Shows "Below 1000" — consider editing to 90-day retention for larger pool before launching Campaign 1A.
- "LW - Instagram Engagers 60d" — @thelayerweaver, 60-day window. Purchaser exclusion to be applied at ad set level (not audience level — Meta doesn't support pixel-based exclusions inside Instagram audiences).

---

### After 7 days — check on Jul 27

**Step 1 — Evaluate Hi Value Sales July CPP**
- CPP < ₹300: increase budget by 20% (→ ₹1,200/day)
- CPP ₹300–500: hold budget, move to Step 2
- CPP > ₹500 for the full 7 days: pause and review audience or creative

**Step 2 — Test primary text copy (duplicate campaign)**
- Duplicate Hi Value Sales July → add primary text (Copy B from this doc) → run both for 7 days → pause the higher CPP version
- Do NOT edit the live campaign — duplicate and test in parallel
- Suggested primary text: *"This lamp costs ₹399 and people keep asking us where we got it. 3D printed in Pune — eco-friendly PLA, designed in-house. The ghost balloon glows. Ships anywhere in India. Free shipping above ₹299. 200+ happy customers. Easy returns."*
- Headline: "Printed in Pune. Ships Across India."

**Step 3 — Launch retargeting campaigns**
- Confirm both audiences have populated (check size estimates in Audiences tab)
- If "LW - Website Visitors" is still "Below 1000" → edit audience retention to 90 days before launching
- Campaign 1A: Website visitor retargeting, ₹100/day, Purchase objective, audience "LW - Website Visitors 30d (excl. Purchasers)"
- Campaign 1B: Instagram engager retargeting, ₹100/day, Purchase objective, audience "LW - Instagram Engagers 60d" — exclude purchasers at ad set level

**Do not launch retargeting until Hi Value Sales July has been running 7 days.** Running 3 campaigns simultaneously from day 1 splits budget and data too thin.

---

## What the data actually says

Before any strategy, here's the honest picture from the real numbers:

**The funnel works.** Strip out the Jun 23 awareness push (111 sessions, zero purchase intent) and the underlying sales funnel converts at 78.8% reach-checkout, 24.7% complete-checkout. The store is not broken. Traffic is the only ceiling.

**The best real CPP is ₹243.** The "New Sales Campaign" that showed ₹93.46 CPP was a 6-month celebration with free gift (cat cable clip) + free shipping on all orders — a one-time promo, not a repeatable baseline. "Hi Value Sales July" at ₹243/purchase with no promotional hook is the honest benchmark.

**At ₹472 AOV and ₹243 CPP, the raw ROAS is ~1.9x gross.** That's marginal but the real ROAS is higher — custom builds (₹9,825/month via WhatsApp) are your #2 revenue line and get zero Meta attribution. Customers who discover you through an ad and order a custom build over WhatsApp look like ROAS 0 in the ad account. Factor that in and ₹243 CPP is profitable.

**Meta is already your dominant traffic channel.** GA4 shows Paid Social drove 5,220 of 6,325 sessions (82.5%) in the last 28 days. Shopify was showing it as "Direct" because the checkout domain handoff was dropping attribution — that's now fixed.

**Past campaigns ran the wrong objective most of the time.** Of 17 campaigns and ₹13,320 total spend, the majority optimised for Link Clicks or Messaging Conversations — not purchases. Only 3 campaigns used Website Purchase as the objective. Those 3 generated 66 of the 67 tracked purchases.

**What you should stop doing immediately:** creating new Instagram post boosts. They look active (cheap clicks, message counts) but don't teach Meta's algorithm to find buyers. Every rupee of boost budget belongs in purchase-optimised campaigns instead.

---

## The three-phase plan

### Phase 1 — Retargeting (audiences created 2026-07-20, ready in 24–48h)
*Lowest CPP, fastest results, requires no new creative*

You already have warm audiences who know LayerWeaver. Convert them before spending on cold traffic.

**Campaign 1A — Website visitor retargeting**
- Objective: Sales (Purchase conversion)
- Audience: Website visitors last 30 days (via Pixel) — excluding purchasers
- Budget: ₹150/day
- Ad format: Single image or short video
- Product focus: Ghost Balloon Lamp (proven top seller)
- Copy angle: "Still thinking about it? Free shipping on orders above ₹299."

**Campaign 1B — Instagram engager retargeting**
- Objective: Sales (Purchase conversion)
- Audience: People who engaged with @thelayerweaver last 60 days — excluding purchasers
- Budget: ₹100/day
- Ad format: Reel or carousel
- Product focus: Top 3 by revenue (Ghost Lamp, Dino Box, T-rex)
- Copy angle: "You've seen what we make. Here's where to get it."

~~**Campaign 1C — Jun 23 visibility day retargeting**~~ — **dropped**
Meta does not support date-range filtering in custom audiences. The ~111-person audience also hits frequency limits too fast for a viable ₹50/day campaign.

**Expected Phase 1 CPP:** ₹100–180 (warm audiences convert cheaper)
**Phase 1 total budget:** ₹250/day · ₹3,500 for 2 weeks (1A + 1B only)

---

### Phase 2 — Scaling what works (Week 3–6)
*One proven cold-audience campaign + lookalikes*

**Campaign 2A — Ghost Balloon Lamp cold traffic (hero campaign)**
- Objective: Sales (Purchase conversion)
- Audience: Cold — interest-based (see targeting below)
- Budget: ₹300/day
- Ad format: Primary Reel (15–30s product video), backup single image
- Bidding: Highest volume (let Meta optimise, don't use cost caps until Week 5)
- Rule: Do not touch for 7 days after launch. Meta needs time to learn.

**Campaign 2B — Lookalike from purchasers**
- Objective: Sales (Purchase conversion)
- Audience: 1% Lookalike of all purchasers (upload customer list to Meta)
- Budget: ₹200/day
- Ad format: Same as 2A (same creative, different audience)
- Note: Build this audience the moment you have 100+ purchasers on the list

**What to do when Phase 2 has 7+ days of data:**
- If CPP < ₹200: increase budget by 20% every 4 days
- If CPP ₹200–300: hold budget, test new creative
- If CPP > ₹300 for 5+ days: pause ad set, change audience or creative

**Phase 2 total budget:** ₹500/day · ₹14,000 for 4 weeks

---

### Phase 3 — Systematic scaling (Month 2+)
*Only enter this phase after confirming a CPP below ₹250 in Phase 2*

- Scale the winning ad set from Phase 2 to ₹800–1,000/day
- Add a second product campaign (Dino Box or Octopus Table Lamp)
- Build 2% and 3% lookalikes off the purchaser list
- Introduce dynamic product ads using the Shopify product catalogue
- Target lapsed visitors (60–90 days) with a separate retargeting campaign

---

## Audience targeting — cold traffic

**Primary (Ghost Balloon Lamp)**
- Age: 22–40, All genders
- India — nationwide
- Interests: Gifts, birthday gifts, unique gifts, home décor, 3D printing, Etsy, online shopping
- Behaviour: Online shoppers, Engaged shoppers (Meta behaviour targeting)

**Secondary (Desk / Tech enthusiasts)**
- Age: 18–35, skew male
- Interests: Mechanical keyboards, PC build, gaming setup, desk accessories, tech gadgets
- Products: WASD Keychain, Keyboard Clicker, Night Dragon, Hoodie Pen Pot

**Secondary (Book lovers)**
- Age: 18–38, skew female
- Interests: Reading, books, Kindle, bibliophiles, BookTok
- Products: Page Pals bookmarks (Cat, Dog, Butterfly)

**Secondary (Parents / STEM)**
- Age: 28–45, parents
- Interests: Kids toys, STEM education, Lego, school activities, parenting
- Products: T-rex Skeleton, Articulated Octopus, Panda Figurine, Fidgets
- Copy hook: Lead with Raghav's story — this audience responds to it immediately

**Secondary (Aquarium hobbyists)**
- Age: 22–45
- Interests: Aquarium, fish keeping, planted tanks, aquascaping
- Products: Aquarium Cave, Feeding Ring, 120mm Fan
- Note: Small but ultra-targeted, very low CPM, high purchase intent

---

## Budget plan

| Phase | Duration | Daily budget | Total |
|---|---|---:|---:|
| Phase 1 (retargeting) | 2 weeks | ₹300/day | ₹4,200 |
| Phase 2 (cold + lookalike) | 4 weeks | ₹500/day | ₹14,000 |
| Phase 3 (scale) | Ongoing | ₹800–1,000/day | — |

**Minimum to run Phase 1 + Phase 2 meaningfully: ₹18,200**
Start with Phase 1 only (₹300/day) if budget is tight. Use its purchase data to seed Phase 2 lookalikes.

---

## Creative strategy — what to actually make

### Priority 1: Ghost Balloon Lamp hero Reel
**The single most important creative asset to produce.**
- 15–30 seconds
- Show the lamp turned off → glowing in a dark room → someone's reaction
- No voiceover needed. Text overlay: "3D printed in Pune. Glows like magic."
- End card: "Ghost Balloon Lamp · ₹399 · Free shipping above ₹299"
- This product photographs beautifully and sells itself — the creative job is just to show it working

### Priority 2: Brand story Reel (TOFU, for Phase 2 cold audiences)
- 30–45 seconds
- Open with Raghav inspecting a finished product: "Is this cool enough?"
- Show 5–6 products being made or unboxed
- Close with: "LayerWeaver. Made in Pune, layer by layer."
- This is the differentiation ad. Nobody else has this story.

### Priority 3: Personalization angle (for retargeting)
- Static image or short video
- Show the name keychain or sweeping sign nameplate being personalised
- Copy: "Put your name on it. Literally. Custom 3D printed keychains from ₹149."
- Works well for retargeting because it gives a reason to come back that wasn't there before

### Priority 4: Desk aesthetic grid (for tech/gaming audience)
- Single image: styled flat-lay of WASD Keychain, Keyboard Clicker, Night Dragon, Hoodie Pen Pot
- Clean background, well-lit
- Copy: "Your desk deserves better than boring."

---

## Ad copy — ready to use

### Copy A — Emotional / story (for brand Reel, cold audiences)
> Our 8-year-old has one quality check: "Is this cool enough?"
>
> LayerWeaver is a family 3D printing studio in Pune. Every lamp, keychain, and fidget we make started as Raghav's idea — or passed his inspection before it didn't.
>
> Eco-friendly. Handcrafted. Delivered across India.
> Free shipping above ₹299.
>
> 👉 Shop now → layerweaver.com

### Copy B — Product / direct (for Ghost Balloon Lamp campaign)
> This lamp costs ₹399 and people keep asking us where we got it.
>
> It's 3D printed in Pune — eco-friendly PLA, designed in-house. The ghost balloon glows. It ships anywhere in India. Free shipping above ₹299.
>
> 200+ happy customers. Easy returns.
>
> Shop the Ghost Balloon Lamp →

### Copy C — Gift angle (for gifting interest audiences)
> The gift they'll actually keep using.
>
> Unique 3D printed gifts from LayerWeaver — starting at ₹99. Lamps, keychains, desk toys, bookmarks, custom nameplates, fidgets.
>
> Made in Pune. Ships across India. Free shipping above ₹299.
>
> 👉 Find the perfect gift →

### Copy D — Short / punchy (for Reels, first 3 seconds must hook)
> 3D printed in Pune. Starts at ₹99.
> Ghost lamps. Fidgets. Keychains. Custom names.
> Free shipping above ₹299.
> 👉 layerweaver.com

### Copy E — Retargeting (warm audiences only)
> You've seen what we make. Here's the part you might have missed:
> free shipping on every order above ₹299, easy returns, and custom orders available via WhatsApp.
>
> The Ghost Balloon Lamp is still in stock. ₹399.
>
> Shop → layerweaver.com

### Headlines
- "3D Printed in Pune · Ships Across India"
- "Unique Gifts From ₹99 · Free Shipping Above ₹299"
- "Made Layer by Layer in a Family Studio"
- "The Ghost Lamp That Everyone Asks About"
- "Put Your Name On It. Literally."
- "Desk Toys That Actually Do Something"

---

## What to measure — and when

Now that attribution is fixed (UTMs attach to Shopify orders as of 2026-07-20), you can measure properly for the first time.

| Metric | Where to check | Target |
|---|---|---|
| Cost per purchase (CPP) | Meta Ads Manager | < ₹250 by Week 4 |
| ROAS (Meta-reported) | Meta Ads Manager | > 1.5x (note: understates true ROAS due to WhatsApp orders) |
| Click-through rate (CTR) | Meta Ads Manager | > 1.5% |
| Cost per click (CPC) | Meta Ads Manager | < ₹8 |
| Order source in Shopify | Shopify admin → Orders | Should now show UTM/campaign data |
| Channel breakdown | GA4 → Traffic acquisition | Paid Social should remain dominant |
| Returning customer rate | Shopify analytics | Target 10%+ by Month 3 |

**Check cadence:**
- Daily: spend vs. budget, CPP (don't optimise — just watch)
- Every 4 days: decide on budget changes (±20% max)
- Weekly: review creative performance, pause underperformers
- Never: change a running ad set within 72 hours of launch (breaks Meta's learning phase)

---

## Seasonal campaign windows — 2026

| Month | Occasion | Products to lead | Budget increase |
|---|---|---|---|
| August | Raksha Bandhan (Aug 9) | Custom Name Keyring, Ghost Lamp, Bookmarks | +40% for 2 weeks prior |
| October | Navratri / Dussehra | Lamps & Decor, Monstera Coaster Set | +30% |
| November | Diwali (Oct 20) | Ghost Lamp, Snail Lamp, Illuminated Sign | +50% for 3 weeks prior |
| December | Christmas / Year-end gifts | All products, lean into gift angle | +30% |
| February | Valentine's Day | Tulip Flower, Custom items | +30% for 10 days prior |
| March–April | School farewell season | Custom Name Keyring, Sweeping Nameplate | +25% |

**Raksha Bandhan is the most immediate opportunity.** It's 3 weeks away and LayerWeaver's personalised keychains and custom nameplates are natural gifting choices. Launch a dedicated campaign by Aug 1 at the latest with a "gift for your sibling" angle.

---

## What not to do — lessons from the account history

**Don't boost Instagram posts for sales.** Your 12 post-boost campaigns generated almost zero purchases despite spending ₹7,000+. They optimise for clicks and messages — not purchases. Meta's algorithm never learned to find buyers. Use the budget for purchase-optimised campaigns instead.

**Don't turn off a working purchase campaign.** "Hi Value Sales July" was generating purchases at ₹243 each and was turned off. That's a profitable campaign at ₹472 AOV. The instinct to stop spending when CPP feels high is understandable but costly — let the data run longer before pulling the plug.

**Don't set lifetime budgets on purchase campaigns.** Lifetime budgets cause Meta to spend unevenly and make it hard to compare day-over-day performance. Use daily budgets on all purchase-objective campaigns.

**Don't replicate the 6-month campaign economics.** The ₹93.46 CPP from "New Sales Campaign" was driven by a free gift + free shipping promo. Without that offer, a fresh campaign will land at ₹200–300 CPP initially — that's normal, not a failure.

**Don't run more than 3–4 active ad sets simultaneously** until you have 50+ purchases per month from ads. Splitting budget too thin starves each ad set of the data Meta needs to optimise.

---

## Pre-launch checklist

- [x] Build Custom Audiences in Meta — **done 2026-07-20**
  - [x] "LW - Website Visitors 30d (excl. Purchasers)" — pixel, 30-day window, Purchase event excluded
  - [x] "LW - Instagram Engagers 60d" — @thelayerweaver, 60-day window
  - ~~Jun 23 date-range custom audience~~ — **dropped**: Meta's audience builder only supports rolling windows, not specific date ranges. Audience of ~111 people also too small for a separate campaign (frequency limit hit within days). Campaign 1C removed from plan.
  - **Note on Instagram engager exclusion:** Meta doesn't support pixel-based exclusions inside an Instagram custom audience. Purchaser exclusion for Campaign 1B will be applied at the **ad set level** using the "LW - Website Visitors 30d (excl. Purchasers)" audience in the Exclude field.
- [ ] Wait 24–48 hours for audiences to populate, then confirm size estimates in Audiences tab
- [ ] Confirm Pixel is firing purchase events on Shopify checkout (test with Meta Pixel Helper)
- [ ] Confirm GA4 is receiving purchase events (check GA4 → Events → purchase)
- [ ] Film Ghost Balloon Lamp glow video (Priority 1 creative — 15–30 seconds)
- [ ] Set up UTM naming convention: `?utm_source=facebook&utm_medium=paid&utm_campaign=[campaign-name]`
- [ ] Pause or archive all active Instagram post boosts
- [ ] Switch "Sales Campaign" (currently active, 1 purchase at ₹589 CPP) to a proper ad set structure or pause it

---

*Strategy built from: Shopify analytics (30–60 day window), GA4 Traffic Acquisition report (last 28 days), Meta Ads Manager all-time campaign history (17 campaigns, ₹13,320 total spend, account 204133601493657), and the SEO & Sales Audit (2026-07-20). All data points are from LayerWeaver's actual accounts — no benchmarks or assumptions used where real data was available.*

*Last updated: 2026-07-20 · Hi Value Sales July resumed · Sales Campaign paused · Audiences created · Execution status and Jul 27 review plan added*
