import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Claims we do not make about material or safety (Oct 31, 2026). Checked on the
// pages we write ourselves. Product descriptions come from Shopify at build time
// and are not covered here (they still say "Material: PLA+ 3D Printed").
const BANNED = /non-?toxic|eco-?friendly|biodegradable|bio degradable|child-?safe|kid-?safe|safe for (kids|children|play)|renewable|cornstarch|sustainable|\bPLA\b|plastic/i;
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

const OWN_PAGES = [
  'faq/index.html', 'index.html', 'shop/index.html', 'shop/account/index.html',
  'shipping-policy/index.html', 'return-and-exchange-policy/index.html', 'terms-of-service/index.html',
  'workshop/index.html', 'services/on-demand/index.html', 'scripts/generate-syllabus.js', 'workshops/june-kids/kids-weekend-course-flyer.html', 'workshops/july-kids/kids-weekend-course-july-flyer.html',
  ...readdirSync(new URL('../shop/collections', import.meta.url)).map(d => `shop/collections/${d}/index.html`),
];

describe('claims we do not make', () => {
  for (const f of OWN_PAGES) it(`${f} has none`, () => expect(read(f)).not.toMatch(BANNED));

  it('trust strip says plant-based, printed to order in Pune, and links to the FAQ answer', () => {
    const html = read('shop/index.html');
    expect(html).toContain('Plant-based. Printed to order in Pune.');
    expect(html).toContain('faq/#material');
  });
  it('FAQ material and safety answers are the agreed wording, in the page and the structured data', () => {
    const faq = read('faq/index.html');
    for (const t of [
      'Every piece is 3D printed to order in Pune, layer by layer, in a plant-based material. We print yours when you order it, so nothing sits on a shelf waiting.',
      'We print with filament that passed independent lab testing for heavy metals (EN 71-3). We check every piece before it leaves our studio. Our pieces are made for desks, shelves and homes. Keep them away from children under 5.',
    ]) expect(faq.split(t).length - 1).toBe(2);
    expect(faq).toContain('id="material"');
  });
});
