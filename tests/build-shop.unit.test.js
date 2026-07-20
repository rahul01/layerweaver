import { describe, it, expect } from 'vitest';
import { resizedImageUrl, escAttr, truncateWords, fontAwesomeLinkHtml, isoDateOnly, buildSitemapXml } from '../scripts/build-shop-utils.js';

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
