/**
 * Shared MapLibre paint/filter expressions for the ArcGIS thematic layers, so
 * the main map and the swipe (compare) map style them identically.
 */
import { catValues, type FeatureLayerDef } from '../config/featureLayers';

const BASE_OPACITY = 0.45;

/** Fill/line color: a match by category, or a flat color. */
export function colorExpr(def: FeatureLayerDef): unknown {
    if (!def.categories || !def.categoryField) return def.color;
    return [
        'match',
        ['get', def.categoryField],
        ...def.categories.flatMap((c) => [catValues(c), c.color]),
        def.color,
    ];
}

/** Fill opacity: per-category match, or the base opacity. */
export function opacityExpr(def: FeatureLayerDef): unknown {
    if (!def.categories || !def.categoryField) return BASE_OPACITY;
    return [
        'match',
        ['get', def.categoryField],
        ...def.categories.flatMap((c) => [catValues(c), c.opacity ?? BASE_OPACITY]),
        BASE_OPACITY,
    ];
}

/** Filter to only the enabled categories (null = no filter). */
export function categoryFilter(
    def: FeatureLayerDef,
    catEnabled: Record<number, Record<string, boolean>>,
): unknown | null {
    if (!def.categories || !def.categoryField) return null;
    const vals = def.categories
        .filter((c) => catEnabled[def.id]?.[c.value] !== false)
        .flatMap(catValues);
    return ['in', ['get', def.categoryField], ['literal', vals]];
}
