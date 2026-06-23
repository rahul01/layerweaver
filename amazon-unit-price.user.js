// ==UserScript==
// @name         Amazon Unit Price Calculator
// @namespace    layerweaver
// @version      2.0
// @description  Shows price per gram and price per unit on Amazon pages
// @match        https://www.amazon.in/*
// @match        https://www.amazon.com/*
// @match        https://amazon.in/*
// @match        https://amazon.com/*
// @match        https://www.amazon.co.uk/*
// @match        https://www.amazon.ca/*
// @match        https://www.amazon.de/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const GRAM_PER_KG = 1000;
  const GRAM_PER_OZ = 28.3495;
  const GRAM_PER_LB = 453.592;

  function toGrams(val, unit) {
    switch (unit) {
      case 'g': case 'gm': case 'gms': case 'gram': case 'grams':
        return val;
      case 'kg': case 'kgs':
        return val * GRAM_PER_KG;
      case 'oz': case 'ounce': case 'ounces':
        return val * GRAM_PER_OZ;
      case 'lb': case 'lbs': case 'pound': case 'pounds':
        return val * GRAM_PER_LB;
      case 'ml':
        return val;
      case 'l': case 'litre': case 'liter': case 'litres': case 'liters':
        return val * 1000;
      default:
        return null;
    }
  }

  const WEIGHT_UNITS = 'kg|kgs|g|gm|gms|gram|grams|oz|ounce|ounces|lb|lbs|pound|pounds|ml|l|litre|liter|litres|liters';
  const WEIGHT_RE = new RegExp('([\\d.]+)\\s*(' + WEIGHT_UNITS + ')\\b', 'gi');

  function parseWeight(title) {
    const t = title.toLowerCase();

    // "2 x 500g" or "3x100g"
    const multi = t.match(new RegExp('(\\d+)\\s*[x×]\\s*([\\d.]+)\\s*(' + WEIGHT_UNITS + ')\\b'));
    if (multi) {
      const g = toGrams(parseFloat(multi[2]), multi[3]);
      if (g) return g * parseFloat(multi[1]);
    }

    // standalone: "500g", "1.5 kg"
    const single = t.match(new RegExp('([\\d.]+)\\s*(' + WEIGHT_UNITS + ')\\b'));
    if (single) {
      return toGrams(parseFloat(single[1]), single[2]);
    }

    return null;
  }

  const UNIT_WORDS = [
    'pack', 'packs', 'count', 'piece', 'pieces', 'pcs', 'pc',
    'unit', 'units', 'sheet', 'sheets', 'capsule', 'capsules',
    'tablet', 'tablets', 'bag', 'bags', 'sachet', 'sachets',
    'pod', 'pods', 'roll', 'rolls', 'wipe', 'wipes', 'bar', 'bars',
    'bottle', 'bottles', 'can', 'cans', 'pair', 'pairs', 'stick', 'sticks',
    'refill', 'refills', 'cartridge', 'cartridges', 'combo', 'set',
    'blade', 'blades', 'strip', 'strips', 'pouch', 'pouches',
    'nos', 'n', 'pkt', 'pkts',
    'bullet', 'bullets', 'dart', 'darts', 'arrow', 'arrows',
  ].join('|');

  function parseUnitCount(title) {
    const t = title.toLowerCase();

    // "2 x 100 count" combos
    const combo = t.match(new RegExp('(\\d+)\\s*[x×]\\s*(\\d+)\\s*[-\\s]?(' + UNIT_WORDS + ')\\b'));
    if (combo) return parseFloat(combo[1]) * parseFloat(combo[2]);

    const patterns = [
      // "pack of 20", "set of 12", "box of 50"
      /(?:pack|set|box|bundle|case)\s+of\s+(\d+)/,

      // "20-pack", "100 count", "50 pieces", "20 refill pack", "20-dart refill pack"
      new RegExp('(\\d+)[-\\s](?:\\w+[-\\s]){0,3}(' + UNIT_WORDS + ')\\b'),

      // "20-pack", "100 count" - number directly before unit word
      new RegExp('(\\d+)\\s*[-\\s]?(' + UNIT_WORDS + ')\\b'),

      // "(blue, 20)" or "(red,100)" - number after comma inside parens
      /\(\s*[^,)]+\s*,\s*(\d+)\s*\)/,

      // "(100)" or "( 50 )" - bare number in parens
      /\(\s*(\d+)\s*\)/,

      // "qty: 20", "quantity: 50"
      /(?:qty|quantity)[:\s]+(\d+)/,
    ];

    for (const p of patterns) {
      const m = t.match(p);
      if (m) {
        const n = parseFloat(m[1]);
        if (n > 1 && n < 10000) return n;
      }
    }

    return null;
  }

  function parsePrice(el) {
    const priceEl = el.querySelector('.a-price .a-offscreen');
    if (!priceEl) return null;
    const num = priceEl.textContent.trim().replace(/[^0-9.]/g, '');
    return parseFloat(num) || null;
  }

  function formatPrice(val, sym) {
    return val >= 1 ? sym + val.toFixed(2) : sym + val.toFixed(4);
  }

  const CURRENCY = (() => {
    const h = window.location.hostname;
    if (h.includes('.in')) return '₹';
    if (h.includes('.co.uk')) return '£';
    if (h.includes('.de')) return '€';
    return '$';
  })();

  function injectBadge(el, html) {
    if (el.querySelector('.lw-unit-price')) return;

    const priceEl = el.querySelector('.a-price');
    if (!priceEl) return;

    let target = priceEl;
    while (target.parentNode && target.parentNode !== el && target.parentNode.tagName === 'A') {
      target = target.parentNode;
    }

    const badge = document.createElement('div');
    badge.className = 'lw-unit-price';
    badge.innerHTML = html;
    badge.style.cssText =
      'margin-top:6px; padding:4px 8px; font-size:16px; font-weight:700; color:#000; border:2px solid red; border-radius:4px; display:inline-block; line-height:1.4;';
    target.parentNode.insertBefore(badge, target.nextSibling);
  }

  function getTitle(el) {
    const sel = [
      'h2 span',
      '.a-size-base-plus.a-color-base.a-text-normal',
      '.a-size-medium.a-color-base.a-text-normal',
      '.a-truncate-full',
      '.a-link-normal .a-text-normal',
      'a[href] span.a-text-normal',
      '.a-size-base.a-color-base',
      'img[alt]',
    ];
    for (const s of sel) {
      const node = el.querySelector(s);
      if (node) {
        const txt = s === 'img[alt]' ? node.getAttribute('alt') : node.textContent;
        if (txt && txt.trim().length > 10) return txt.trim();
      }
    }
    return null;
  }

  function processItem(el) {
    if (el.hasAttribute('data-lw-done')) return;
    el.setAttribute('data-lw-done', '1');

    const title = getTitle(el);
    const price = parsePrice(el);
    if (!title || !price) return;

    const parts = [];

    const grams = parseWeight(title);
    if (grams && grams > 0) {
      const ppg = price / grams;
      parts.push(formatPrice(ppg, CURRENCY) + '/g');
      if (grams >= 100) parts.push(formatPrice(ppg * 100, CURRENCY) + '/100g');
    }

    const units = parseUnitCount(title);
    if (units && units > 1) {
      parts.push(formatPrice(price / units, CURRENCY) + '/unit');
    }

    if (parts.length === 0) return;
    injectBadge(el, parts.join(' &nbsp;|&nbsp; '));
  }

  // broad card selectors covering search results, deals, trending, recommendations
  const CARD_SELECTORS = [
    '[data-component-type="s-search-result"]',
    '.deal-card',
    '.a-cardui',
    '.octopus-pc-card',
    '.feed-carousel-card',
    '.s-result-item',
    '.a-carousel-card',
    '[data-testid="product-card"]',
    '.puis-card-container',
    '.s-widget-container .a-section',
  ].join(',');

  function processDetailPage() {
    if (document.querySelector('.lw-unit-price-dp')) return;

    const titleEl = document.getElementById('productTitle') || document.getElementById('title');
    if (!titleEl) return;
    const title = titleEl.textContent.trim();

    const priceEl =
      document.querySelector('#corePrice_feature_div .a-price .a-offscreen') ||
      document.querySelector('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen') ||
      document.querySelector('.a-price.priceToPay .a-offscreen') ||
      document.querySelector('#price_inside_buybox') ||
      document.querySelector('#priceblock_ourprice') ||
      document.querySelector('#priceblock_dealprice') ||
      document.querySelector('.a-price .a-offscreen');
    if (!priceEl) return;

    const price = parseFloat(priceEl.textContent.trim().replace(/[^0-9.]/g, ''));
    if (!price) return;

    const parts = [];
    const grams = parseWeight(title);
    if (grams && grams > 0) {
      const ppg = price / grams;
      parts.push(formatPrice(ppg, CURRENCY) + '/g');
      if (grams >= 100) parts.push(formatPrice(ppg * 100, CURRENCY) + '/100g');
    }
    const units = parseUnitCount(title);
    if (units && units > 1) {
      parts.push(formatPrice(price / units, CURRENCY) + '/unit');
    }
    if (parts.length === 0) return;

    const badge = document.createElement('div');
    badge.className = 'lw-unit-price-dp';
    badge.innerHTML = parts.join(' &nbsp;|&nbsp; ');
    badge.style.cssText =
      'margin:10px 0; padding:8px 14px; font-size:18px; font-weight:700; color:#000; border:2px solid red; border-radius:4px; display:inline-block; line-height:1.4;';

    const anchor =
      document.querySelector('#corePrice_feature_div') ||
      document.querySelector('#corePriceDisplay_desktop_feature_div') ||
      document.querySelector('#price') ||
      priceEl.closest('.a-section');
    if (anchor) {
      anchor.parentNode.insertBefore(badge, anchor.nextSibling);
    }
  }

  function isDetailPage() {
    return /\/dp\/|\/gp\/product\//.test(window.location.pathname);
  }

  function processAll() {
    if (isDetailPage()) {
      processDetailPage();
    }
    document.querySelectorAll(CARD_SELECTORS).forEach(el => {
      if (el.querySelector('.a-price') && !el.hasAttribute('data-lw-done')) {
        processItem(el);
      }
    });
  }

  // detail pages load price asynchronously - retry a few times
  if (isDetailPage()) {
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      processDetailPage();
      if (document.querySelector('.lw-unit-price-dp') || tries > 10) {
        clearInterval(interval);
      }
    }, 500);
  }

  processAll();

  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      processAll();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
