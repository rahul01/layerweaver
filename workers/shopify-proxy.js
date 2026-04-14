/**
 * shopify-proxy – Cloudflare Worker
 * Proxies requests to Shopify Customer Account API GraphQL endpoint,
 * adding CORS headers so the browser can call it from www.layerweaver.com.
 *
 * Deploy: paste into Cloudflare Dashboard → Workers & Pages → Create → Worker
 */

export default {
  async fetch(request) {
    const ALLOWED_ORIGIN = 'https://www.layerweaver.com';

    const corsHeaders = {
      'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Health check
    if (request.method === 'GET') {
      return new Response('shopify-proxy v9 running', { status: 200 });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const body       = await request.text();
    const authHeader = request.headers.get('Authorization') || '';

    // Correct Customer Account API endpoint (same as account.layerweaver.com portal)
    const response = await fetch(
      'https://account.layerweaver.com/customer/api/2025-01/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': authHeader,
          'Origin':        'https://account.layerweaver.com',
          'User-Agent':    'Mozilla/5.0',
        },
        body,
      }
    );

    const data = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({
        _debug:          true,
        shopify_status:  response.status,
        shopify_body:    data.substring(0, 800),
        auth_present:    !!authHeader,
        auth_prefix:     authHeader.substring(0, 15),
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
