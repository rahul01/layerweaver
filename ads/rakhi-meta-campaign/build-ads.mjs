// Generates ads/rakhi-meta-campaign/<id>/index.html for each of the 4 Meta
// persona ad creatives (originally built from a since-superseded
// rakhi/creative-brief.md — see .ai/plans/rakhi-ads/creative-brief.md for
// the current brief, separate later work), one page per ad with all 3
// ratios (1:1, 4:5, 9:16) on it. Run: node ads/rakhi-meta-campaign/build-ads.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADS } from './ads-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function headlineHtml(lines, accentWord, accentColor) {
  return lines
    .map((line) => {
      if (line.includes(accentWord)) {
        const [before] = line.split(accentWord);
        return `${escHtml(before)}<span style="color:${accentColor}">${escHtml(accentWord)}</span>`;
      }
      return escHtml(line);
    })
    .join('<br>');
}

function productCellHtml(p) {
  return `
            <div class="cell">
                <img src="${p.image}" alt="${escHtml(p.name)}">
                <span class="cell-name">${escHtml(p.name)}</span>
                <span class="cell-price">${escHtml(p.price)}</span>
            </div>`;
}

function pillsHtml(pills) {
  return pills
    .map((p) => `<span class="pill${p.highlight ? ' pill-highlight' : ''}">${escHtml(p.text)}</span>`)
    .join('\n                ');
}

function adBlockHtml(ad, ratioClass, label, showSub) {
  const c = ad.colors;
  const personaTagBg = ad.personaTagBg || c.accent;
  const personaTagText = ad.personaTagText || c.accentText;
  return `
    <div class="ad-block">
        <p class="ad-label">${label}</p>
        <div class="ad ${ratioClass}" style="--bg:${c.bg}; --accent:${c.accent}; --accent-text:${c.accentText}; --cell-bg:${c.cellBg}; --text:${c.text}; --sub-text:${c.subText}; --cell-border:${c.cellBorder}; --cell-shadow:${c.cellShadow};">
            <div class="top-bar">
                <span class="persona-tag" style="background:${personaTagBg}; color:${personaTagText};">${escHtml(ad.personaTag)}</span>
                <span class="brand-name">LayerWeaver</span>
            </div>
            <h2 class="headline">${headlineHtml(ad.headlineLines, ad.headlineAccentWord, c.accent)}</h2>
            ${showSub ? `<p class="sub-headline">${escHtml(ad.subHeadline)}</p>` : ''}
            <div class="product-grid">${ad.products.map(productCellHtml).join('')}
            </div>
            <div class="bottom-bar">
                <div class="pills">
                ${pillsHtml(ad.pills)}
                </div>
                <button class="cta-btn">Shop now →</button>
            </div>
        </div>
    </div>`;
}

