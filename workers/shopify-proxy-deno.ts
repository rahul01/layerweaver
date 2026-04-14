/**
 * shopify-proxy – Deno Deploy
 * Proxies requests to Shopify Customer Account API GraphQL endpoint.
 *
 * Deploy at: https://dash.deno.com → New Playground → paste this code
 */

Deno.serve(async (request: Request): Promise<Response> => {
  const ALLOWED_ORIGIN = 'https://www.layerweaver.com';

  const corsHeaders = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Shopify-API-Version',
  };

  // Health check
  if (request.method === 'GET') {
    return new Response('shopify-proxy (deno) running', { status: 200, headers: corsHeaders });
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body        = await request.text();
  const authHeader  = request.headers.get('Authorization') || '';

  try {
    const response = await fetch(
      'https://shopify.com/authentication/78494040286/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type':        'application/json',
          'Authorization':       authHeader,
          'Shopify-API-Version': '2025-01',
          'Origin':              'https://www.layerweaver.com',
          'User-Agent':          'Mozilla/5.0 (compatible; LayerWeaver/1.0)',
        },
        body,
      }
    );

    const data = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({
        _debug:            true,
        shopify_status:    response.status,
        shopify_body:      data.substring(0, 800),
        auth_present:      !!authHeader,
        auth_prefix:       authHeader.substring(0, 15),
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ _debug: true, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
