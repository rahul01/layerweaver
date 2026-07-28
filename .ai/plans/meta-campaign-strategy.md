# LayerWeaver — Meta Campaign Strategy
*Built entirely from real account data. No benchmarks or assumptions.*

| | |
|---|---|
| **Account** | Ad Account 204133601493657 · The Layer Weaver |
| **Market** | India (nationwide) · Origin: Pune |
| **Margin** | 42.6% (₹170 profit on Ghost Balloon Lamp at ₹399) |
| **AOV** | ₹472 |
| **Break-even CPP** | ₹170 (single Ghost Lamp) · ₹200 (at AOV) |
| **Pixel** | Connected · layerweavermetapixel (ID: 1677071140197155) |
| **Attribution fixed** | 2026-07-20 — UTMs now attach to Shopify orders |
| **GA4 fixed** | 2026-07-20 — add_to_cart / begin_checkout fire |
| **Last updated** | 2026-07-27 |

---

## Actual business performance — week of Jul 20–26

This is the real baseline. Everything else in this doc is calibrated against it.

| | |
|---|---|
| Revenue | ₹41,368 |
| Gross profit (42.6%) | ₹17,623 |
| Meta ad spend | ₹8,369 |
| Razorpay fees (2%) | ₹827 |
| Shipping gap | ₹191 |
| **Net profit** | **₹8,235** |
| Orders | 67 |
| Meta-attributed orders | 60 of 67 |
| CPP (actual Jul 20–26) | ₹134 |
| ROAS | 5x (break-even is 2.35x) |

**Day-by-day:**

| Date | Orders | Revenue |
|---|---:|---:|
| Jul 20 | 4 | ₹3,886 |
| Jul 21 | 12 | ₹6,641 |
| Jul 22 | 13 | ₹7,775 |
| Jul 23 | 11 | ₹5,458 |
| Jul 24 | 8 | ₹6,530 |
| Jul 25 | 10 | ₹4,719 |
| Jul 26 | 9 | ₹6,707 |
| **Total** | **67** | **₹41,368** |

---

## Product profitability at current CPP (₹134)

Margin is 42.6% across the catalog (extrapolated from Ghost Balloon Lamp: ₹170 profit on ₹399).
Break-even selling price at ₹134 CPP = **₹315**. Any standalone purchase below ₹315 loses money.

| Product | Price | Profit | At ₹134 CPP |
|---|---:|---:|---|
| Keychains / Bookmarks | ₹99–₹149 | ₹42–₹63 | ❌ -₹71 to -₹92 |
| Fidgets / Clickers | ₹199 | ₹85 | ❌ -₹49 |
| T-rex / Octopus / Spider | ₹249 | ₹106 | ❌ -₹28 |
| WASD Keychain | ₹349 | ₹149 | ✅ +₹15 |
| Ghost Lamp / Dino Box / Penguin | ₹399 | ₹170 | ✅ +₹36 |
| Night Dragon | ₹599 | ₹255 | ✅ +₹121 |
| Sweeping Sign Nameplate | ₹899 | ₹383 | ✅ +₹249 |
| Octopus / Snail Lamp | ₹1,599–₹1,899 | ₹681–₹809 | ✅ +₹547–₹675 |
| Illuminated Sign Board | ₹3,500 | ₹1,491 | ✅ +₹1,357 |

**Action:** Set minimum price filter on catalog ad to ₹399. At current CPP, showing ₹99–₹249 products wastes ad spend — those items are loss-making as first-purchase, solo items. Multi-item orders save this (two sub-₹299 items together can still be profitable) but the algorithm won't know that.

---

## Shipping economics (actual data)

Carrier: Delhivery. Origin: Pune.

| Zone | Shipping cost | Orders (Jul 20–26) | Share |
|---|---:|---:|---:|
| Pune / Mumbai metro | ₹44 | 26 | 39% |
| Rest of India (Surface) | ₹57 avg | 23 | 35% |
| Rest of India (Express) | ₹65 avg | 16 | 24% |
| Remote / NE India | ₹77 | 2 | 3% |

**Recovery logic:**
- Products priced ≥₹299: ₹50 built into selling price per unit
- Orders below ₹299 total: customer pays ₹49 flat
- Multi-item orders where each item ≥₹299: recovers ₹50 per item (one shipment) — these are shipping-profitable

**Net shipping gap Jul 20–26: ₹191** (~₹27/day). Not worth optimising further.

