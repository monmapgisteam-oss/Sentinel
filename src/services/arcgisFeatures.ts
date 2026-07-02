/**
 * Fetch an ArcGIS FeatureServer layer as GeoJSON (WGS84), paging through the
 * server's record limit. Geometry is generalized and only the needed fields are
 * requested to keep payloads small and fast.
 */
import { ARCGIS_FEATURESERVER } from '../config/featureLayers';

interface GeoJSONFC {
    type: 'FeatureCollection';
    features: unknown[];
}

// Generalization tolerance in degrees (~200 m). Invisible at country/regional
// scale but hugely reduces vertex count → smaller, faster responses.
const MAX_ALLOWABLE_OFFSET = 0.002;

export async function fetchArcgisLayer(
    layerId: number,
    fields: string[] = [],
): Promise<GeoJSONFC> {
    const pageSize = 1000;
    let offset = 0;
    const features: unknown[] = [];

    // Only request the fields we actually use (category + popup); fall back to
    // OBJECTID-only when a layer needs no attributes.
    const outFields = fields.length ? fields.join(',') : 'OBJECTID';

    for (let page = 0; page < 50; page++) {
        const url =
            `${ARCGIS_FEATURESERVER}/${layerId}/query` +
            `?where=1%3D1&outFields=${encodeURIComponent(outFields)}` +
            `&outSR=4326&f=geojson&geometryPrecision=5` +
            `&maxAllowableOffset=${MAX_ALLOWABLE_OFFSET}` +
            `&resultOffset=${offset}&resultRecordCount=${pageSize}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`ArcGIS ${res.status}`);
        const json = (await res.json()) as {
            features?: unknown[];
            exceededTransferLimit?: boolean;
        };
        const batch = json.features ?? [];
        features.push(...batch);

        if (!json.exceededTransferLimit || batch.length < pageSize) break;
        offset += pageSize;
    }

    return { type: 'FeatureCollection', features };
}
