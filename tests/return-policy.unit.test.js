import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The return policy page and the promise row ("7-day easy returns", "Made just
// for you") must say the same thing (Oct 31, 2026).
const html = readFileSync(new URL('../return-and-exchange-policy/index.html', import.meta.url), 'utf8');
const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');

describe('return policy', () => {
  it('7-day easy return window and photos within 7 days of delivery', () => {
    expect(text).toContain('7-day easy return and exchange window');
    expect(text).toContain('Claims can be raised within 7 days of delivery with clear photos');
    expect(text).toContain('Please send photos within 7 days of delivery.');
  });
  it('damaged or wrong items, personalised included, get a replacement or full refund', () => {
    expect(text).toContain('For damaged or wrong items, including personalised ones, we will either send a replacement or issue a full refund (your choice).');
    expect(text).toContain('This includes personalised items.');
    expect(text).toContain('We offer exchanges if the wrong colour was sent or if the item arrived damaged, including personalised items.');
  });
  it('personalised items are not returnable if you change your mind, because they are made just for you', () => {
    expect(text).toContain('if you change your mind, because they are made just for you');
    expect(text).toContain("Personalised items can't be exchanged if you change your mind.");
    expect(text).not.toContain('We offer exchanges for non-personalised items');
  });
  it("the general line is 'If something isn't right', and the old 'unhappy for any reason' wording is gone", () => {
    expect(text).toContain("If something isn't right, just reach out and we'll try to figure it out.");
    expect(text).not.toMatch(/unhappy with your purchase/i);
    expect(text).not.toContain('for any reason');
  });
  it('prepaid refunds go back to the payment method used, and the old wording is gone', () => {
    expect(text).toContain('For prepaid orders, the refund goes back to the payment method you used (card, UPI or bank account).');
    expect(text).not.toContain('credited back to your bank account or UPI');
  });
  it('keeps the rules that were already there', () => {
    for (const t of ['Items returned without prior approval.', 'Items damaged due to misuse, dropping, or mishandling after delivery.', 'Shipping charges are non-refundable unless the return is due to our error.', 'within 5–7 business days']) expect(text).toContain(t);
  });
  it('has no em dash, banned claims or far states', () => {
    expect(html).not.toMatch(/—/);
    expect(text).not.toMatch(/non-?toxic|eco-?friendly|biodegradable|sustainable|renewable|child-?safe|\bPLA\b|plastic|far states/i);
  });
});
