# Deploy — sentinel.monmap.mn

The app is a static Vite build, but it needs the Copernicus Data Space endpoints
reverse-proxied (same as the local Vite dev proxy). GitHub Pages **cannot** do
this, so host it on the monmap server with nginx.

## Steps

1. **Build**

   ```bash
   npm install
   npm run build        # → dist/
   ```

2. **Upload** `dist/` to the server, e.g. `/var/www/sentinel/dist`.

3. **Nginx** — use [`deploy/nginx.conf`](deploy/nginx.conf) (serves `dist/` and
   proxies `/cdse-auth` + `/cdse-sh`). Enable the site and reload nginx.

4. **TLS**

   ```bash
   sudo certbot --nginx -d sentinel.monmap.mn
   ```

5. **DNS** — point `sentinel.monmap.mn` (A/CNAME) to the server.

## ⚠️ OAuth secret

The Sentinel Hub `VITE_SH_CLIENT_SECRET` is **inlined into the built JS** (Vite
inlines `VITE_*` vars at build time), so it is visible to anyone who opens the
site. For a public deployment:

- **Minimum:** use a dedicated CDSE OAuth client for this site and rotate its
  secret periodically (Sentinel Hub dashboard → OAuth clients).
- **Better:** move the token exchange server-side — add a small endpoint (or
  nginx `njs`/a tiny service) that holds the secret and returns only the bearer
  token, and change `getToken()` in `src/services/sentinelHub.ts` to call it
  without sending the secret from the browser.

## Note

GitHub Pages hosting would show the UI, basemap, boundaries, and ArcGIS thematic
layers, but **Sentinel-2 imagery and the spectral chart would fail** (no proxy
for the token/process endpoints). Use the nginx setup above for full function.