function pageHtml(ad) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meta Ad — ${escHtml(ad.personaTag)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root { --font: 'Montserrat', sans-serif; }
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background: #333;
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            justify-content: center;
            min-height: 100vh;
            font-family: var(--font);
            gap: 32px;
            padding: 40px;
        }

        .ad-block { display: flex; flex-direction: column; gap: 12px; }

        .ad-label {
            color: #ccc;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }

        .ad {
            position: relative;
            background: var(--bg);
            color: var(--text);
            display: flex;
            flex-direction: column;
            padding: 46px;
            overflow: hidden;
        }

        .top-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .persona-tag {
            font-size: 19px;
            font-weight: 700;
            padding: 10px 20px;
            border-radius: 100px;
            letter-spacing: 0.01em;
            white-space: nowrap;
        }

        .brand-name {
            font-size: 22px;
            font-weight: 800;
            color: var(--text);
            letter-spacing: 0.02em;
        }

        .headline {
            font-weight: 900;
            line-height: 1.05;
            letter-spacing: -0.02em;
            color: var(--text);
        }

        .sub-headline {
            color: var(--sub-text);
            font-weight: 500;
        }

        .product-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 6px;
            flex: 1;
            min-height: 0;
        }

        .cell {
            position: relative;
            background: var(--cell-bg);
            border: 1px solid var(--cell-border);
            box-shadow: var(--cell-shadow);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            overflow: hidden;
        }
        .cell img { max-width: 78%; max-height: 78%; object-fit: contain; }

        .cell-name {
            position: absolute;
            left: 10px; bottom: 10px;
            background: rgba(255,255,255,0.9);
            color: #1a1a1a;
            font-size: 16px;
            font-weight: 600;
            padding: 6px 12px;
            border-radius: 8px;
            max-width: 62%;
        }

        .cell-price {
            position: absolute;
            right: 10px; bottom: 10px;
            background: var(--accent);
            color: var(--accent-text);
            font-size: 16px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 8px;
            white-space: nowrap;
        }

        .bottom-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }

        .pills {
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
        }

        .pill {
            display: inline-block;
            background: var(--bg);
            color: var(--text);
            border: 1px solid rgba(128,128,128,0.35);
            border-radius: 100px;
            font-weight: 600;
            white-space: nowrap;
        }
        .pill-highlight {
            background: var(--accent);
            color: var(--accent-text);
            border-color: transparent;
        }

        .cta-btn {
            background: var(--accent);
            color: var(--accent-text);
            font-weight: 700;
            border-radius: 100px;
            border: none;
            letter-spacing: 0.02em;
            white-space: nowrap;
            flex-shrink: 0;
        }

        /* ── 1:1 — 1080×1080 ── */
        .ad-1x1 { width: 1080px; height: 1080px; gap: 20px; }
        .ad-1x1 .headline { font-size: 56px; }
        .ad-1x1 .sub-headline { display: none; }
        .ad-1x1 .product-grid { min-height: 55%; }
        .ad-1x1 .pill { font-size: 16px; padding: 11px 20px; }
        .ad-1x1 .cta-btn { font-size: 20px; padding: 16px 32px; }

        /* ── 4:5 — 1080×1350 ── */
        .ad-4x5 { width: 1080px; height: 1350px; gap: 24px; padding-bottom: 56px; }
        .ad-4x5 .headline { font-size: 62px; }
        .ad-4x5 .sub-headline { display: none; }
        .ad-4x5 .product-grid { min-height: 58%; }
        .ad-4x5 .persona-tag { font-size: 20px; }
        .ad-4x5 .brand-name { font-size: 23px; }
        .ad-4x5 .cell-name, .ad-4x5 .cell-price { font-size: 17px; }
        .ad-4x5 .pill { font-size: 17px; padding: 12px 22px; }
        .ad-4x5 .cta-btn { font-size: 21px; padding: 17px 34px; }

        /* ── 9:16 — 1080×1920 ── */
        .ad-9x16 { width: 1080px; height: 1920px; gap: 28px; }
        .ad-9x16 .headline { font-size: 70px; }
        .ad-9x16 .sub-headline { display: block; font-size: 26px; margin-top: -12px; }
        .ad-9x16 .product-grid { min-height: 62%; }
        .ad-9x16 .persona-tag { font-size: 21px; }
        .ad-9x16 .brand-name { font-size: 24px; }
        .ad-9x16 .cell-name, .ad-9x16 .cell-price { font-size: 19px; padding: 7px 14px; }
        .ad-9x16 .pills { row-gap: 12px; }
        .ad-9x16 .pill { font-size: 19px; padding: 14px 24px; }
        .ad-9x16 .cta-btn { font-size: 23px; padding: 19px 38px; }
        .ad-9x16 .bottom-bar { flex-wrap: wrap; }
    </style>
</head>
<body>
${adBlockHtml(ad, 'ad-1x1', '1:1 — 1080 × 1080 — Facebook/Instagram Feed', false)}
${adBlockHtml(ad, 'ad-4x5', '4:5 — 1080 × 1350 — Instagram Feed (preferred)', false)}
${adBlockHtml(ad, 'ad-9x16', '9:16 — 1080 × 1920 — Stories/Reels', true)}
</body>
</html>`;
}

for (const ad of ADS) {
  const dir = path.join(__dirname, ad.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(ad));
  console.log(`Generated ads/rakhi-meta-campaign/${ad.id}/index.html`);
}
