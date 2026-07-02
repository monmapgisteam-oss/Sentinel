import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Force a full browser reload on every source change instead of partial HMR, so
// map/config edits always show up without a manual refresh.
const fullReload = {
    name: 'full-reload-on-change',
    handleHotUpdate({ server }: { server: { ws: { send: (m: unknown) => void } } }) {
        server.ws.send({ type: 'full-reload' });
        return [];
    },
};

// https://vite.dev/config/
// Dev proxy routes Sentinel Hub / CDSE requests through the Vite server so the
// browser sees same-origin requests (avoids CORS on the token + process APIs).
export default defineConfig({
    plugins: [react(), fullReload],
    server: {
        proxy: {
            '/cdse-auth': {
                target: 'https://identity.dataspace.copernicus.eu',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/cdse-auth/, ''),
            },
            '/cdse-sh': {
                target: 'https://sh.dataspace.copernicus.eu',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/cdse-sh/, ''),
            },
        },
    },
});
