// Builds the creator short links from scripts/creators.json:
// www.layerweaver.com/<slug>/ forwards to the creator's landing page tagged
// utm_source=creator&utm_medium=social&utm_campaign=creators&utm_content=<slug>,
// so the sale is credited to them whatever they (or Instagram) add to the link.
//   npm run creator-links
// Each page is marked; a slug that clashes with any other folder is refused.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARK = '<!-- creator-short-link -->';
const { creators } = JSON.parse(fs.readFileSync(path.join(__dirname, 'creators.json'), 'utf8'));

function page({ slug, landing }) {
  const target = `/${landing}?utm_source=creator&utm_medium=social&utm_campaign=creators&utm_content=${slug}`;
  // Our utm_* go first and Instagram's own utm_* (ig / link_in_bio) are
  // dropped - the site keeps the first value of each. Anything else on the
  // incoming link (fbclid, for Meta matching) is kept.
  return `<!doctype html>
${MARK}
<html lang="en"><head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LayerWeaver</title>
<script>
(function () {
  var to = new URL(${JSON.stringify(target)}, location.origin);
  new URLSearchParams(location.search).forEach(function (v, k) {
    if (k.indexOf('utm_') !== 0 && !to.searchParams.has(k)) to.searchParams.append(k, v);
  });
  location.replace(to.toString());
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=${target}"></noscript>
</head><body><a href="${target}">Continue to LayerWeaver</a></body></html>
`;
}

let built = 0;
for (const c of creators) {
  if (!/^[a-z0-9-]{2,30}$/.test(c.slug)) throw new Error(`Bad slug "${c.slug}" - lowercase letters, digits, dashes`);
  if (!fs.existsSync(path.join(ROOT, c.landing, 'index.html'))) throw new Error(`${c.slug}: landing page ${c.landing} does not exist`);
  const dir = path.join(ROOT, c.slug);
  const file = path.join(dir, 'index.html');
  if (fs.existsSync(dir) && !(fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(MARK))) {
    throw new Error(`${c.slug}: /${c.slug}/ is already a page on the site - pick another slug (e.g. ${c.slug}-${c.name[0].toLowerCase()})`);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, page(c));
  built++;
  console.log(`  www.layerweaver.com/${c.slug}  ->  /${c.landing}  (WhatsApp code LW-CR-${c.slug.toUpperCase()})`);
}
console.log(`Built ${built} creator short link(s).`);
