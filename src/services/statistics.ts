/**
 * Sentinel Hub Statistical API — per-band mean reflectance for a clicked point,
 * used to draw a spectral signature chart.
 */
import { getToken, CDSE_SH_BASE } from './sentinelHub';

const STATS_URL = `${CDSE_SH_BASE}/api/v1/statistics`;

/** Sentinel-2 bands in output order, with central wavelength (nm). */
export const SPECTRAL_BANDS: { name: string; wavelength: number }[] = [
    { name: 'Aerosol', wavelength: 443 },
    { name: 'Blue', wavelength: 490 },
    { name: 'Green', wavelength: 560 },
    { name: 'Red', wavelength: 665 },
    { name: 'Veg 1', wavelength: 705 },
    { name: 'Veg 2', wavelength: 740 },
    { name: 'Veg 3', wavelength: 783 },
    { name: 'NIR', wavelength: 842 },
    { name: 'N-NIR', wavelength: 865 },
    { name: 'Vapor', wavelength: 945 },
    { name: 'SWIR 1', wavelength: 1610 },
    { name: 'SWIR 2', wavelength: 2190 },
];

const STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B01","B02","B03","B04","B05","B06","B07","B08","B8A","B09","B11","B12","dataMask"] }],
    output: [
      { id: "bands", bands: 12, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  return {
    bands: [s.B01,s.B02,s.B03,s.B04,s.B05,s.B06,s.B07,s.B08,s.B8A,s.B09,s.B11,s.B12],
    dataMask: [s.dataMask]
  };
}`;

export interface SpectralPoint {
    name: string;
    wavelength: number;
    reflectance: number;
}

/** Small square polygon (~250 m) around a lng/lat, in CRS84 order. */
function bufferPolygon(lng: number, lat: number, d = 0.0015) {
    return {
        type: 'Polygon',
        coordinates: [
            [
                [lng - d, lat - d],
                [lng + d, lat - d],
                [lng + d, lat + d],
                [lng - d, lat + d],
                [lng - d, lat - d],
            ],
        ],
    };
}

/**
 * Fetch the mean reflectance of each Sentinel-2 band at a point over a date
 * range. Returns null if no cloud-free data is found.
 */
export async function getSpectralSignature(
    lng: number,
    lat: number,
    from: string,
    to: string,
    maxCloud: number,
): Promise<SpectralPoint[] | null> {
    const token = await getToken();

    const body = {
        input: {
            bounds: {
                geometry: bufferPolygon(lng, lat),
                properties: {
                    crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84',
                },
            },
            data: [
                {
                    type: 'sentinel-2-l2a',
                    dataFilter: { maxCloudCoverage: maxCloud },
                },
            ],
        },
        aggregation: {
            timeRange: {
                from: `${from}T00:00:00Z`,
                to: `${to}T23:59:59Z`,
            },
            aggregationInterval: { of: 'P1D' },
            evalscript: STATS_EVALSCRIPT,
            resx: 10,
            resy: 10,
        },
        calculations: { bands: {} },
    };

    const res = await fetch(STATS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        console.warn('Statistics API алдаа:', res.status, await res.text());
        return null;
    }

    const json = await res.json();
    // Pick the most recent interval that actually has data.
    const intervals: unknown[] = json?.data ?? [];
    for (let i = intervals.length - 1; i >= 0; i--) {
        const bands = (intervals[i] as Record<string, unknown>)?.outputs as
            | Record<string, { bands?: Record<string, { stats?: { mean?: number } }> }>
            | undefined;
        const stats = bands?.bands?.bands;
        if (!stats) continue;
        const points: SpectralPoint[] = SPECTRAL_BANDS.map((b, idx) => ({
            name: b.name,
            wavelength: b.wavelength,
            reflectance: stats[`B${idx}`]?.stats?.mean ?? NaN,
        }));
        if (points.some((p) => !Number.isNaN(p.reflectance))) return points;
    }
    return null;
}
