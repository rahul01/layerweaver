# Cloudflare Migration Plan (DNS, apex HTTPS, redirects, registrar)

Written 2026-09-26. Covers layerweaver.com, anubiastech.com and printpricepro.com. All three are currently registered at GoDaddy, with DNS on GoDaddy nameservers, and served by GitHub Pages (`www`) plus Shopify (`shop`, `account` on layerweaver only).

## Why

1. **Apex HTTPS is broken.** `https://<apex>` shows a certificate error on all three domains. GitHub Pages certificates only cover `www`, because they were issued while the apex was still on GoDaddy forwarding, and GitHub won't reissue them (see memory note `project_apex_https_certs.md`; a GitHub Support ticket was sent 2026-09-26). Cloudflare can serve the apex with its own certificate and redirect to `www`, without depending on GitHub.
2. **No real redirects on GitHub Pages.** Dead URLs (retired products, the Rakhi catalogue) return 404, and Search Console reports them. Real 301s need either Cloudflare in front of `www` or Cloudflare Pages hosting (Phase 4).
3. **No control over headers.** GitHub Pages sends `Cache-Control: max-age=600` on everything and no security headers. Changing that needs the same thing as point 2.
4. **DNS management.** GoDaddy's DNS API is restricted for small accounts, so every DNS change has been a manual click-through. Cloudflare has a free API, so Claude can make and verify changes with approval.
5. **Renewal cost.** Cloudflare Registrar renews at cost. This is low priority: all three domains are paid until late 2027.

## Current state (verified 2026-09-26)

| | layerweaver.com | anubiastech.com | printpricepro.com |
|---|---|---|---|
| Nameservers | ns43/ns44.domaincontrol.com | ns55/ns56.domaincontrol.com | ns09/ns10.domaincontrol.com |
| DNSSEC (DS at registry) | none | none | none |
| Registry expiry | 2027-12-19 | 2027-11-01 | 2027-12-19 |
| GitHub Pages repo | rahul01/layerweaver | rahul01/AnubiasTech | rahul01/PrintPriceProSite |
| Email | Google Workspace | Google Workspace | none (no MX) |

No DNSSEC means the nameserver change needs no DS-record handling.

### DNS records found by `dig` (not guaranteed complete)

Export the full zone from GoDaddy before starting (DNS page → Actions/Import-Export → Export Zone File, if the option is shown; otherwise screenshot every page of records). The GoDaddy UI showed 17 records for anubiastech.com, but `dig` can only find the names it asks for.

**layerweaver.com**

| Name | Type | Value | Cloudflare proxy |
|---|---|---|---|
| @ | A x4 | 185.199.108.153, .109, .110, .111 | **Proxied** (see Phase 1) |
| @ | MX | 1 aspmx.l.google.com, 5 alt1/alt2, 10 alt3/alt4 .aspmx.l.google.com | n/a |
| @ | TXT | `google-site-verification=zEOSDgAKZcp19LJeRTW4HLKvMvwodD3GcoPM1AUciWg` (Search Console) | n/a |
| @ | TXT | `facebook-domain-verification=dwlm8khhio621mu2ofakxohm20tkzy` (**Meta ads/pixel, must not be lost**) | n/a |
| @ | TXT | SPF, see "SPF gotcha" below | n/a |
| www | CNAME | rahul01.github.io | **DNS only** |
| shop | CNAME | shops.myshopify.com | **DNS only** (Shopify does not support the proxy) |
| account | CNAME | shops.myshopify.com | **DNS only** |
| google._domainkey | TXT | Google DKIM key (copy the whole value, it's split into 2 strings) | n/a |
| _dmarc | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | n/a |
| dc-aa8e722993._spfm | TXT | `v=spf1 include:_spf.google.com ~all` (GoDaddy artifact) | drop, see below |
| _domainconnect | CNAME | _domainconnect.gd.domaincontrol.com (GoDaddy-only) | **drop** |

**anubiastech.com:** same pattern, minus Shopify and Meta:
- @ A x4 (GitHub IPs), plus Google MX x5
- two `google-site-verification` TXT values: `4Uny1bfQ8JhZncb6WrWjub27Jf7Kx9e57sq_fd1rnGg`, `qJ6Gma-JueycffiSowEMflxTcX4ZYZFvSGJ66DxkvVk`
- SPF, `www` CNAME, `_dmarc`, `_spfm`, `_domainconnect`
- No DKIM found under the `google` selector. Check the Google Workspace admin to see which DKIM selector is in use, if any.

**printpricepro.com:** @ A x4, `www` CNAME, `_dmarc`, `_domainconnect`. No MX, no SPF.

### SPF gotcha

The SPF records are `v=spf1 include:dc-aa8e722993._spfm.<domain> ~all`. That `_spfm` name is GoDaddy's managed-SPF record, and it will not exist after the move unless it's copied. Replace the SPF record with the direct version instead:

```
v=spf1 include:_spf.google.com ~all
```

This is exactly what the `_spfm` record contains, so email authentication doesn't change.

### DMARC

`rua=mailto:dmarc_rua@onsecureserver.net` sends DMARC reports to GoDaddy's reporting service. Keep it as-is during the move (it's just an email address). Decide later whether to point reports to your own mailbox or a free DMARC report service.