**Known unrecovered cases:** Orders where all items are below ₹299 but combined total exceeds ₹299 (e.g. 2× T-rex ₹249 = ₹498 → free shipping, ₹0 recovery). Deliberate business decision to absorb.

---

## Campaign status — Jul 27 checkpoint (7-day review)

### Hi Value Sales July (active)
- Budget: ₹1,000/day · End date: Jul 31, 2026 ⚠️ needs extension
- Type: Advantage+ Sales · Conversion: Purchase · No cost cap
- Creative: Catalog carousel · Copy: "3D printed in Pune. Free shipping above ₹299."
- 30-day: 71 purchases · ₹151 CPP · ₹10,732 spent
- Jul 20–26: 60 purchases · ₹134 CPP · ₹8,369 spent · ROAS 5x
- Unpublished edit sitting on ad: "Multi-advertiser ads: On" → **Discard this**

### Sales Campaign (paused)
Keep paused. 3 purchases at ₹589 CPP lifetime. Audience overlaps with Hi Value Sales July — running both bids against itself.

### Instagram post boosts (12 campaigns, all off or completed)
Do not revive. Combined spend ₹7,000+, near-zero purchases. They optimise for clicks and messages, not buyers.

---

## What to do today — Jul 27

**1. Discard unpublished edit on JULY Sales Ad**
Multi-advertiser ads shows your ad in a cluttered multi-brand unit. Discard it — it wasn't intentionally set.

**2. Increase daily budget to ₹1,200**
CPP ₹134 < ₹300 threshold → 20% increase per the plan. At 42.6% margin and ₹472 AOV, every ₹200 more daily spend yields ~₹65 net profit per day.

**3. Extend campaign end date**
Jul 31 is 4 days away. Extend to Aug 31 to cover Raksha Bandhan and beyond.

**4. Add catalog minimum price filter**
Edit the ad set → Catalog → add price filter ≥₹399. Stops the algorithm serving ₹99–₹249 items as lead products.

**5. Top up Meta balance — urgent**
₹3,699 remaining at ₹1,200/day = ~3 days. Add ₹10,000. If ads pause even for a day, Meta's learning resets.

**6. Complete GST verification in Meta billing**
Billing page is prompting for GSTIN. Unverified = account restriction risk.

**7. Exclude retargeting audiences from Hi Value Sales July before launching retargeting**
Advantage+ will retarget your warm audiences unless explicitly excluded. Add both as exclusions on Ad Set 1:
- "LW - Website Visitors 30d (excl. Purchasers)"
- "LW - Instagram Engagers 60d"
This cleanly separates prospecting from retargeting — no self-competition in the auction.

**8. Fix Razorpay webhook**
Razorpay Dashboard → Settings → Webhooks → confirm `payment.captured` is active and endpoint is live.
At least 3 confirmed webhook failures in 2 weeks. Each one is a potential lost order that requires manual draft order intervention.

---

## Phase 1 — Retargeting (launch today after exclusions are set)

Check audience sizes in Meta Audiences tab first. If "LW - Website Visitors 30d" is still "Below 1000", switch to 90-day retention before launching Campaign 1A.

### Campaign 1A — Website visitor retargeting
- Objective: Sales (Purchase)
- Audience: "LW - Website Visitors 30d (excl. Purchasers)" — or 90d if below 1000
- Budget: ₹150/day
- Creative: Single image — Ghost Balloon Lamp glowing
- Copy: "Still thinking about it? Free shipping on orders above ₹299."
- Expected CPP: ₹80–140 (warm audience converts cheaper)

