import { test, expect } from '@playwright/test';

// Diwali 2026 campaign: the sitewide announcement bar (next-order codes and
// the e-gift card, each on its own dates), the logo ribbon, the gift card tab
// and the cart's next-order progress. The clock is faked to IST dates and the
// cart is stubbed, so these don't depend on today's date or on Shopify.
// Remove with the campaign in the Nov 9 cleanup.

const GIFT_CARD = 'layerweaver-e-gift-card';

async function onDay(page, day) {
  await page.clock.setFixedTime(new Date(`${day}T12:00:00+05:30`));
}

function line(price, { qty = 1, total = price * qty, handle = 'snail-lamp' } = {}) {
  return { node: {
    id: `gid://shopify/CartLine/${handle}-${price}`, quantity: qty, attributes: [],
    cost: { totalAmount: { amount: String(total) } },
    merchandise: {
      id: `gid://shopify/ProductVariant/${handle}-${price}`, title: 'Default Title',
      requiresShipping: handle !== GIFT_CARD,
      price: { amount: String(price), currencyCode: 'INR' },
      product: { title: handle, handle }, image: null,
    },
  } };
}

function cartOf(lines, orderOff = 0) {
  return {
    id: 'gid://shopify/Cart/test', checkoutUrl: 'https://example.com/checkout', totalQuantity: lines.length,
    lines: { edges: lines },
    cost: { totalAmount: { amount: '0', currencyCode: 'INR' }, subtotalAmount: { amount: '0', currencyCode: 'INR' } },
    discountCodes: orderOff ? [{ code: 'TEST', applicable: true }] : [],
    discountAllocations: orderOff ? [{ discountedAmount: { amount: String(orderOff) } }] : [],
  };
}

async function openCart(page, day, lines, { orderOff = 0, path = '/shop/' } = {}) {
  await onDay(page, day);
  await page.route(/shop\.layerweaver\.com\/api/, route =>
    route.fulfill({ json: { data: { cart: cartOf(lines, orderOff) } } }));
  await page.addInitScript(() => localStorage.setItem('lw_cart_id', 'gid://shopify/Cart/test'));
  await page.goto(path);
  await page.waitForFunction(() => document.getElementById('cart-icon-btn'));
  await page.click('#cart-icon-btn');
  await page.waitForSelector('#cart-drawer.open');
  await expect(page.locator('#rewards-progress')).toBeVisible();
}

const visibleMessages = page => page.locator('.announcement-bar-track > a:not(.announcement-dup):not([hidden])');

// ── Announcement bar ────────────────────────────────────────────────────────

test.describe('Announcement bar by date', () => {
  for (const path of ['/faq/', '/shop/']) {
    test(`${path} - gift card only before the offer`, async ({ page }) => {
      await onDay(page, '2026-10-20');
      await page.goto(path);
      await expect(page.locator('.announcement-bar')).toBeVisible();
      await expect(visibleMessages(page)).toHaveCount(1);
      await expect(visibleMessages(page).first()).toContainText('Send an e-gift card');
      await expect(page.locator('.announcement-bar')).not.toHaveClass(/announcement-rotate/);
    });

    test(`${path} - both messages take turns from the first day of the offer`, async ({ page }) => {
      await onDay(page, '2026-10-21');
      await page.goto(path);
      await expect(visibleMessages(page)).toHaveCount(2);
      await expect(visibleMessages(page).nth(0)).toContainText('Spend ₹599, get ₹50 off. Spend ₹949, get ₹100 off - on your next order.');
      await expect(page.locator('.announcement-bar')).toHaveClass(/announcement-rotate/);
    });

    test(`${path} - offer ends after Nov 1, gift card stays till Nov 7`, async ({ page }) => {
      await onDay(page, '2026-11-02');
      await page.goto(path);
      await expect(visibleMessages(page)).toHaveCount(1);
      await expect(visibleMessages(page).first()).toContainText('e-gift card');
    });

    test(`${path} - no bar from Diwali day, header back at the top`, async ({ page }) => {
      await onDay(page, '2026-11-08');
      await page.goto(path);
      await expect(page.locator('.announcement-bar')).toBeHidden();
      await expect(page.locator('html')).not.toHaveClass(/has-announcement/);
      expect((await page.locator('header').first().boundingBox()).y).toBe(0);
    });
  }

  test('the header sits just below the bar', async ({ page }) => {
    await onDay(page, '2026-10-25');
    await page.goto('/shop/');
    const bar = await page.locator('.announcement-bar').boundingBox();
    const header = await page.locator('header.shop-header').boundingBox();
    expect(bar.height).toBe(36);
    expect(header.y).toBe(36);
  });

  test('each message links where its call to action says', async ({ page }) => {
    await onDay(page, '2026-10-25');
    await page.goto('/shop/products/snail-lamp/');
    const next = visibleMessages(page).nth(0);
    const gift = visibleMessages(page).nth(1);
    await expect(next.locator('.announcement-cta')).toHaveText('Shop Diwali →');
    await expect(gift.locator('.announcement-cta')).toHaveText('Gift cards →');
    for (const [link, url] of [[next, /\/shop\/collections\/diwali\/$/], [gift, new RegExp(`/shop/products/${GIFT_CARD}/$`)]]) {
      const href = await link.evaluate(a => a.href);
      expect(href).toMatch(url);
      expect((await page.request.get(href)).status()).toBe(200);
    }
  });

  test('phones get one marquee with every message', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await onDay(page, '2026-10-25');
    await page.goto('/');
    // Two messages plus a copy of each for a seamless loop.
    await expect(page.locator('.announcement-bar-track > a:visible')).toHaveCount(4);
  });
});