## Phase 0: Prep (about 30 min, no risk)

1. Create a free Cloudflare account (use the same Google account as Workspace/Search Console).
2. Export or screenshot all GoDaddy DNS records for each domain (see above).
3. Confirm GoDaddy **domain forwarding** is off for all three (it was removed on 2026-09-23 for layerweaver and anubiastech; check printpricepro).
4. If GitHub domain verification (`_github-pages-challenge-rahul01` TXT) has been added by then, include it in the record list.
5. Pause Meta ads or accept the risk only for the layerweaver step (Phase 1c). Not needed for the other two domains.

## Phase 1: Move DNS to Cloudflare, one domain at a time

Order: **anubiastech.com → printpricepro.com → layerweaver.com**, at least a day apart, so problems surface on low-traffic domains first. For each domain:

### Steps

1. **Add the site** in Cloudflare (Free plan). Let it scan the existing records.
2. **Reconcile the records** against the inventory above:
   - add anything the scan missed (especially DKIM, the verification TXTs, and `account` on layerweaver),
   - replace SPF with `v=spf1 include:_spf.google.com ~all`,
   - delete `_domainconnect` and `dc-aa8e722993._spfm`,
   - set the proxy status exactly as in the table: only `@` is proxied; `www`, `shop` and `account` are DNS only.
3. **Apex redirect** (Rules → Redirect Rules, or the "Redirect from root to WWW" template):
   - When: hostname equals `<domain>`
   - Then: dynamic 301 to `concat("https://www.<domain>", http.request.uri.path)`, with **preserve query string** on.
