/**
 * Copernicus Data Space Ecosystem (CDSE) — Sentinel Hub integration.
 *
 * - OAuth2 client-credentials to obtain a bearer token.
 * - A MapLibre custom protocol ("sh://") that turns each XYZ tile request into a
 *   Sentinel Hub Process API call, returning a rendered PNG. This is how we get
 *   on-the-fly band math (NDVI etc.) exactly like Esri's ImageServer.
 *
 * NOTE: client-credentials in the browser exposes the secret. Fine for a local
 * prototype; for production put the token exchange behind a small backend proxy.
 */

import maplibregl from 'maplibre-gl';
import { getRenderer, type RendererId } from './evalscripts';

// In dev, route through the Vite proxy (vite.config.ts). In production, call CDSE
// directly — the endpoints send CORS headers, so no proxy/server is needed.
const CDSE_AUTH_BASE = import.meta.env.DEV
    ? '/cdse-auth'
    : 'https://identity.dataspace.copernicus.eu';
export const CDSE_SH_BASE = import.meta.env.DEV
    ? '/cdse-sh'
    : 'https://sh.dataspace.copernicus.eu';

const TOKEN_URL = `${CDSE_AUTH_BASE}/auth/realms/CDSE/protocol/openid-connect/token`;
const PROCESS_URL = `${CDSE_SH_BASE}/api/v1/process`;

const CLIENT_ID = import.meta.env.VITE_SH_CLIENT_ID as string | undefined;
const CLIENT_SECRET = import.meta.env.VITE_SH_CLIENT_SECRET as string | undefined;

export const hasCredentials = (): boolean =>
    Boolean(CLIENT_ID && CLIENT_SECRET);

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Fetch (and cache) an OAuth bearer token from CDSE. */
export async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
        return cachedToken.value;
    }
    if (!hasCredentials()) {
        throw new Error('Sentinel Hub credentials (VITE_SH_CLIENT_ID / SECRET) тохируулаагүй байна.');
    }

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
    });

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) {
        throw new Error(`Token авч чадсангүй: ${res.status} ${await res.text()}`);
    }
    const json = await res.json();
    cachedToken = {
        value: json.access_token,
        expiresAt: Date.now() + json.expires_in * 1000,
    };
    return cachedToken.value;
}

// --- Web Mercator tile math ----------------------------------------------
const HALF = 20037508.342789244;
const tileBBox3857 = (z: number, x: number, y: number) => {
    const worldSize = HALF * 2;
    const tileSize = worldSize / Math.pow(2, z);
    const minX = -HALF + x * tileSize;
    const maxX = -HALF + (x + 1) * tileSize;
    const maxY = HALF - y * tileSize;
    const minY = HALF - (y + 1) * tileSize;
    return [minX, minY, maxX, maxY] as [number, number, number, number];
};

export interface TileParams {
    renderer: RendererId;
    from: string; // ISO date (start)
    to: string; // ISO date (end)
    maxCloud: number; // 0-100
}

/** Build the Process API request body for one tile. */
function buildProcessBody(
    bbox: [number, number, number, number],
    p: TileParams,
    size = 512,
) {
    return {
        input: {
            bounds: {
                bbox,
                properties: {
                    crs: 'http://www.opengis.net/def/crs/EPSG/0/3857',
                },
            },
            data: [
                {
                    type: 'sentinel-2-l2a',
                    dataFilter: {
                        timeRange: {
                            from: `${p.from}T00:00:00Z`,
                            to: `${p.to}T23:59:59Z`,
                        },
                        maxCloudCoverage: p.maxCloud,
                        mosaickingOrder: 'leastCC',
                    },
                },
            ],
        },
        output: {
            width: size,
            height: size,
            responses: [
                { identifier: 'default', format: { type: outputFormat(p.renderer) } },
            ],
        },
        evalscript: getRenderer(p.renderer).evalscript,
    };
}

/**
 * Composites (photographic) → JPEG: ~7x smaller than PNG, much faster transfer.
 * Indices (flat colors) → PNG: tiny anyway, and keeps no-data transparency.
 */
function outputFormat(r: RendererId): 'image/jpeg' | 'image/png' {
    return getRenderer(r).group === 'composite' ? 'image/jpeg' : 'image/png';
}

// --- Tile cache ----------------------------------------------------------
// Rendered tiles are expensive (server-side band math). Two levels:
//   L1: in-memory Map (fast, cleared on reload)
//   L2: IndexedDB (persists across reloads and browser restarts)
// Keyed by the tile URL (renderer + date + cloud + z/x/y). Bump CACHE_VERSION
// whenever an evalscript changes so stale renders are not served.
const CACHE_VERSION = 'v3';
const MAX_CACHE = 400;
const tileCache = new Map<string, ArrayBuffer>();
const inFlight = new Map<string, Promise<ArrayBuffer>>();

