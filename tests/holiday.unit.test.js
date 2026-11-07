import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { arrivesInForPincode } from '../shop/cart-utils.js';
const { HOLIDAY, AFTER_SHIP, COPY, active, arrivesAfterShip } = createRequire(import.meta.url)('../holiday.js');

describe('holiday notice dates (IST)', () => {
  it('on from the start day through 10 Nov, off before and after', () => {
    expect(HOLIDAY).toMatchObject({ from: '2026-11-03', shipDate: '2026-11-12', until: '2026-11-10' });
    expect(active('2026-11-02')).toBe(false);
    expect(active('2026-11-03')).toBe(true);
    expect(active('2026-11-10')).toBe(true);
    expect(active('2026-11-11')).toBe(false);
    expect(active('2026-11-12')).toBe(false);
  });
  it('follows IST, not UTC (Nov 2 19:00 UTC is already Nov 3 in India)', () => {
    expect(active(new Date('2026-11-02T19:00:00Z').toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))).toBe(true);
  });
});

describe('holiday copy', () => {
  it('says what ships when, in plain words', () => {
    expect(COPY.bar).toBe("New orders ship on 12 Nov. We're away until then.");
    expect(COPY.short).toBe('Ships 12 Nov');
    expect(COPY.policy).toContain('Every order placed from 3 Nov to 10 Nov ships on 12 Nov');
  });
  it('no banned wording, no far states, no em dash, no Diwali', () => {
    expect(JSON.stringify(COPY) + JSON.stringify(AFTER_SHIP)).not.toMatch(/far states|PLA\b|plastic|eco-friendly|non-toxic|child-safe|biodegradable|sustainable|renewable|diwali|—/i);
  });
});

describe('pincode line while the notice is on', () => {
  it('ships on the ship date, then the transit range per zone', () => {
    expect(arrivesAfterShip('pune')).toBe('Ships on 12 Nov. Then usually arrives in 2-4 days.');
    expect(arrivesAfterShip('mumbai')).toBe('Ships on 12 Nov. Then usually arrives in 3-5 days.');
    expect(arrivesAfterShip('maharashtra')).toBe('Ships on 12 Nov. Then usually arrives in 3-5 days.');
    expect(arrivesAfterShip('metro')).toBe('Ships on 12 Nov. Then usually arrives in 4-6 days.');
    expect(arrivesAfterShip('india')).toBe('Ships on 12 Nov. Then usually arrives in 5-8 days.');
    expect(arrivesAfterShip(null)).toBeNull();
  });
  it('cart-utils mirrors it: the holiday line while on, the normal range otherwise', () => {
    const on = { active: () => true, arrivesAfterShip };
    const off = { active: () => false, arrivesAfterShip };
    expect(arrivesInForPincode('560001', undefined, on)).toBe('Ships on 12 Nov. Then usually arrives in 4-6 days.');
    expect(arrivesInForPincode('560001', undefined, off)).toBe('Usually arrives in 5-7 days.');
    expect(arrivesInForPincode('560001')).toBe('Usually arrives in 5-7 days.');
    expect(arrivesInForPincode('123', undefined, on)).toBeNull();
  });
});
