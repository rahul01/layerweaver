// Holiday notice (Nov 2026): the team is away, so every order placed from HOLIDAY.from ships
// on HOLIDAY.shipDate. ONE place for the dates and the wording; after the ship date the notice
// hides itself (IST), and `node scripts/apply-holiday-notice.js --remove` takes it out of the
// static pages for good (the shop build reads this file too, so rebuild afterwards).
// Works as a plain script (window.LWHoliday), with require() and with import.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LWHoliday = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const HOLIDAY = {
    from: '2026-11-03',        // first IST day the notice shows (orders from now ship on shipDate)
    shipDate: '2026-11-12',    // orders placed in the window ship on this day
    until: '2026-11-10',       // last IST day the notice shows (an order from this day ships within the normal 2 days)
    shipLabel: '12 Nov',
    off: true,                 // Nov 10: notice taken off the site. Set false (and set new dates) to bring it back for the next holiday.
  };

  // Days a parcel usually takes AFTER it has shipped (Delhivery label to door). From the same
  // 369 delivered orders as the site's "usually arrives" ranges (Sep 15 - Nov 2, 2026): low =
  // median, high = 80th percentile rounded up. Pune 2.2 / 3.4, Mumbai 2.9 / 4.2, rest of
  // Maharashtra 2.8 / 3.2 (only 12 orders, so set like Mumbai), metros 4.0 / 5.1, rest of India 5.1 / 7.3.
  const AFTER_SHIP = { pune: '2-4', mumbai: '3-5', maharashtra: '3-5', metro: '4-6', india: '5-8' };

  const COPY = {
    bar: `New orders ship on ${HOLIDAY.shipLabel}. We're away until then.`,
    note: `New orders ship on ${HOLIDAY.shipLabel}. We're away until then.`,
    short: `Ships ${HOLIDAY.shipLabel}`,
    policy: `We are away from ${'3 Nov'} to ${HOLIDAY.shipLabel}. Every order placed from 3 Nov to 10 Nov ships on ${HOLIDAY.shipLabel}, then takes the usual transit time. Orders placed before 3 Nov are not affected.`,
  };

  const istToday = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const inWindow = (today = istToday()) => today >= HOLIDAY.from && today <= HOLIDAY.until;
  const active = (today = istToday()) => !HOLIDAY.off && inWindow(today);

  // Pincode line while the notice is on: when it ships, then the transit after that.
  function arrivesAfterShip(zone) {
    return zone && AFTER_SHIP[zone] ? `Ships on ${HOLIDAY.shipLabel}. Then usually arrives in ${AFTER_SHIP[zone]} days.` : null;
  }

  // Hides every [data-holiday-to] element once its day has passed (pages stay up between rebuilds).
  function applyDates(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc) return;
    const today = istToday();
    doc.querySelectorAll('[data-holiday-to]').forEach(el => { el.hidden = !(today >= (el.dataset.holidayFrom || '') && today <= el.dataset.holidayTo); });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyDates());
    else applyDates();
  }

  return { HOLIDAY, AFTER_SHIP, COPY, active, inWindow, istToday, arrivesAfterShip, applyDates };
});
