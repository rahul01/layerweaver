// Puts the ship-date notice (dates and words from /holiday.js) into the sitewide announcement
// bar of the static pages; the shop pages get the same block from scripts/build-shop.js
// (holidayBarHtml). Safe to run again after changing holiday.js.
//   node scripts/apply-holiday-notice.js            write the notice into every static page
//   node scripts/apply-holiday-notice.js --remove   take the bar out of every static page
// After either, run the shop build (npm run build-shop) so the shop pages follow.
const fs = require('fs');
const path = require('path');
const { HOLIDAY, COPY } = require('../holiday.js');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', '.ai', 'shop', 'tests', 'test-results', 'experiment']);

// The announcement bar block. href = link to the shipping policy from the page's depth.
function holidayBarHtml(href, indent = '    ') {
  return [
    `${indent}<!-- Announcement bar: ship-date notice (dates and words in /holiday.js; remove with scripts/apply-holiday-notice.js --remove). -->`,
    `${indent}<div class="announcement-bar" hidden>`,
    `${indent}    <div class="announcement-bar-track">`,
    `${indent}        <a href="${href}" data-from="${HOLIDAY.from}" data-to="${HOLIDAY.shipDate}" hidden><i class="fa-solid fa-calendar-days" aria-hidden="true"></i><span>${COPY.bar}</span></a>`,
    `${indent}    </div>`,
    `${indent}</div>`,
  ].join('\n');
}

// A short box at the top of the Shipping Policy and FAQ pages (between markers, so it can be redone or removed).
const POLICY_PAGES = ['shipping-policy/index.html', 'faq/index.html'];
const NOTICE_START = '<!-- holiday-notice:start -->';
const NOTICE_END = '<!-- holiday-notice:end -->';
const NOTICE_RE = /[ \t]*<!-- holiday-notice:start -->[\s\S]*?<!-- holiday-notice:end -->\n?/;
function noticeBox() {
  return `        ${NOTICE_START}\n        <div class="highlight-box holiday-policy-note">\n            <p><strong>Ship date:</strong> ${COPY.policy}</p>\n        </div>\n        ${NOTICE_END}\n`;
}

const BLOCK_RE = /^([ \t]*)<!-- Announcement bar:[^\n]*-->\n[ \t]*<div class="announcement-bar" hidden>[\s\S]*?\n[ \t]*<\/div>\n[ \t]*<\/div>/m;
const SCRIPT_RE = /\n[ \t]*<script>\(function\(\)\{var b=document\.currentScript\.previousElementSibling[^\n]*<\/script>/;

// shop/collage is hand-written (the build does not make it), so it is in the list too.
const EXTRA = ['shop/collage/index.html'];

function staticPages(dir = ROOT, out = []) {
  if (dir === ROOT) for (const f of EXTRA) if (fs.existsSync(path.join(ROOT, f))) out.push(path.join(ROOT, f));
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) staticPages(p, out);
    else if (e.name.endsWith('.html') && fs.readFileSync(p, 'utf8').includes('class="announcement-bar"')) out.push(p);
  }
  return out;
}

if (require.main === module) {
  const remove = process.argv.includes('--remove');
  for (const file of staticPages()) {
    let s = fs.readFileSync(file, 'utf8');
    const m = s.match(BLOCK_RE);
    if (!m) { console.log('no bar block found:', path.relative(ROOT, file)); continue; }
    s = remove ? s.replace(BLOCK_RE, '').replace(SCRIPT_RE, '') : s.replace(BLOCK_RE, () => holidayBarHtml('/shipping-policy/', m[1]));
    if (POLICY_PAGES.includes(path.relative(ROOT, file))) {
      s = s.replace(NOTICE_RE, '');
      if (!remove) s = s.replace(/(<div class="policy-content">\n)/, `$1\n${noticeBox()}`);
    }
    fs.writeFileSync(file, s);
    console.log((remove ? 'removed from ' : 'updated ') + path.relative(ROOT, file));
  }
}
module.exports = { holidayBarHtml, staticPages };
