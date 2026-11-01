import { describe, it, expect } from 'vitest';
import { resizedImageUrl, escAttr, truncateWords, fontAwesomeLinkHtml, isoDateOnly, buildSitemapXml, rankTestimonials, shippingPriceFor, isPersonalised, offerShippingAndReturns, buildGoogleFeedXml, ageWarningFor, AGE_WARNING_HANDLES, parseSize, sizeFor, photoId, curatedCustomerPhotos, customerPhotosHtml } from '../scripts/build-shop-utils.js';

// ── resizedImageUrl ───────────────────────────────────────────────────────────

describe('resizedImageUrl', () => {
  it('appends width as a query param when the URL has none', () => {
    expect(resizedImageUrl('https://cdn.shopify.com/files/x.png', 500))
      .toBe('https://cdn.shopify.com/files/x.png?width=500');
  });

  it('appends width with & when the URL already has a query string', () => {
    expect(resizedImageUrl('https://cdn.shopify.com/files/x.png?v=123', 900))
      .toBe('https://cdn.shopify.com/files/x.png?v=123&width=900');
  });

  it('passes through falsy input unchanged', () => {
    expect(resizedImageUrl(undefined, 500)).toBeUndefined();
    expect(resizedImageUrl(null, 500)).toBeNull();
    expect(resizedImageUrl('', 500)).toBe('');
  });
});

// ── escAttr ───────────────────────────────────────────────────────────────────

