/**
 * Cloudflare Worker — CDSE token proxy for Mongolia Imagery Explorer.
 *
 * The Copernicus token endpoint (Keycloak) does NOT send CORS headers on its
 * POST response, so the browser can't call it directly. This Worker performs the
 * client-credentials exchange server-side (holding the secret) and returns the
 * token JSON with CORS headers. The Sentinel Hub Process/Catalog/Statistics
 * endpoints DO support CORS, so the app calls those directly — only the token
 * needs this proxy.
 *
 * Deploy (https://workers.cloudflare.com):
 *   1. Create a Worker, paste this file.
 *   2. Settings → Variables → add SECRETS (encrypted):
 *        CLIENT_ID     = sh-....
 *        CLIENT_SECRET = ....
 *   3. (optional) restrict ALLOW_ORIGIN below to your site.
 *   4. Deploy → copy the Worker URL (e.g. https://cdse-token.<you>.workers.dev).
 *   5. Set that URL as the GitHub Actions secret VITE_TOKEN_PROXY_URL and re-run
 *      the deploy workflow.
 */

const ALLOW_ORIGIN = 'https://sentinel.monmap.mn';
const TOKEN_URL =
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

export default {
    async fetch(request, env) {
        const cors = {
            'Access-Control-Allow-Origin': ALLOW_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: cors });
        }

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
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
    },
};
