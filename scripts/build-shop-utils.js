/**
 * build-shop-utils.js
 * Pure helpers used by scripts/build-shop.js, split out so they're importable
 * from tests without pulling in the Shopify fetch + file-write side effects
 * that run at the bottom of build-shop.js.
 */

function resizedImageUrl(url, width) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}`;
}

function escAttr(str) {
  return String(str).replace(/—/g, '-').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Truncate to `max` chars without cutting a word in half, appending an ellipsis if shortened.
function truncateWords(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  let trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:-]+$/, '');
  let prev;
  do {
    prev = trimmed;
    trimmed = trimmed.replace(/\s+(?:a|an|the|or|and|to|in|of|for)$/i, '');
  } while (trimmed !== prev);
  return trimmed + '…';
}

function fontAwesomeLinkHtml() {
  const href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
  const integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==';
  const attrs = `integrity="${integrity}" crossorigin="anonymous" referrerpolicy="no-referrer"`;
  return `
    <link rel="preload" as="style" href="${href}" ${attrs} onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="${href}" ${attrs}></noscript>`;
}

module.exports = { resizedImageUrl, escAttr, truncateWords, fontAwesomeLinkHtml };
