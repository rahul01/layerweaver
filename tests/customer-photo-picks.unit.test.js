import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// shop/customer-photo-picks.json: { handle: [photo id, ...] }, max 3 per product, and every id
// must be a real photo on that product's page (ids as photoId() in build-shop-utils.js).
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const picks = JSON.parse(read('shop/customer-photo-picks.json'));
const idOf = u => u.split('?')[0].split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/__[a-z]+$/i, '');
const pageIds = handle => {
  const html = read(`shop/products/${handle}/index.html`);
  return new Set([...html.matchAll(/data-full="([^"]+)"/g)].map(m => idOf(m[1].replace(/&amp;/g, '&'))));
};

describe('customer photo picks', () => {
  it('is an object of handle -> list of ids, max 3 each, no duplicates', () => {
    expect(Array.isArray(picks) || typeof picks !== 'object').toBe(false);
    for (const [handle, ids] of Object.entries(picks)) {
      expect(Array.isArray(ids), handle).toBe(true);
      expect(ids.length, handle).toBeLessThanOrEqual(3);
      expect(new Set(ids).size, handle).toBe(ids.length);
      for (const id of ids) expect(typeof id).toBe('string');
    }
  });
  it('every handle is a real product page and every id is on that page', () => {
    for (const [handle, ids] of Object.entries(picks)) {
      expect(existsSync(new URL(`../shop/products/${handle}/index.html`, import.meta.url)), handle).toBe(true);
      const known = pageIds(handle);
      for (const id of ids) expect(known.has(id), `${handle}: ${id}`).toBe(true);
    }
  });
  it('products Rahul left out have no row', () => {
    for (const h of ['bunny-keychain', 'cubone-keychain', 'uno-box', 'hoodie-pen-pot', 'aquarium-cave', 'floating-cat']) expect(picks[h], h).toBeUndefined();
  });
});