describe('escAttr', () => {
  it('escapes double quotes so attribute values cannot be broken out of', () => {
    expect(escAttr('Say "hi"')).toBe('Say &quot;hi&quot;');
  });

  it('escapes angle brackets so markup cannot be injected', () => {
    expect(escAttr('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escAttr('Salt & Pepper')).toBe('Salt &amp; Pepper');
  });

  it('normalizes em dashes to hyphens', () => {
    expect(escAttr('3D printed — handcrafted')).toBe('3D printed - handcrafted');
  });

  it('coerces non-string input to string', () => {
    expect(escAttr(42)).toBe('42');
  });
});

// ── truncateWords ─────────────────────────────────────────────────────────────

describe('truncateWords', () => {
  it('returns strings at or under the budget unchanged', () => {
    expect(truncateWords('Short description.', 150)).toBe('Short description.');
  });

  it('cuts at the last full word under the budget and appends an ellipsis', () => {
    const str = 'This is a long product description that goes on for quite a while';
    const result = truncateWords(str, 20);
    expect(result.length).toBeLessThanOrEqual(21); // 20 + ellipsis char
    expect(result.endsWith('…')).toBe(true);
    expect(str.startsWith(result.slice(0, -1))).toBe(true);
  });

  it('strips a trailing stopword left dangling by the word cut', () => {
    // Cutting at 30 chars lands mid-"or", leaving "...ideal gift or" as the
    // last whole-word chunk - the trailing "or" should be stripped too.
    const str = 'A cute keychain, ideal gift or as a fun desk toy';
    const result = truncateWords(str, 30);
    expect(result).not.toMatch(/\b(a|an|the|or|and|to|in|of|for)…$/i);
    expect(result).toBe('A cute keychain, ideal gift…');
  });

  it('strips multiple chained trailing stopwords', () => {
    // Budget of 22 lands right after "...idea for a" - the loop must strip
    // "a" then "for" in successive passes, not just the last stopword once.
    const str = 'Great gift idea for a wonderful surprise';
    const result = truncateWords(str, 22);
    expect(result).toBe('Great gift idea…');
  });

  it('strips trailing punctuation before appending the ellipsis', () => {
    const str = 'Handcrafted 3D print, lightweight and durable,';
    const result = truncateWords(str, 30);
    expect(result).not.toMatch(/[.,;:-]…$/);
  });
});

// ── fontAwesomeLinkHtml ────────────────────────────────────────────────────────

describe('fontAwesomeLinkHtml', () => {
  const html = fontAwesomeLinkHtml();

  it('preloads the stylesheet and swaps it in via onload', () => {
    expect(html).toContain('rel="preload"');
    expect(html).toContain('as="style"');
    expect(html).toContain(`onload="this.onload=null;this.rel='stylesheet'"`);
  });

  it('includes a noscript fallback so Font Awesome still loads without JS', () => {
    expect(html).toMatch(/<noscript><link rel="stylesheet"[^>]*><\/noscript>/);
  });

  it('carries the integrity/crossorigin attributes on both the preload and fallback links', () => {
    const matches = html.match(/integrity="sha512-[^"]+"/g) || [];
    expect(matches).toHaveLength(2);
    expect(matches[0]).toBe(matches[1]);
    expect(html.match(/crossorigin="anonymous"/g)).toHaveLength(2);
  });

  it('points at the same Font Awesome 6.5.1 CDN URL in both links', () => {
    const matches = html.match(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.5\.1\/css\/all\.min\.css/g) || [];
    expect(matches).toHaveLength(2);
  });
});

// ── isoDateOnly ────────────────────────────────────────────────────────────────

describe('isoDateOnly', () => {
  it('truncates a Shopify updatedAt datetime to just the date', () => {
    expect(isoDateOnly('2026-07-19T14:32:07Z')).toBe('2026-07-19');
  });

  it('returns null for a missing updatedAt so callers can omit <lastmod>', () => {
    expect(isoDateOnly(null)).toBeNull();
    expect(isoDateOnly(undefined)).toBeNull();
    expect(isoDateOnly('')).toBeNull();
  });
});

// ── buildSitemapXml ───────────────────────────────────────────────────────────

describe('buildSitemapXml', () => {
  it('renders <lastmod> for URLs that have one', () => {
    const xml = buildSitemapXml([
      { loc: 'https://www.layerweaver.com/shop/products/cat-cable-clip/', priority: '0.7', changefreq: 'monthly', lastmod: '2026-07-19' },
    ]);
    expect(xml).toContain('<loc>https://www.layerweaver.com/shop/products/cat-cable-clip/</loc><lastmod>2026-07-19</lastmod>');
  });

  it('omits <lastmod> entirely for URLs without one, rather than emitting it empty', () => {
    const xml = buildSitemapXml([
      { loc: 'https://www.layerweaver.com/', priority: '1.0', changefreq: 'weekly', lastmod: null },
    ]);
    expect(xml).toContain('<loc>https://www.layerweaver.com/</loc><changefreq>weekly</changefreq>');
    expect(xml).not.toContain('<lastmod>');
  });

  it('produces a well-formed sitemap document with one <url> per entry', () => {
    const xml = buildSitemapXml([
      { loc: 'https://www.layerweaver.com/', priority: '1.0', changefreq: 'weekly', lastmod: null },
      { loc: 'https://www.layerweaver.com/shop/', priority: '0.9', changefreq: 'daily', lastmod: null },
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });

  it('carries priority and changefreq through unchanged', () => {
    const xml = buildSitemapXml([
      { loc: 'https://www.layerweaver.com/shop/collections/lamps-and-decor/', priority: '0.8', changefreq: 'weekly', lastmod: '2026-07-19' },
    ]);
    expect(xml).toContain('<changefreq>weekly</changefreq><priority>0.8</priority>');
  });
});

// ── rankTestimonials (homepage "What our customers say") ─────────────────────

describe('rankTestimonials', () => {
  const r = (id, rating, words, created_at, photo = false) => ({ id, rating, body: Array(words).fill('word').join(' '), created_at, photo });
  const hasPhoto = x => x.photo;

  it('puts real stories above one-liners, even one-liners with a photo', () => {
    const ranked = rankTestimonials([
      r('nice-with-photo', 5, 3, '2026-08-27', true),
      r('great', 5, 1, '2026-09-03'),
      r('story', 5, 80, '2026-10-01'),
      r('photo-and-text', 5, 27, '2026-08-11', true),
      r('text', 5, 31, '2026-08-05'),
    ], hasPhoto);
    expect(ranked.map(x => x.id)).toEqual(['story', 'photo-and-text', 'text', 'nice-with-photo', 'great']);
  });

  it('ranks fewer stars lower and breaks ties by the newer review', () => {
    const ranked = rankTestimonials([
      r('four-star-story', 4, 40, '2026-09-01'),
      r('older', 5, 30, '2026-07-01'),
      r('newer', 5, 30, '2026-09-01'),
    ], hasPhoto);
    expect(ranked.map(x => x.id)).toEqual(['newer', 'older', 'four-star-story']);
  });
});

// ── Google product data (Oct 25, 2026) ───────────────────────────────────────

describe('shippingPriceFor', () => {
  it('charges ₹49 below ₹299 and nothing from ₹299 (the site\'s shipping rule)', () => {
    expect(shippingPriceFor('249.00')).toBe(49);
    expect(shippingPriceFor(298.99)).toBe(49);
    expect(shippingPriceFor('299.00')).toBe(0);
    expect(shippingPriceFor(1599)).toBe(0);
  });
});

describe('isPersonalised', () => {
  it('spots personalised and custom-made items by title or tag', () => {
    expect(isPersonalised({ title: 'Personalized Number plate keychain', tags: [] })).toBe(true);
    expect(isPersonalised({ title: 'Name clicker', tags: ['Personalised'] })).toBe(true);
    expect(isPersonalised({ title: 'Ghost balloon lamp', tags: ['lamp'] })).toBe(false);
  });
});

describe('offerShippingAndReturns', () => {
  it('gives Google the shipping rate, delivery time and 7-day returns', () => {
    const o = offerShippingAndReturns('399.00');
    expect(o.shippingDetails.shippingRate).toEqual({ '@type': 'MonetaryAmount', value: '0.00', currency: 'INR' });
    expect(o.shippingDetails.shippingDestination.addressCountry).toBe('IN');
    expect(o.shippingDetails.deliveryTime.handlingTime).toMatchObject({ minValue: 1, maxValue: 2, unitCode: 'DAY' });
    expect(o.shippingDetails.deliveryTime.transitTime).toMatchObject({ minValue: 3, maxValue: 7, unitCode: 'DAY' });
    expect(o.hasMerchantReturnPolicy).toMatchObject({ returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 7, applicableCountry: 'IN' });
    expect(offerShippingAndReturns('199').shippingDetails.shippingRate.value).toBe('49.00');
  });
  it('marks personalised items as not returnable', () => {
    const o = offerShippingAndReturns('499', { personalised: true });
    expect(o.hasMerchantReturnPolicy.returnPolicyCategory).toBe('https://schema.org/MerchantReturnNotPermitted');
    expect(o.hasMerchantReturnPolicy.merchantReturnDays).toBeUndefined();
  });
});

describe('buildGoogleFeedXml', () => {
  const item = { id: '123', title: 'Ghost Balloon Lamp', description: 'Glows — all evening & more <3', link: 'https://www.layerweaver.com/shop/products/ghost-balloon-lamp/', imageLink: 'https://cdn.shopify.com/a.png', extraImages: ['https://cdn.shopify.com/b.png'], price: 399, available: true };
  it('writes one escaped item with price, brand, no GTIN and India shipping', () => {
    const xml = buildGoogleFeedXml([item], { siteUrl: 'https://www.layerweaver.com' });
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('<g:id>123</g:id>');
    expect(xml).toContain('<g:price>399.00 INR</g:price>');
    expect(xml).toContain('<g:availability>in_stock</g:availability>');
    expect(xml).toContain('<g:brand>LayerWeaver</g:brand>');
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>');
    expect(xml).toContain('<g:additional_image_link>https://cdn.shopify.com/b.png</g:additional_image_link>');
    expect(xml).toContain('Glows - all evening &amp; more &lt;3');
    expect(xml).toMatch(/<g:shipping>\s*<g:country>IN<\/g:country>\s*<g:price>0.00 INR<\/g:price>/);
    expect(xml).not.toContain('—');
  });
  it('charges ₹49 shipping on a sub-₹299 item and marks sold-out items', () => {
    const xml = buildGoogleFeedXml([{ ...item, price: 199, available: false }], { siteUrl: 'https://www.layerweaver.com' });
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
    expect(xml).toMatch(/<g:shipping>\s*<g:country>IN<\/g:country>\s*<g:price>49.00 INR<\/g:price>/);
  });
});

// ── ageWarningFor ─────────────────────────────────────────────────────────────

describe('ageWarningFor', () => {
  const LINE = 'Not for children under 5: small parts. Adult supervision recommended.';
  it('gives the plain warning line for listed products', () => {
    for (const h of ['t-rex-skeleton', 'articulated-octopus', 'uno-box', 'night-dragon', 'bird-ocarina']) expect(ageWarningFor(h)).toBe(LINE);
    expect(AGE_WARNING_HANDLES.size).toBe(23);
  });
  it('is empty for keychains, lamps, bookmarks, gift cards and the pen pot box', () => {
    for (const h of ['bunny-keychain', 'chill-guy-lamp', 'cat-bookmark', 'layerweaver-e-gift-card', 'multi-purpose-box-pen-holder-toothbrush-holder']) expect(ageWarningFor(h)).toBe('');
  });
  it('is empty for an unknown or missing handle', () => {
    expect(ageWarningFor('no-such-product')).toBe('');
    expect(ageWarningFor(undefined)).toBe('');
  });
  it('never makes a safety claim', () => {
    expect(LINE).not.toMatch(/safe for|child-safe|non-toxic|\beco|sustainable|PLA|plastic/i);
  });
});

// ── parseSize (Product details box) ───────────────────────────────────────────

describe('parseSize', () => {
  const p = html => parseSize(html);
  it('reads the size a description already states', () => {
    expect(p('<p><strong>Size : 17cm</strong></p>')).toBe('17cm');
    expect(p('<p><strong>Size:</strong> 25 cm</p>')).toBe('25 cm');
    expect(p('<p><strong>Dimensions:</strong> 10 × 20 × 13 cm.</p>')).toBe('10 × 20 × 13 cm');
    expect(p('<p><strong>Length: </strong>15 cm</p>')).toBe('Length 15 cm');
    expect(p('<p><strong>Size</strong>: Measuring approximately <strong>7 cm × 6 cm</strong>,</p>')).toBe('Measuring approximately 7 cm × 6 cm');
  });
  it('keeps every piece of a multi-part size, stops at the next label', () => {
    expect(p('<p><strong>Size : Wingspan 18 cm | nose to tail 11 cm</strong></p>')).toBe('Wingspan 18 cm, nose to tail 11 cm');
    expect(p('<p>Size: Height 3 cm | Width 8 cm | Material: Plant-based filament, 3D printed</p>')).toBe('Height 3 cm, Width 8 cm');
    expect(p('<p><strong>Size:</strong> 9cm | <strong>Material:</strong> Plant-based filament \u00a0|\u00a0 <strong>Great for:</strong> gifts</p>')).toBe('9cm');
    expect(p('<p>Size : Height 8cm | width : 7cm</p>')).toBe('Height 8cm, width: 7cm');
  });
  it('stops at a double-space label', () => {
    expect(p('<p>Size : about 15 x 20 cm &nbsp; &nbsp;Finish : wood brown</p>')).toBe('about 15 x 20 cm');
  });
  it('null when no size is stated: no label, no digit, or Length mid-line', () => {
    expect(p('<p>A great desk toy.</p>')).toBeNull();
    expect(p('<p>Size: large</p>')).toBeNull();
    expect(p('<p>Great for: fans <strong>Length: </strong>15 cm</p>')).toBeNull();
    expect(p('<p>Base: 19 x 22 cm | Height: 25 cm</p>')).toBeNull();
    expect(p('')).toBeNull();
    expect(p(undefined)).toBeNull();
  });
});

// ── Photos from customers: curated by shop/customer-photo-picks.json ───────────

describe('photoId', () => {
  it('is the file name without size, format or query', () => {
    expect(photoId({ original: 'https://review-images.judgeme.com/layerweaver-com/1787421355__1787421337916-86055__original.jpg?quality=80&width=1024' })).toBe('1787421355__1787421337916-86055');
    expect(photoId({ compact: 'https://review-images.judgeme.com/layerweaver-com/1787421355__1787421337916-86055__compact.jpg?width=160' })).toBe('1787421355__1787421337916-86055');
    expect(photoId({})).toBe('');
  });
});

describe('curatedCustomerPhotos', () => {
  const pic = (id, extra = {}) => ({ hidden: false, urls: { compact: `https://x/${id}__compact.jpg`, original: `https://x/${id}__original.jpg` }, ...extra });
  const rev = (rating, pictures, name = 'N') => ({ rating, body: 'b', reviewer: { name }, pictures });
  const reviews = [rev(5, [pic('a'), pic('b')]), rev(4, [pic('c')]), rev(2, [pic('d')]), rev(5, [pic('e', { hidden: true })])];
  it('only the picked photos, in file order, at most 3', () => {
    expect(curatedCustomerPhotos(reviews, ['c', 'a']).map(p => p.id)).toEqual(['c', 'a']);
    expect(curatedCustomerPhotos(reviews, ['a', 'b', 'c', 'd']).map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(curatedCustomerPhotos(reviews, ['a'])[0]).toEqual({ id: 'a', thumb: 'https://x/a__compact.jpg', full: 'https://x/a__original.jpg', rating: 5, name: 'N', body: 'b' });
  });
  it('no picks, missing handle or a bad value: nothing, even when the product has photos', () => {
    for (const picks of [undefined, null, [], {}, 'a', 7]) expect(curatedCustomerPhotos(reviews, picks)).toEqual([]);
    expect(curatedCustomerPhotos(undefined, ['a'])).toEqual([]);
  });
  it('unknown ids and hidden photos are skipped; a low-rated review is allowed when picked', () => {
    expect(curatedCustomerPhotos(reviews, ['zzz', 'e', 'd']).map(p => p.id)).toEqual(['d']);
  });
});

describe('customerPhotosHtml', () => {
  const photos = [{ id: 'a', thumb: 'https://x/a.jpg?w=160', full: 'https://x/a.jpg?w=1024', rating: 5, name: 'N <b>', body: 'say "hi"' }];
  it('nothing for no photos', () => { expect(customerPhotosHtml([], 'Customer photo of X')).toBe(''); });
  it('heading, a viewer-ready button with a fixed-size lazy image, escaped data', () => {
    const html = customerPhotosHtml(photos, 'Customer photo of Floating Cat');
    expect(html).toContain('Photos from customers');
    expect(html).toContain('class="review-strip-photo customer-photo"');
    expect(html).toContain('alt="Customer photo of Floating Cat" width="72" height="72" loading="lazy"');
    expect(html).toContain('data-name="N &lt;b&gt;"');
  });
  it('ends with a See all reviews link to the reviews section, when the row shows', () => {
    const html = customerPhotosHtml(photos, 'a');
    expect(html).toContain('<a href="#customer-reviews" class="customer-photos-all" data-own-scroll>See all reviews</a>');
    expect(html).not.toContain('See all photos');
    expect(html).not.toContain('review-photos');
    expect(customerPhotosHtml([], 'a')).toBe('');            // no row, no link
  });
});

// ── sizeFor (metafield first, description as fallback) ─────────────────────────

describe('sizeFor', () => {
  const html = '<p><strong>Size : 17cm</strong></p>';
  it('the custom.size metafield wins when it has a value', () => {
    expect(sizeFor({ sizeField: { value: '17 cm' }, descriptionHtml: '<p>Size: 20 cm</p>' })).toBe('17 cm');
    expect(sizeFor({ sizeField: { value: '  Regular 10 x 5.5 x 2 cm, Large 14.5 x 8.5 x 3.5 cm ' }, descriptionHtml: '' })).toBe('Regular 10 x 5.5 x 2 cm, Large 14.5 x 8.5 x 3.5 cm');
  });
  it('a missing definition (null field) or empty value falls back to the description', () => {
    expect(sizeFor({ sizeField: null, descriptionHtml: html })).toBe('17cm');
    expect(sizeFor({ descriptionHtml: html })).toBe('17cm');
    expect(sizeFor({ sizeField: { value: '   ' }, descriptionHtml: html })).toBe('17cm');
  });
  it('fallback off: only the metafield counts', () => {
    expect(sizeFor({ sizeField: null, descriptionHtml: html }, { fallback: false })).toBeNull();
    expect(sizeFor({ sizeField: { value: '17 cm' }, descriptionHtml: html }, { fallback: false })).toBe('17 cm');
  });
  it('no size anywhere: null', () => {
    expect(sizeFor({ sizeField: null, descriptionHtml: '<p>A desk toy.</p>' })).toBeNull();
    expect(sizeFor(undefined)).toBeNull();
  });
});
