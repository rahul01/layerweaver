// Adds (or with --remove, removes) the Christmas paper strip under the logo on the
// hand-written pages. The shop pages get it from build-shop.js (CHRISTMAS_RIBBON).
//   node scripts/apply-christmas-ribbon.js            add it (idempotent)
//   node scripts/apply-christmas-ribbon.js --remove   take it out again
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', '404.html', 'connect', 'shipping-policy', 'services/on-demand', 'services/3d-design',
  'return-and-exchange-policy', 'enroll-adult', 'terms-of-service', 'workshop', 'enroll', 'privacy-policy', 'faq', 'gallery']
  .map(p => p.endsWith('.html') ? p : `${p}/index.html`);
const remove = process.argv.includes('--remove');
const RIBBON_RE = /\n[ \t]*<a [^>]*class="logo-christmas-ribbon"[^>]*>[^<]*<\/a>/g;
let changed = 0;
for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { console.warn('missing', rel); continue; }
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(RIBBON_RE, '');
  if (!remove) {
    const depth = rel === '404.html' ? -1 : rel.split('/').length - 1;
    const href = depth < 0 ? '/shop/collections/christmas/' : `${'../'.repeat(depth)}shop/collections/christmas/`;
    const anchor = /(<a [^>]*class="logo-link"[^>]*>[\s\S]*?<\/a>)(\s*<\/div>)/;
    if (!anchor.test(html)) { console.warn('no logo link in', rel); continue; }
    html = html.replace(anchor, `$1\n                <a href="${href}" class="logo-christmas-ribbon">Christmas gifts 🎄</a>$2`);
  }
  if (html !== before) { fs.writeFileSync(file, html); changed++; }
}
console.log(`${remove ? 'removed from' : 'added to'} ${changed} page(s)`);
