/**
 * auth.js – Shopify Customer Account API (OAuth 2.0 PKCE)
 * No server required. Exposes window.LW_AUTH for other scripts.
 */
(function () {
  const CLIENT_ID    = '151ce365-7544-42c5-a742-c80ddaf08923';
  const SHOP_ID      = '78494040286';
  const REDIRECT_URI = 'https://www.layerweaver.com/shop/';
  const API_VERSION  = '2025-01';

  const BASE       = `https://shopify.com/authentication/${SHOP_ID}`;
  const AUTH_URL   = `${BASE}/oauth/authorize`;
  const TOKEN_URL  = `${BASE}/oauth/token`;
  const GQL_URL    = 'https://account.layerweaver.com/customer/api/unstable/graphql';
  const LOGOUT_URL = `${BASE}/logout`;

  const K_TOKEN    = 'lw_ca_token';
  const K_EXPIRES  = 'lw_ca_expires';
  const K_REFRESH  = 'lw_ca_refresh';
  const K_ID_TOKEN = 'lw_ca_id_token';
  const K_VERIFIER = 'lw_ca_verifier';
  const K_STATE    = 'lw_ca_state';
  const K_RETURN   = 'lw_ca_return';

  // ── PKCE helpers ───────────────────────────────────────────────────────────

  function b64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  function randomB64(byteLen) {
    const arr = new Uint8Array(byteLen);
    crypto.getRandomValues(arr);
    return b64url(arr.buffer);
  }

  async function sha256B64(plain) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
    return b64url(buf);
  }

  // ── Token storage ──────────────────────────────────────────────────────────

  function saveTokens({ access_token, expires_in, refresh_token, id_token }) {
    localStorage.setItem(K_TOKEN,   access_token);
    localStorage.setItem(K_EXPIRES, Date.now() + (expires_in || 3600) * 1000);
    if (refresh_token) localStorage.setItem(K_REFRESH,  refresh_token);
    if (id_token)      localStorage.setItem(K_ID_TOKEN, id_token);
  }

  function getRawToken()    { return localStorage.getItem(K_TOKEN); }
  function getExpiry()      { return parseInt(localStorage.getItem(K_EXPIRES) || '0'); }
  function getRefreshToken(){ return localStorage.getItem(K_REFRESH); }
  function getIdToken()     { return localStorage.getItem(K_ID_TOKEN); }

  function clearTokens() {
    [K_TOKEN, K_EXPIRES, K_REFRESH, K_ID_TOKEN].forEach(k => localStorage.removeItem(k));
  }

  function isLoggedIn() {
    return !!getRawToken() && Date.now() < getExpiry();
  }

  // ── Token refresh ──────────────────────────────────────────────────────────

  async function refreshToken() {
    const rt = getRefreshToken();
    if (!rt) { clearTokens(); return null; }
    try {
      const res  = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: rt }),
      });
      const data = await res.json();
      if (!data.access_token) { clearTokens(); return null; }
      saveTokens(data);
      return data.access_token;
    } catch { clearTokens(); return null; }
  }

  async function getValidToken() {
    const token   = getRawToken();
    const expires = getExpiry();
    if (!token) return null;
    // Refresh if expired or expiring within 5 minutes
    if (Date.now() > expires - 300_000) return await refreshToken();
    return token;
  }

  // ── GraphQL ────────────────────────────────────────────────────────────────

  async function gql(query, variables = {}) {
    const token = await getValidToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);
    return json.data;
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async function login() {
    const verifier  = randomB64(32);
    const state     = randomB64(16);
    const challenge = await sha256B64(verifier);

    localStorage.setItem(K_VERIFIER, verifier);
    localStorage.setItem(K_STATE,    state);
    localStorage.setItem(K_RETURN,   window.location.href);

    const params = new URLSearchParams({
      client_id:             CLIENT_ID,
      response_type:         'code',
      redirect_uri:          REDIRECT_URI,
      scope:                 'openid email customer-account-api:full',
      code_challenge:        challenge,
      code_challenge_method: 'S256',
      state,
    });

    window.location.href = `${AUTH_URL}?${params}`;
  }

  // ── OAuth callback ─────────────────────────────────────────────────────────

  async function handleCallback() {
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get('code');
    const state    = params.get('state');
    const verifier = localStorage.getItem(K_VERIFIER);
    const stored   = localStorage.getItem(K_STATE);

    if (!code || !verifier || state !== stored) return false;

    localStorage.removeItem(K_VERIFIER);
    localStorage.removeItem(K_STATE);

    try {
      const res  = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          client_id:     CLIENT_ID,
          redirect_uri:  REDIRECT_URI,
          code,
          code_verifier: verifier,
        }),
      });
      const data = await res.json();
      if (!data.access_token) { console.error('[Auth] Token exchange failed', data); return false; }
      saveTokens(data);
    } catch (e) { console.error('[Auth] Token exchange error', e); return false; }

    // Redirect back to where the user came from (e.g. account page)
    const returnUrl = localStorage.getItem(K_RETURN);
    localStorage.removeItem(K_RETURN);
    if (returnUrl && returnUrl !== window.location.href) {
      window.location.href = returnUrl;
      return true;
    }

    // Otherwise just clean the URL
    history.replaceState({}, '', window.location.pathname);
    return true;
  }

  // ── Customer info (decoded from ID token - no API call needed) ────────────

  function getCustomer() {
    const idToken = getIdToken();
    if (!idToken) return null;
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      return {
        id:        payload.sub ? `gid://shopify/Customer/${payload.sub}` : null,
        firstName: payload.given_name  || payload.firstName || '',
        lastName:  payload.family_name || payload.lastName  || '',
        email:     payload.email       || '',
      };
    } catch { return null; }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  function logout() {
    const idToken = getIdToken();
    clearTokens();
    localStorage.removeItem('lw_wishlist');
    localStorage.removeItem('lw_cart_id');
    localStorage.removeItem('lw_cart_qty');
    const params = new URLSearchParams({ post_logout_redirect_uri: REDIRECT_URI });
    if (idToken) params.set('id_token_hint', idToken);
    window.location.href = `${LOGOUT_URL}?${params}`;
  }

  // ── Header UI ──────────────────────────────────────────────────────────────

  function injectAuthButton() {
    const nav = document.querySelector('header nav');
    if (!nav || document.getElementById('auth-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'auth-btn';
    btn.setAttribute('aria-label', 'Account');
    btn.innerHTML = `<i class="fa-regular fa-user"></i>`;
    btn.addEventListener('click', () => {
      // Always navigate to account page - sign in / sign out handled there
      const p       = window.location.pathname;
      const idx     = p.indexOf('/shop/');
      const shopRoot = idx !== -1 ? p.substring(0, idx + 6) : '/shop/';
      window.location.href = shopRoot + 'account/';
    });

    // Insert before wishlist icon (which inserts before cart icon)
    const wishlistBtn = document.getElementById('wishlist-icon-btn');
    if (wishlistBtn) nav.insertBefore(btn, wishlistBtn);
    else nav.appendChild(btn);
  }

  function updateAuthUI() {
    const btn   = document.getElementById('auth-btn');
    if (!btn) return;
    const loggedIn = isLoggedIn();
    const icon     = btn.querySelector('i');
    if (loggedIn) {
      icon.className = 'fa-solid fa-user';
      btn.classList.add('signed-in');
      const customer = getCustomer();
      btn.title      = customer?.firstName ? `Hi, ${customer.firstName}` : 'My Account';
    } else {
      icon.className = 'fa-regular fa-user';
      btn.classList.remove('signed-in');
      btn.title      = 'Sign In';
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.LW_AUTH = { isLoggedIn, getValidToken, gql, getCustomer, _login: login, _logout: logout };

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function init() {
    let justLoggedIn = false;

    if (new URLSearchParams(window.location.search).has('code')) {
      justLoggedIn = await handleCallback();
    }

    injectAuthButton();
    await updateAuthUI();

    // Notify other scripts (e.g. wishlist.js) that auth state is ready
    window.dispatchEvent(new CustomEvent('lw:auth-ready', { detail: { justLoggedIn } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
