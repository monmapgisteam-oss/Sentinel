/** Mongolia geographic configuration. */

/** Approx. bounding box of Mongolia: [west, south, east, north] (WGS84). */
export const MONGOLIA_BBOX: [number, number, number, number] = [
    87.7, 41.5, 119.95, 52.2,
];

/** Map start view. */
export const MONGOLIA_CENTER: [number, number] = [103.8, 46.8];
export const MONGOLIA_ZOOM = 4.2;

/** Loose panning bounds — generous margin so the map can be dragged freely to
 * reveal the east (which sits under the right-side panel) without snapping back. */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
    [68, 28],
    [145, 63],
];

/**
 * Official Mongolia national boundary (user-provided shapefile, converted to
 * GeoJSON in /public). Internal admin divisions come from the basemap.
 */
export const COUNTRY_BOUNDARY_URL = '/country.geojson';