// ── Light Diwali touch ──────────────────────────────────────────────────────

test.describe('Light Diwali touch', () => {
  // One large mandala centred on the bottom-right corner of the window.
  const mandala = page => page.evaluate(() => {
    const st = getComputedStyle(document.body, '::before');
    return { image: st.backgroundImage, position: st.position, right: st.right, width: st.width };
  });

  for (const path of ['/', '/shop/', '/faq/']) {
    test(`${path} - corner mandala through Diwali day, gone after`, async ({ page }) => {
      await onDay(page, '2026-11-08');
      await page.goto(path);
      await expect(page.locator('html')).toHaveClass(/diwali-touch/);
      const on = await mandala(page);
      expect(on.image).toContain('data:image/svg+xml');
      expect(on.position).toBe('fixed');
      // Centred on the corner: pushed out by half its own width.
      expect(parseFloat(on.right)).toBe(-parseFloat(on.width) / 2);
      await page.clock.setFixedTime(new Date('2026-11-09T12:00:00+05:30'));
      await page.reload();
      await expect(page.locator('html')).not.toHaveClass(/diwali-touch/);
      expect((await mandala(page)).image).toBe('none');
    });
  }

  test('cart gets the mandala and a diya after the title', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(450)]);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.cart-header h3'), '::after').content);
    expect(after).toContain('🪔');
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('cart-drawer')).backgroundImage)).toContain('data:image/svg+xml');
  });
});

// ── Logo ribbon and gift card tab ───────────────────────────────────────────