function cachePut(key: string, buf: ArrayBuffer) {
    tileCache.set(key, buf);
    if (tileCache.size > MAX_CACHE) {
        // Evict oldest (Map preserves insertion order).
        const oldest = tileCache.keys().next().value as string | undefined;
        if (oldest) tileCache.delete(oldest);
    }
}

// --- IndexedDB (L2 persistent cache) -------------------------------------
const DB_NAME = 'mongolia-imagery';
const DB_STORE = 'tiles';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    return dbPromise;
}

async function idbGet(key: string): Promise<ArrayBuffer | undefined> {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(key);
            req.onsuccess = () =>
                resolve(req.result as ArrayBuffer | undefined);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return undefined;
    }
}

function idbSet(key: string, buf: ArrayBuffer): void {
    // Fire-and-forget; never block tile rendering on the write.
    openDB()
        .then((db) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(buf, key);
        })
        .catch(() => {
            /* storage full / private mode — ignore */
        });
}

async function fetchTile(url: string): Promise<ArrayBuffer> {
    const withoutScheme = url.replace(/^sh:\/\//, '');
    const [path, query] = withoutScheme.split('?');
    const [z, x, y] = path.split('/').map(Number);
    const q = new URLSearchParams(query);

    const tileParams: TileParams = {
        renderer: (q.get('r') as RendererId) ?? 'natural-color',
        from: q.get('from') ?? '2024-06-01',
        to: q.get('to') ?? '2024-08-31',
        maxCloud: Number(q.get('cc') ?? '20'),
    };

    const bbox = tileBBox3857(z, x, y);

    // Sentinel-2 L2A caps requests at 1500 m/px. At low zoom a 512px tile is too
    // coarse, so size the output image to keep resolution under the limit
    // (clamped to a sane range). MapLibre scales the texture to fit the tile.
    const widthMeters = bbox[2] - bbox[0];
    const size = Math.min(
        2048,
        Math.max(512, Math.ceil((widthMeters / 1400) / 16) * 16),
    );

    const token = await getToken();

    const res = await fetch(PROCESS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: outputFormat(tileParams.renderer),
        },
        body: JSON.stringify(buildProcessBody(bbox, tileParams, size)),
    });

    if (!res.ok) {
        const text = await res.text();
        console.warn('Process API алдаа:', res.status, text);
        throw new Error(`Process API ${res.status}`);
    }
    return res.arrayBuffer();
}

/**
 * Register the "sh://" MapLibre protocol. Tile URLs look like:
 *   sh://{z}/{x}/{y}?r=ndvi&from=2024-06-01&to=2024-08-31&cc=20
 */
export function registerSentinelHubProtocol(): void {
    maplibregl.addProtocol('sh', async (params) => {
        const url = params.url;
        const key = `${CACHE_VERSION}|${url}`;

        // L1: in-memory cache → instant.
        const mem = tileCache.get(key);
        if (mem) return { data: mem.slice(0) };

        // De-dupe identical concurrent requests (also across L2 lookups).
        let pending = inFlight.get(key);
        if (!pending) {
            pending = (async () => {
                // L2: IndexedDB (persists across reloads).
                const stored = await idbGet(key);
                if (stored) {
                    cachePut(key, stored);
                    return stored;
                }
                // Miss → fetch from Sentinel Hub, then populate both caches.
                const buf = await fetchTile(url);
                cachePut(key, buf);
                idbSet(key, buf);
                return buf;
            })().finally(() => inFlight.delete(key));
            inFlight.set(key, pending);
        }

        try {
            const buf = await pending;
            return { data: buf.slice(0) };
        } catch {
            // On error keep the map working with a transparent tile (not cached).
            return { data: TRANSPARENT_PNG.slice(0) };
        }
    });
}

/** Build the XYZ tile template for the current settings. */
export function buildTileUrl(p: TileParams): string {
    const q = new URLSearchParams({
        r: p.renderer,
        from: p.from,
        to: p.to,
        cc: String(p.maxCloud),
    });
    return `sh://{z}/{x}/{y}?${q.toString()}`;
}

// 1x1 transparent PNG (fallback tile).
const TRANSPARENT_PNG = Uint8Array.from(
    atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    ),
    (c) => c.charCodeAt(0),
).buffer;