4. **SSL/TLS settings:** turn on "Always Use HTTPS". Mode "Full" is fine; the apex never reaches the origin because the redirect fires at the edge. Leave "Bot Fight Mode" **off** (it can block Googlebot, Meta's crawler, Shopify and Judge.me).
5. **Check the Cloudflare zone before switching.** Claude runs `dig` against the Cloudflare nameservers Cloudflare assigns (for example `dig @<name>.ns.cloudflare.com <record>`) for every record, and diffs the results against GoDaddy's answers. **Do not switch until they match.**
6. **Switch nameservers at GoDaddy:** Domain → DNS → Nameservers → "I'll use my own nameservers" → enter the two Cloudflare names. **Do not delete the GoDaddy DNS zone.** It's the rollback.
7. **Wait for Cloudflare to show "Active"** (usually under an hour; .com NS changes can take up to 48 hours, and both sets of nameservers answer the same thing in the meantime because the zones match).

### Verify (Claude runs these after "Active")

```
dig +short NS <domain>                          # Cloudflare names
curl -sI https://<domain>/some/path             # 301 -> https://www.<domain>/some/path, valid cert
curl -sI http://<domain>/some/path              # 301 -> https://www...
curl -sI https://www.<domain>/                  # 200, still GitHub's certificate
dig +short MX <domain>; dig +short TXT <domain> # unchanged apart from SPF
```

Plus, per domain:
- **Email:** send a test email in and out. Check the headers show `spf=pass`, `dkim=pass`, `dmarc=pass`.
- **layerweaver only:**
  - `https://shop.layerweaver.com` and `https://account.layerweaver.com` load (Shopify certificates valid),
  - place a test order up to the payment step,
  - Meta Events Manager still shows the domain as verified,
  - the Search Console property is still verified.

### What changes on the GitHub side

With the apex proxied, GitHub's Pages health check will see Cloudflare IPs for the apex and may report the alt domain as not pointing to GitHub. That's expected and harmless: GitHub keeps issuing and renewing the `www` certificate, which is all it serves. Don't "fix" it.

### Rollback (any domain, any time in the first two weeks)

At GoDaddy, set the nameservers back to "GoDaddy default". The old zone takes over again within the NS TTL. After two stable weeks, the GoDaddy zone can be left as-is; it's harmless.

## Phase 2: Dead URL redirects (layerweaver)

Candidates from Search Console and git history (deleted pages):

| Old URL | Suggested target |
|---|---|
| /shop/rakhi/ and /shop/rakhi/* (8 persona pages, removed 2026-09-25) | /shop/ |
| /shop/products/120mm-5-aquarium-fan/ | the aquarium collection, or /shop/ |
| /shop/products/aquarium-feeding-plant-ring-20cm/ | the aquarium collection, or /shop/ |
| /shop/products/spiral-connect-4/ | /shop/ (or a games collection) |
| /shop/products/zigizigi-fidget/ | a fidget collection, or /shop/ |
| /shop/products/cat-bookmark-copy/ | /shop/products/cat-bookmark/ |
| /shop/products/floating-ghost-lamp-with-balloon-3d-printed-led-tea-light-decor/ | /shop/products/ghost-balloon-lamp/ |
| /shop/products/monsterra-keychain/ | /shop/products/monstera-keychain/ |
| /shop/products/panda/ | /shop/products/panda-figurine/ |
| /shop/products/vases/ | /shop/products/decorative-vases/ |
| /shop/collections/custom-branding-displays/, /shop/collections/yarn/ | /shop/ |

Confirm each target exists before adding it. Rakhi URLs could instead point to a gifting collection if one exists.

**How:** Cloudflare can only redirect `www` URLs if `www` goes through Cloudflare (Phase 4). Until then, there are two options:
- **(a) Meta-refresh stubs** generated by `scripts/build-shop.js`: a small HTML page at each old path with `<meta http-equiv="refresh" content="0; url=...">` and `<link rel="canonical" href="...">`. Google treats these much like a 301. Works today, on GitHub Pages.
- **(b) Wait for Phase 4** and use a `_redirects` file with real 301s.

Recommendation: do (a) now, since it's a small build-script change, and convert it to (b) if Phase 4 happens.

## Phase 3: Transfer registrations to Cloudflare Registrar (optional, low priority)

- **Eligible:** all three domains are past the 60-day transfer lock (registered 2025-11/12).
- **Cost/benefit:** a transfer adds one year to the registration, charged at Cloudflare's at-cost price. Renewals after that are cheaper than GoDaddy's. Because all three are paid until late 2027, there's no urgency. A good time is in 2027, a few months before expiry.
- **Steps:**
  1. At GoDaddy: unlock the domain and get the auth/EPP code (and turn off GoDaddy "domain privacy" add-ons if they block transfer).
  2. In Cloudflare: Domain Registration → Transfer.
  3. Approve the transfer email.
  4. Transfers take up to 5 days. DNS is unaffected, because it's already on Cloudflare.
- Cancel GoDaddy auto-renew and any GoDaddy add-ons (email forwarding, SSL, website builder) only after the transfer completes.

## Phase 4: Optional, host layerweaver on Cloudflare Pages

Only after Phase 1 has been stable for a few weeks. This replaces GitHub Pages for `www.layerweaver.com`:

- **Gains:**
  - certificates for the apex and `www` managed automatically,
  - real 301s via `_redirects`,
  - cache and security headers via `_headers` (long cache for `images/`, CSS and JS; HSTS),
  - serving from Cloudflare's Indian locations.
- **How:**
  - Connect the GitHub repo in Cloudflare Pages, with no build command (the build output is already committed) and `/` as the output directory.
  - Deploys happen on every push to `main`, same as now.
  - Add `www.layerweaver.com` as the custom domain.
  - Once it's live, turn off GitHub Pages for the repo and delete `CNAME`.
- **Check before switching:**
  - `404.html` handling,
  - trailing-slash behaviour (GitHub Pages 301s `/shop` to `/shop/`; Cloudflare Pages has its own rules, so compare with `curl` on a preview URL),
  - the `app-release.apk` download,
  - `manifest.json`.
- **Alternative (not recommended):** keep GitHub Pages and set `www` to Proxied. That gives redirects and headers too, but GitHub can then no longer renew its `www` certificate (it sees Cloudflare IPs), which forces SSL mode "Full" (not strict) and leaves a quietly expiring certificate behind the proxy.

anubiastech.com and printpricepro.com can stay on GitHub Pages indefinitely. Phase 1 already fixes their only problem.

## Risks

| Risk | Mitigation |
|---|---|
| A record missed during import (email, Shopify, Meta verification) | Zone export + dig-diff against Cloudflare nameservers before switching (Phase 1, step 5) |
| Shopify or `www` accidentally proxied | Proxy status table above; verify with `dig` (a proxied record returns Cloudflare IPs instead of the CNAME target) |
| SPF breaks because `_spfm` is gone | Replace with direct `include:_spf.google.com` |
| Cloudflare outage | Affects only the proxied apex until Phase 4. `www` and Shopify are DNS only |
| Occasional Indian ISP blocks of shared Cloudflare IPs | Same scope as above; only the apex redirect is proxied |
| Bot protection blocking crawlers | Keep Bot Fight Mode off; don't add WAF challenges on `/shop/` |

## Open decisions

- [ ] Do Phase 2 option (a) now, or wait for Phase 4?
- [ ] Which gifting/aquarium/fidget collection each dead URL should redirect to.
- [ ] DMARC reports: keep GoDaddy's `onsecureserver.net` address or switch.
- [ ] Phase 4 (Cloudflare Pages for layerweaver): yes/no after Phase 1 is stable.
- [ ] If GitHub Support fixes the certificates first, Phase 1 is still worth doing for DNS management and Phase 2/4, but it stops being urgent.