test.describe('Logo ribbon and gift card tab', () => {
  for (const path of ['/', '/shop/', '/shop/products/snail-lamp/']) {
    test(`${path} - ribbon links to the Diwali collection`, async ({ page }) => {
      await page.goto(path);
      const ribbon = page.locator('.logo-diwali-ribbon');
      await expect(ribbon).toBeVisible();
      await expect(ribbon).toHaveText('Shop Diwali Gifts 🪔');
      expect(await ribbon.evaluate(a => a.href)).toMatch(/\/shop\/collections\/diwali\/$/);
    });
  }

  test('ribbon stays on screen on a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 340, height: 700 });
    await page.goto('/shop/');
    const box = await page.locator('.logo-diwali-ribbon').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
  });

  test('e-gift card is first in the Gifts menu on desktop', async ({ page }) => {
    await page.goto('/shop/');
    await page.locator('.collection-nav-group-btn', { hasText: 'Gifts' }).click();
    const first = page.locator('.collection-nav-group:has(.collection-nav-group-btn:has-text("Gifts")) .collection-nav-menu-item').first();
    await expect(first).toBeVisible();
    await expect(first).toHaveText('🎁E-gift card');
    // The gift card isn't a collection: the Gifts group isn't marked active.
    await expect(page.locator('.collection-nav-group-btn.active')).toHaveCount(0);
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/shop/products/${GIFT_CARD}/$`));
  });

  test('phones list it under Gifts in the dropdown, with no extra chip', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/shop/');
    await expect(page.locator('.collection-nav-mobile .collection-nav-icon-chip')).toHaveCount(2);
    await page.click('.collection-filter-btn');
    await expect(page.locator('.collection-dropdown-item--giftcard')).toBeVisible();
  });
});

// ── Cart: next-order progress ───────────────────────────────────────────────

test.describe('Cart next-order progress', () => {
  const shipMsg = page => page.locator('#rewards-bar-msg');
  const nextMsg = page => page.locator('#rewards-nextorder-msg');
  const metMarks = page => page.locator('.rewards-bar-mark.is-met');

  test('below free shipping: one bar with three marks, the shipping line only', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(200)]);
    await expect(page.locator('#rewards-progress')).toHaveClass(/rewards-has-marks/);
    await expect(page.locator('.rewards-bar-mark')).toHaveText(['Free shipping', '₹50 off', '₹100 off']);
    await expect(metMarks(page)).toHaveCount(0);
    await expect(shipMsg(page)).toHaveText('🚚 Add ₹99 more for Free Shipping');
    await expect(nextMsg(page)).toBeHidden();
  });

  for (const width of [340, 375, 1280]) {
    test(`marks are evenly spaced on screen at ${width}px, labels inside the card`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openCart(page, '2026-10-25', [line(650)]);
      const { gaps, inside } = await page.evaluate(() => {
        const track = document.querySelector('.rewards-bar-track').getBoundingClientRect();
        const card = document.querySelector('#rewards-progress').getBoundingClientRect();
        const centres = [...document.querySelectorAll('.rewards-bar-mark i')]
          .map(i => { const r = i.getBoundingClientRect(); return r.left + r.width / 2 - track.left; });
        return {
          gaps: centres.map((c, i) => c - (i ? centres[i - 1] : 0)),
          inside: [...document.querySelectorAll('.rewards-bar-mark')]
            .every(m => { const r = m.getBoundingClientRect(); return r.left >= card.left && r.right <= card.right; }),
        };
      });
      expect(gaps).toHaveLength(3);
      for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThanOrEqual(1.5);
      expect(inside).toBe(true);
    });
  }

  test('₹299 - ₹598: free shipping line points at the ₹50', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(450)]);
    await expect(metMarks(page)).toHaveCount(1);
    await expect(shipMsg(page)).toHaveText('🎉 Free shipping unlocked - add ₹149 more for ₹50 off your next order');
    await expect(nextMsg(page)).toBeHidden();
  });

  test('₹599: only the next-order line, pointing at the ₹100', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(599)]);
    await expect(metMarks(page)).toHaveCount(2);
    await expect(shipMsg(page)).toBeHidden();
    await expect(nextMsg(page)).toHaveText('₹50 off your next order unlocked - add ₹350 more for ₹100 off');
  });

  test('₹948 still needs ₹1', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(948)]);
    await expect(nextMsg(page)).toHaveText('₹50 off your next order unlocked - add ₹1 more for ₹100 off');
  });

  test('₹949: everything unlocked, bar full', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(949)]);
    await expect(metMarks(page)).toHaveCount(3);
    await expect(page.locator('#rewards-progress')).toHaveClass(/rewards-all-unlocked/);
    await expect(nextMsg(page)).toHaveText("₹100 off your next order unlocked 🪔 - we'll send the code after you order");
    expect(await page.locator('#rewards-bar-fill').evaluate(el => el.style.width)).toBe('100%');
  });

  test('an order discount counts: ₹998 with ₹99.80 off is the ₹50 tier', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(998)], { orderOff: 99.8 });
    await expect(nextMsg(page)).toHaveText('₹50 off your next order unlocked - add ₹51 more for ₹100 off');
  });

  test('a line discount counts: ₹650 marked down to ₹585 is below ₹599', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(650, { total: 585 })]);
    await expect(shipMsg(page)).toHaveText('🎉 Free shipping unlocked - add ₹14 more for ₹50 off your next order');
    await expect(nextMsg(page)).toBeHidden();
  });

  test('gift cards are left out', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(400), line(1000, { handle: GIFT_CARD })]);
    await expect(shipMsg(page)).toHaveText('🎉 Free shipping unlocked - add ₹199 more for ₹50 off your next order');
    await expect(nextMsg(page)).toBeHidden();
  });

  test('after Nov 1: the plain free shipping bar', async ({ page }) => {
    await openCart(page, '2026-11-02', [line(999)]);
    await expect(page.locator('#rewards-progress')).not.toHaveClass(/rewards-has-marks/);
    await expect(page.locator('.rewards-bar-mark')).toHaveCount(0);
    await expect(shipMsg(page)).toHaveText('🎉 Free shipping unlocked!');
    await expect(nextMsg(page)).toBeHidden();
  });

  test('before Oct 21: the plain free shipping bar', async ({ page }) => {
    await openCart(page, '2026-10-20', [line(999)]);
    await expect(page.locator('.rewards-bar-mark')).toHaveCount(0);
    await expect(nextMsg(page)).toBeHidden();
  });
});

// ── Cart: e-gift card link ──────────────────────────────────────────────────

test.describe('Cart e-gift card link', () => {
  test('shows under the progress card and goes to the gift card page', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(450)]);
    const link = page.locator('#cart-giftcard-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveText("Can't decide? Send an e-gift card instead");
    expect(await link.evaluate(a => a.href)).toMatch(new RegExp(`/shop/products/${GIFT_CARD}/$`));
  });

  test('hides when a gift card is already in the cart', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(450), line(1000, { handle: GIFT_CARD })]);
    await expect(page.locator('#cart-giftcard-link')).toBeHidden();
  });

  test('hides on the gift card page itself', async ({ page }) => {
    await openCart(page, '2026-10-25', [line(450)], { path: `/shop/products/${GIFT_CARD}/` });
    await expect(page.locator('#cart-giftcard-link')).toBeHidden();
  });
});

// ── Cart layout ─────────────────────────────────────────────────────────────

test.describe('Cart layout with the campaign pieces', () => {
  test('one scrolling panel, opened at the bottom, not covered by the bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => localStorage.setItem('lw_pincode', '411001'));
    await openCart(page, '2026-10-25', [line(250), line(200, { handle: 'cat-bookmark' }), line(150, { handle: 'orca' })]);
    // One scrolling panel under the header holds everything, opened at the
    // bottom so progress and Checkout show first.
    const scroll = page.locator('#cart-scroll');
    for (const part of ['#cart-body', '.orderby-cart', '#rewards-progress', '#cart-checkout-btn', '.cart-policy-links']) {
      await expect(scroll.locator(part)).toHaveCount(1);
    }
    await expect.poll(() => scroll.evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThanOrEqual(1);
    await expect(page.locator('#cart-checkout-btn')).toBeInViewport();
    await expect(page.locator('#rewards-progress')).toBeInViewport();
    // The drawer's back link is the topmost element where it sits.
    const back = await page.locator('#cart-drawer .drawer-back-link').boundingBox();
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.drawer-back-link') !== null,
      [back.x + 5, back.y + back.height / 2]);
    expect(hit).toBe(true);
  });
});

test.describe('Cart scroll hint', () => {
  test('says the items are above, and scrolls up to them', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => localStorage.setItem('lw_pincode', '411001'));
    await openCart(page, '2026-10-25', [line(250), line(200, { handle: 'cat-bookmark' }), line(150, { handle: 'orca' })]);
    const hint = page.locator('#cart-scroll-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText('↑ See your 3 items');
    await hint.click();
    await expect.poll(() => page.locator('#cart-scroll').evaluate(e => e.scrollTop)).toBe(0);
    await expect(hint).toBeHidden();
  });

  test('stays hidden when everything fits', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await openCart(page, '2026-10-25', [line(450)]);
    await expect(page.locator('#cart-scroll-hint')).toBeHidden();
  });
});

// ── Empty cart offer cards ──────────────────────────────────────────────────

test.describe('Empty cart offer cards', () => {
  async function openEmptyCart(page, day) {
    await onDay(page, day);
    await page.goto('/shop/');
    await page.waitForFunction(() => document.getElementById('cart-icon-btn'));
    await page.click('#cart-icon-btn');
    await expect(page.locator('.cart-empty')).toBeVisible();
  }

  test('during the offer: next-order card, then gift card', async ({ page }) => {
    await openEmptyCart(page, '2026-10-25');
    const cards = page.locator('.cart-empty-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Spend ₹599, get ₹50 off. Spend ₹949, get ₹100 off - on your next order.');
    await expect(cards.nth(0).locator('.cart-empty-card-cta')).toHaveText('Shop Diwali →');
    expect(await cards.nth(0).evaluate(a => a.href)).toMatch(/\/shop\/collections\/diwali\/$/);
    await expect(cards.nth(1)).toContainText('Send an e-gift card');
    expect(await cards.nth(1).evaluate(a => a.href)).toMatch(new RegExp(`/shop/products/${GIFT_CARD}/$`));
  });

  test('outside the offer: gift card only', async ({ page }) => {
    await openEmptyCart(page, '2026-11-02');
    await expect(page.locator('.cart-empty-card')).toHaveCount(1);
    await expect(page.locator('.cart-empty-card')).toContainText('e-gift card');
  });
});
