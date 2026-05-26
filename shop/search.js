(() => {
  let index = null;

  async function loadIndex(indexUrl) {
    if (index) return;
    try {
      const res = await fetch(indexUrl);
      index = await res.json();
    } catch {
      index = [];
    }
  }

  function search(query) {
    if (!index || !query.trim()) return [];
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return index.filter(p => {
      const haystack = `${p.title} ${p.tags} ${p.desc}`.toLowerCase();
      return terms.every(t => haystack.includes(t));
    }).slice(0, 8);
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function highlight(text, query) {
    const term = query.trim().split(/\s+/)[0];
    if (!term) return escHtml(text);
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return escHtml(text).replace(re, '<mark>$1</mark>');
  }

  function initSearch(container) {
    const indexUrl   = container.dataset.indexUrl;
    const productsUrl = container.dataset.productsUrl;
    const input      = container.querySelector('.search-input');
    const dropdown   = container.querySelector('.search-dropdown');
    const clearBtn   = container.querySelector('.search-clear');
    let activeIdx    = -1;

    function render(results, query) {
      activeIdx = -1;
      if (!query.trim()) { close(); return; }
      if (!results.length) {
        dropdown.innerHTML = `<div class="search-empty">No results for "<strong>${escHtml(query)}</strong>"</div>`;
      } else {
        dropdown.innerHTML = results.map((p, i) => `
          <a class="search-result" href="${productsUrl}${p.handle}/" role="option" data-idx="${i}">
            <div class="sr-img">
              ${p.image ? `<img src="${p.image}" alt="${escHtml(p.title)}" loading="lazy">` : '<i class="fa-solid fa-cube"></i>'}
            </div>
            <div class="sr-info">
              <span class="sr-title">${highlight(p.title, query)}</span>
              ${p.price ? `<span class="sr-price">${p.price}</span>` : '<span class="sr-price sr-contact">Contact for price</span>'}
            </div>
          </a>`).join('');
      }
      dropdown.classList.add('open');
    }

    function close() {
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
      activeIdx = -1;
    }

    function moveCursor(dir) {
      const items = dropdown.querySelectorAll('.search-result');
      if (!items.length) return;
      items[activeIdx]?.classList.remove('focused');
      activeIdx = (activeIdx + dir + items.length) % items.length;
      const el = items[activeIdx];
      el.classList.add('focused');
      el.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('focus', () => loadIndex(indexUrl));

    input.addEventListener('input', () => {
      const q = input.value;
      clearBtn.style.display = q ? 'flex' : 'none';
      render(search(q), q);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown')      { e.preventDefault(); moveCursor(1); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); moveCursor(-1); }
      else if (e.key === 'Enter') {
        const focused = dropdown.querySelector('.search-result.focused');
        if (focused) focused.click();
      }
      else if (e.key === 'Escape')    { close(); input.blur(); }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      close();
      input.focus();
    });

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) close();
    });

    input.addEventListener('focus', () => {
      if (input.value) render(search(input.value), input.value);
    });
  }

  // Desktop: inline search container in header
  const desktopContainer = document.querySelector('.search-container');
  if (desktopContainer) initSearch(desktopContainer);

  // Mobile: inline search beside collection dropdown
  const mobileInlineSearch = document.querySelector('.mobile-inline-search');
  if (mobileInlineSearch) initSearch(mobileInlineSearch);
})();
