import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The homepage hero is written by scripts/build-shop.js from HERO_FESTIVE (or the
// evergreen hero when it is null). Checks the built index.html matches the switch,
// and that any price typed into a festive callout matches the built product page.
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const index = read('index.html');
const festiveOn = !/const HERO_FESTIVE = null;/.test(read('scripts/build-shop.js'));
const between = (html, name) => html.split(`<!-- ${name}-START -->`)[1].split(`<!-- ${name}-END -->`)[0];

describe('homepage hero', () => {
  it('has the delivery line and the trust row with the rating badge', () => {
    const left = between(index, 'HERO-LEFT');
    expect(left).toContain('class="hero-delivery"');
    expect(left).toMatch(/class="hero-trust"[\s\S]*HERO-RATING-BADGE-START/);
    expect(index.split('HERO-RATING-BADGE-START').length - 1).toBe(1);
  });

  it('first carousel slide loads first, the rest lazily', () => {
    const imgs = between(index, 'HERO-CAROUSEL-SLIDES').match(/<img [^>]*>/g);
    expect(imgs[0]).toContain('fetchpriority="high"');
    expect(imgs[0]).not.toContain('loading="lazy"');
    expect(imgs.at(-1)).toContain('loading="lazy"');
  });

  if (!festiveOn) {
    it('evergreen hero is built while HERO_FESTIVE is null', () => {
      expect(between(index, 'HERO-HEADER')).not.toContain('hero-eyebrow--festive');
      expect(between(index, 'HERO-LEFT')).not.toMatch(/hero-service-link--/);
    });
    return;
  }

  const left = between(index, 'HERO-LEFT');

  it('festive hero is built while HERO_FESTIVE is set', () => {
    expect(between(index, 'HERO-HEADER')).toContain('hero-eyebrow--festive');
    expect(left).toMatch(/hero-shop-btn--\w+/);
  });

  it('has no em dashes', () => {
    expect(between(index, 'HERO-HEADER') + left).not.toContain('\u2014');
  });

  it('a "from ₹N" price on a product callout is that product\'s lowest price', () => {
    const rows = [...left.matchAll(/href="shop\/products\/([^/]+)\/"[\s\S]*?hero-service-name">([^<]*)</g)];
    for (const [, handle, name] of rows) {
      const from = name.match(/from(?: |&nbsp;)₹([\d,]+)/);
      if (!from) continue;
      // The product's own offers (structured data); data-price also covers related products on the page
      const prices = [...read(`shop/products/${handle}/index.html`).matchAll(/"@type":"Offer","price":"([\d.]+)"/g)]
        .map(m => Number(m[1]));
      expect(prices.length).toBeGreaterThan(0);
      expect(Number(from[1].replace(/,/g, ''))).toBe(Math.min(...prices));
    }
  });
});
