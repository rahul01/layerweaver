/**
 * account.js – LayerWeaver account page
 * Customer info from ID token. Orders fetched via Cloudflare Worker proxy.
 */
(function () {
  if (!document.getElementById('account-content')) return;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fmt(amount, code) {
    const n = parseFloat(amount);
    return code === 'INR' ? `₹${n.toFixed(0)}` : `${code} ${n.toFixed(2)}`;
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
  function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

  // ── Orders fetch ───────────────────────────────────────────────────────────

  async function fetchOrders() {
    const data = await window.LW_AUTH.gql(`
      query {
        customer {
          orders(first: 20) {
            edges {
              node {
                id
                number
                processedAt
                financialStatus
                totalPrice { amount currencyCode }
                lineItems(first: 5) {
                  edges {
                    node {
                      title
                      quantity
                      price { amount currencyCode }
                    }
                  }
                }
              }
            }
          }
        }
      }`);
    return data?.customer?.orders?.edges?.map(e => e.node) || [];
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderOrders(orders) {
    const container = document.getElementById('account-orders');
    if (!container) return;

    if (!orders.length) {
      container.innerHTML = `
        <div class="orders-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>No orders yet.</p>
          <a href="../" class="btn-primary">Start Shopping</a>
        </div>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const items = order.lineItems?.edges?.map(e => e.node) || [];

      return `
        <div class="order-card">
          <div class="order-card-header">
            <div class="order-meta">
              <span class="order-number">Order #${order.number}</span>
              <span class="order-date">${fmtDate(order.processedAt)}</span>
            </div>
            <span class="order-total">${fmt(order.totalPrice.amount, order.totalPrice.currencyCode)}</span>
          </div>
          <div class="order-line-items">
            ${items.map(item => `
              <div class="order-line">
                <span class="order-line-title">${item.title}</span>
                <span class="order-line-qty">× ${item.quantity}</span>
                <span class="order-line-price">${fmt(item.price.amount, item.price.currencyCode)}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  // ── Core handler ───────────────────────────────────────────────────────────

  async function handleAuthReady() {
    if (!window.LW_AUTH?.isLoggedIn()) {
      hide('account-loading');
      show('account-signin');
      document.getElementById('account-signin-btn')?.addEventListener('click', () => {
        window.LW_AUTH?._login();
      });
      return;
    }

    const customer = window.LW_AUTH.getCustomer();
    document.getElementById('account-name').textContent =
      [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'My Account';
    document.getElementById('account-email').textContent = customer?.email || '';

    document.getElementById('account-logout-btn')?.addEventListener('click', () => {
      window.LW_AUTH?._logout();
    });

    hide('account-loading');
    show('account-content');

    // Fetch orders after showing the page
    try {
      const orders = await fetchOrders();
      renderOrders(orders);
    } catch (e) {
      console.error('[Account] Failed to load orders:', e);
      document.getElementById('account-orders').innerHTML = `
        <div class="orders-empty">
          <i class="fa-solid fa-circle-exclamation"></i>
          <p>Could not load orders. <a href="https://shop.layerweaver.com/account/orders" target="_blank">View on Shopify</a></p>
        </div>`;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    const fallback = setTimeout(() => {
      if (document.getElementById('account-loading')?.style.display !== 'none') {
        hide('account-loading');
        show('account-signin');
      }
    }, 4000);

    if (window.LW_AUTH) {
      clearTimeout(fallback);
      handleAuthReady();
    } else {
      window.addEventListener('lw:auth-ready', () => {
        clearTimeout(fallback);
        handleAuthReady();
      }, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
