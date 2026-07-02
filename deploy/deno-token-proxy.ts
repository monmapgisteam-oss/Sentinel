/**
 * Deno Deploy / val.town — CDSE token proxy for Mongolia Imagery Explorer.
 *
 * The Copernicus token endpoint (Keycloak) sends no CORS headers, so the browser
 * can't call it directly. This tiny server does the client-credentials exchange
 * and returns the token JSON with CORS headers. Deploy on Deno Deploy (sign in
 * with GitHub), set CLIENT_ID + CLIENT_SECRET as environment variables, and use
 * the resulting URL as the app's VITE_TOKEN_PROXY_URL.
 */

const ALLOW_ORIGIN = 'https://sentinel.monmap.mn';
const TOKEN_URL =
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

Deno.serve(async (req: Request): Promise<Response> => {
    const cors = {
        'Access-Control-Allow-Origin': ALLOW_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: cors });
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: Deno.env.get('CLIENT_ID') ?? '',
        client_secret: Deno.env.get('CLIENT_SECRET') ?? '',
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
    });
});