### Campaign 1B — Instagram engager retargeting
- Objective: Sales (Purchase)
- Audience: "LW - Instagram Engagers 60d" — exclude purchasers **at ad set level** using "LW - Website Visitors 30d (excl. Purchasers)" in the Exclude field (Meta doesn't support pixel exclusions inside Instagram audiences)
- Budget: ₹100/day
- Creative: Reel or carousel — top 3 products by revenue (Ghost Lamp, Dino Box, Night Dragon)
- Copy E: "You've seen what we make. Here's the part you might have missed: free shipping on every order above ₹299, easy returns, and custom orders available via WhatsApp. The Ghost Balloon Lamp is still in stock. ₹399."
- Expected CPP: ₹80–150

**Total Phase 1 budget: ₹250/day additional (₹1,200 prospecting + ₹250 retargeting = ₹1,450/day total)**

---

## Copy testing — do this in Week 3, not now

The current catalog ad has no primary text and converts at ₹134 CPP. Don't introduce a variable while it's learning and delivering.

When ready (Week 3, after retargeting is stable):
- Use Meta's built-in **A/B test tool** (the button in Ads Manager) — not manual campaign duplication
- Manual duplicates cause auction overlap: both campaigns bid against each other, inflating CPM on both
- Meta's A/B test splits audience at user level — clean data, no overlap
- Test variable: Creative (Copy A vs Copy B)
- Budget: equal split, minimum 7 days, let Meta declare a winner

**Copy B (challenger — add as primary text to duplicate):**
> This lamp costs ₹399 and people keep asking us where we got it.
> It's 3D printed in Pune — eco-friendly PLA, designed in-house. The ghost balloon glows. Ships anywhere in India. Free shipping above ₹299.
> 200+ happy customers. Easy returns.
> Shop the Ghost Balloon Lamp →

---

## Phase 2 — Raksha Bandhan (Aug 9) — launch by Aug 1

This is the most time-sensitive opportunity. 13 days away. Custom name keychains, sweeping nameplates, and personalised items are natural sibling gifts. You need 5–7 days of Meta learning before the campaign performs, so Aug 1 is the hard deadline to launch.

### Raksha Bandhan campaign
- Objective: Sales (Purchase)
- Audience: Advantage+ or cold interest — gifting (birthday gifts, unique gifts, siblings, Rakhi)
- Budget: ₹500/day for 2 weeks (Aug 1–15)
- Products to feature: Custom Name Keyring (₹149), Sweeping Sign Nameplate (₹899), Ghost Balloon Lamp (₹399)
- Copy angle: "Gift for your sibling that's actually unique. Custom 3D printed, made in Pune, ships in 3 days."
- Creative: Product photos of personalised items with name examples
- Note: ₹149 Custom Name Keyring is below break-even CPP as a solo item but serves as a low-barrier entry — upsell with bundles or nameplate

---

## Phase 2 — Cold traffic scaling (Week 3–6)

Only after Hi Value Sales July has run 7+ more days post-budget-increase and retargeting is live.

### Campaign 2A — Ghost Balloon Lamp cold (hero campaign)
- Objective: Sales (Purchase)
- Audience: Cold interest — Gifts, birthday gifts, home décor, unique gifts, 3D printing, online shopping
- Age: 22–40, all genders, India nationwide
- Budget: ₹300/day
- Creative: Ghost Balloon Lamp glow Reel (Priority 1 — see Creative section)
- Do not touch for 7 days after launch

### Campaign 2B — Purchaser lookalike
- Build once you have 100+ purchasers on a customer list
- Upload list to Meta → create 1% Lookalike
- Budget: ₹200/day
- Same creative as 2A

**CPP rules for Phase 2:**
- CPP < ₹170 (below single Ghost Lamp profit): increase budget 20% every 4 days
- CPP ₹170–200: hold, watch creative
- CPP > ₹200 for 5+ days: pause ad set, change audience or creative

---

## Creative — what to actually make (priority order)

### Priority 1: Ghost Balloon Lamp glow Reel — make this first
The single highest-leverage asset. Nothing else comes close.
- 15–30 seconds
- Shot 1: lamp off, daylight — looks like a normal object
- Shot 2: lights off, lamp on — ghost glows
- Shot 3: someone's face reacting (optional but powerful)
- No voiceover needed. Text overlay: "3D printed in Pune. Glows like magic."
- End card: "Ghost Balloon Lamp · ₹399 · Free shipping above ₹299 · layerweaver.com"
- This is what unlocks Phase 2 cold traffic at scale

### Priority 2: Raksha Bandhan creative (needed by Aug 1)
- Show the Custom Name Keyring or Sweeping Sign being personalised
- "Put their name on it. Ships in 3 days."
- Static image or 15s Reel

### Priority 3: Brand story Reel (TOFU for Phase 2)
- 30–45 seconds
- Open with Raghav inspecting a finished product: "Is this cool enough?"
- Show 5–6 products being made or finished
- Close: "LayerWeaver. Made in Pune, layer by layer."
- This is the differentiation ad nobody else can replicate

### Priority 4: Desk aesthetic flat-lay (tech/gaming audience)
- Single image: WASD Keychain, Keyboard Clicker, Night Dragon, Hoodie Pen Pot
- Clean background, well-lit
- "Your desk deserves better than boring."

---

## Ad copy — ready to use

### Copy A — Story (for brand Reel, cold audiences)
> Our 8-year-old has one quality check: "Is this cool enough?"
>
> LayerWeaver is a family 3D printing studio in Pune. Every lamp, keychain, and fidget we make started as Raghav's idea — or passed his inspection before it didn't.
>
> Eco-friendly. Handcrafted. Delivered across India. Free shipping above ₹299.
>
> 👉 Shop now → layerweaver.com

### Copy B — Product / direct (Ghost Balloon Lamp — A/B test challenger)
> This lamp costs ₹399 and people keep asking us where we got it.
>
> It's 3D printed in Pune — eco-friendly PLA, designed in-house. The ghost balloon glows. Ships anywhere in India. Free shipping above ₹299.
>
> 200+ happy customers. Easy returns.
>
> Shop the Ghost Balloon Lamp →

### Copy C — Gift angle (gifting audiences)
> The gift they'll actually keep using.
>
> Unique 3D printed gifts from LayerWeaver — starting at ₹99. Lamps, keychains, desk toys, bookmarks, custom nameplates, fidgets.
>
> Made in Pune. Ships across India. Free shipping above ₹299.
>
> 👉 Find the perfect gift →

### Copy D — Raksha Bandhan
> They'll remember this one.
>
> Custom 3D printed gifts for your sibling — name keychains, glowing lamps, personalised nameplates. Made in Pune, ships in 3 days. Free shipping above ₹299.
>
> Order by Aug 7 to arrive before Raksha Bandhan.
>
> 👉 Shop Rakhi gifts →

### Copy E — Retargeting (warm audiences only)
> You've seen what we make. Here's the part you might have missed: free shipping on every order above ₹299, easy returns, and custom orders via WhatsApp.
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
- "Gift for Rakhi That Ships in 3 Days"

---

## Audience targeting — cold traffic

**Primary (Ghost Balloon Lamp / Gifting)**
- Age: 22–40, all genders, India nationwide
- Interests: Gifts, birthday gifts, unique gifts, home décor, 3D printing, Etsy, online shopping
- Behaviour: Online shoppers, Engaged shoppers

**Secondary (Desk / Tech)**
- Age: 18–35, skew male
- Interests: Mechanical keyboards, PC build, gaming setup, desk accessories, tech gadgets
- Products: WASD Keychain, Keyboard Clicker, Night Dragon, Hoodie Pen Pot

**Secondary (Book lovers)**
- Age: 18–38, skew female
- Interests: Reading, books, Kindle, BookTok, bibliophiles
- Products: Page Pals bookmarks (Cat, Dog, Butterfly)

**Secondary (Parents / STEM)**
- Age: 28–45, parents
- Interests: Kids toys, STEM education, Lego, school activities
- Products: T-rex Skeleton, Articulated Octopus, Panda Figurine, Fidgets
- Hook: Raghav's story lands immediately with this audience

**Secondary (Aquarium)**
- Age: 22–45
- Interests: Aquarium, fish keeping, aquascaping, planted tanks
- Products: Aquarium Cave, Feeding Ring, 120mm Fan
- Small but ultra-targeted, very low CPM, high intent

---

## Budget plan

| Phase | Period | Daily budget | Total |
|---|---|---:|---:|
| Hi Value Sales July (current) | Now | ₹1,200/day | — |
| Retargeting 1A + 1B | Now | ₹250/day | — |
| Raksha Bandhan campaign | Aug 1–15 | ₹500/day | ₹7,500 |
| Phase 2 cold + lookalike | Week 3+ | ₹500/day | — |
| **Total at full Phase 2** | | **~₹2,000/day** | — |

Start with ₹1,450/day (existing + retargeting). Add Raksha Bandhan separately. Phase 2 cold traffic only after Ghost Lamp Reel creative is ready.

**CPP decision rules (Hi Value Sales July):**
- CPP < ₹170: increase budget 20% every 4 days
- CPP ₹170–200: hold budget
- CPP > ₹200 for 5+ days: pause, review creative or catalog filter

---

## Seasonal windows — 2026

| Date | Occasion | Products | Action |
|---|---|---|---|
| Aug 9 | Raksha Bandhan | Custom Name Keyring, Sweeping Sign, Ghost Lamp | Launch by **Aug 1** |
| Oct 20 | Diwali | Ghost Lamp, Snail Lamp, Illuminated Sign | +50% budget, launch Oct 1 |
| Oct–Nov | Navratri / Dussehra | Lamps & Decor, Monstera Coaster Set | +30% budget |
| Dec | Christmas / Year-end | All products, gift angle | +30% budget |
| Feb 14 | Valentine's Day | Tulip Flower, Custom items | +30%, 10 days prior |
| Mar–Apr | School farewell | Custom Name Keyring, Sweeping Nameplate | +25% |

---

## What to measure

| Metric | Where | Target |
|---|---|---|
| CPP | Meta Ads Manager | < ₹170 (break-even) · < ₹134 (current) |
| ROAS | Meta Ads Manager | > 2.35x (break-even) · 5x (current) |
| CTR | Meta Ads Manager | > 1.5% |
| CPC | Meta Ads Manager | < ₹8 |
| Net profit/week | Manual P&L | > ₹8,235 (current baseline) |
| Returning customer rate | Shopify analytics | Target 10%+ by Month 3 |

**Check cadence:**
- Daily: spend vs budget, CPP (watch only — don't change)
- Every 4 days: budget adjustment decision (±20% max)
- Weekly: P&L (revenue × 42.6% − ad spend − Razorpay 2% − shipping gap)
- Never: edit a running ad set within 72 hours of launch

---

## Ops — ongoing issues

**Razorpay webhook (fix immediately)**
Razorpay → Settings → Webhooks → confirm `payment.captured` is active.
3 confirmed failures in 2 weeks. Each failure requires manual draft order intervention and risks losing the customer if they don't respond.
Known affected: kranti0787@gmail.com (₹298, Jul 21, pay_TGCPatOWpoQ3Cj) — awaiting customer response.

**Desiree Dsa (shireen.jamooji) — 2× ₹248 charged**
Orders #1120 and #1121, 3 minutes apart, Jul 22. Confirm with customer if both intentional. Refund one if accidental.

**Draft order protocol (current workaround)**
When webhook fails: create draft order in Shopify, mark as paid, add Razorpay payment ID in notes.
The draft order does not create a double charge — it is the order record for an already-captured payment.
Note Razorpay transaction ID in draft order notes for reconciliation.

---

## What not to do

**Don't boost Instagram posts for sales.** 12 post-boost campaigns, ₹7,000+ spent, near-zero purchases. They optimise for clicks and messages — Meta's algorithm never learns to find buyers. Every rupee of boost budget belongs in purchase-optimised campaigns.

**Don't duplicate campaigns for A/B testing.** Manual duplicates compete in the same auction, inflating CPM on both. Use Meta's built-in A/B test tool.

**Don't turn off a working purchase campaign.** Hi Value Sales July was paused once despite profitable CPP. Don't pause unless CPP exceeds ₹200 for 5+ consecutive days.

**Don't set lifetime budgets on purchase campaigns.** Causes uneven spend and makes day-over-day comparison impossible. Daily budgets on everything.

**Don't run more than 3–4 active ad sets simultaneously** until you have 50+ purchases per month from ads. Splitting budget thin starves Meta's optimisation algorithm.

**Don't change a running ad set within 72 hours of launch.** Resets the learning phase. Set it and leave it.

**Don't scale budget more than 20% at a time.** Larger jumps also reset learning.

---

## What the data actually says

**The funnel works.** Meta drives 82.5% of your sessions (GA4). The store converts. Traffic is the ceiling.

**42.6% gross margin at ₹472 AOV with ₹134 CPP = ₹50 net profit per acquisition from ads.** At ₹1,200/day, you're generating roughly 9 purchases/day from ads at ~₹450 daily profit on ad spend alone — before the 7 organic orders per week that cost nothing.

**WhatsApp custom orders (~₹9,825/month) are invisible to Meta.** Customers who find you through an ad and order a custom build over WhatsApp look like ROAS 0 in the ad account. Your true ROAS is higher than 5x. This makes the ₹134 CPP even more profitable than it appears.

**The Ghost Balloon Lamp is the franchise product.** It's your top seller, your most shareable item, and the one product that photographs itself. Every other campaign decision should orbit around it until you have strong Reel creative for something else.

---

*Sources: Shopify orders #1100–#1170 (Jul 19–26 IST), Delhivery shipment export (Jul 20–27), Meta Ads Manager account 204133601493657 (Jul 20–26 date range), GA4 Traffic Acquisition (last 28 days), Razorpay transaction data (Jul 12–26). All numbers from LayerWeaver's actual accounts.*

*Last updated: 2026-07-27 · 7-day checkpoint complete · Budget increase to ₹1,200 confirmed · Retargeting ready to launch*
