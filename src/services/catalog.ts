/**
 * Sentinel Hub Catalog (STAC) API — list individual Sentinel-2 scenes that
 * cover a point, for the "find a scene" mode (pick one acquisition instead of a
 * date-range mosaic).
 */
import { getToken } from './sentinelHub';

const CATALOG_URL = '/cdse-sh/api/v1/catalog/1.0.0/search';

export interface Scene {
    id: string;
    date: string; // YYYY-MM-DD
    datetime: string;
    cloud: number; // 0-100, rounded
}

/**
 * Find scenes covering (lng, lat) within [from, to], newest first, de-duplicated
 * by acquisition date (keeping the least-cloudy one per day).
 */
export async function findScenes(
    lng: number,
    lat: number,
    from: string,
    to: string,
): Promise<Scene[]> {
    const token = await getToken();

    const body = {
        collections: ['sentinel-2-l2a'],
        datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
        intersects: { type: 'Point', coordinates: [lng, lat] },
        limit: 100,
    };

    const res = await fetch(CATALOG_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.warn('Catalog API алдаа:', res.status, await res.text());
        return [];
    }

    const json = await res.json();
    const features: Array<{
        id: string;
        properties?: { datetime?: string; 'eo:cloud_cover'?: number };
    }> = json.features ?? [];

    // De-duplicate by date, keeping the least-cloudy scene per day.
    const byDate = new Map<string, Scene>();
    for (const f of features) {
        const datetime = f.properties?.datetime ?? '';
        const date = datetime.slice(0, 10);
        if (!date) continue;
        const scene: Scene = {
            id: f.id,
            datetime,
            date,
            cloud: Math.round(f.properties?.['eo:cloud_cover'] ?? 0),
        };
        const existing = byDate.get(date);
        if (!existing || scene.cloud < existing.cloud) byDate.set(date, scene);
    }

    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
