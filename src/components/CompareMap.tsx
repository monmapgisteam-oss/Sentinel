import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { buildTileUrl, type TileParams } from '../services/sentinelHub';
import { COUNTRY_BOUNDARY_URL } from '../config/mongolia';
import { FEATURE_LAYERS } from '../config/featureLayers';
import { fetchArcgisLayer } from '../services/arcgisFeatures';
import {
    colorExpr,
    opacityExpr,
    categoryFilter,
} from '../services/featureStyle';

const BASEMAP_STYLE =
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SRC = 'sh-b';
const LYR = 'sh-b-layer';

interface Props {
    baseMap: maplibregl.Map;
    /** imagery params for the "B" (right) side */
    params: TileParams;
    /** horizontal split position, 0-100 (% from left) */
    splitAt: number;
    /** thematic layers to mirror on the compare side */
    featureLayers: Record<number, boolean>;
    categoryEnabled: Record<number, Record<string, boolean>>;
}

/**
 * A second Sentinel imagery map stacked over the main map and synced to it.
 * Its container is clipped to show only the right portion, producing a swipe
 * comparison against the main ("A") map underneath.
 */
export default function CompareMap({
    baseMap,
    params,
    splitAt,
    featureLayers,
    categoryEnabled,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const beforeIdRef = useRef<string | undefined>(undefined);
    const loadedFeaturesRef = useRef<Set<number>>(new Set());
    const categoryEnabledRef = useRef(categoryEnabled);
    categoryEnabledRef.current = categoryEnabled;

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP_STYLE,
            center: baseMap.getCenter(),
            zoom: baseMap.getZoom(),
            bearing: baseMap.getBearing(),
            pitch: baseMap.getPitch(),
            interactive: false,
            attributionControl: false,
        });
        mapRef.current = map;

        map.on('load', () => {
            const fb = (map.getStyle().layers ?? []).find(
                (l) => l.type === 'line' && /boundary|admin/i.test(l.id),
            );
            beforeIdRef.current = fb?.id;
            map.addSource(SRC, {
                type: 'raster',
                tiles: [buildTileUrl(params)],
                tileSize: 512,
            });
            map.addLayer(
                {
                    id: LYR,
                    type: 'raster',
                    source: SRC,
                    minzoom: 5,
                    paint: { 'raster-fade-duration': 0 },
                },
                beforeIdRef.current,
            );

            // Mongolia national boundary (matches the main map).
            map.addSource('country-b', {
                type: 'geojson',
                data: COUNTRY_BOUNDARY_URL,
            });
            map.addLayer({
                id: 'bnd-country-b',
                type: 'line',
                source: 'country-b',
                paint: {
                    'line-color': '#ffd23f',
                    'line-width': 1.8,
                    'line-opacity': 0.95,
                },
            });
        });

        // Keep the B map locked to the main map's view.
        const sync = () => {
            map.jumpTo({
                center: baseMap.getCenter(),
                zoom: baseMap.getZoom(),
                bearing: baseMap.getBearing(),
                pitch: baseMap.getPitch(),
            });
        };
        baseMap.on('move', sync);
        sync();

        return () => {
            baseMap.off('move', sync);
            map.remove();
            mapRef.current = null;
        };
    }, [baseMap]);

    // Update B imagery when its params change.
    useEffect(() => {
        const map = mapRef.current;
        // Guard on the source existing (added in load handler), not isStyleLoaded
        // which is false mid-tile-load and would drop renderer changes.
        if (!map || !map.getSource(SRC)) return;
        if (map.getLayer(LYR)) map.removeLayer(LYR);
        if (map.getSource(SRC)) map.removeSource(SRC);
        map.addSource(SRC, {
            type: 'raster',
            tiles: [buildTileUrl(params)],
            tileSize: 512,
        });
        const beforeId =
            beforeIdRef.current && map.getLayer(beforeIdRef.current)
                ? beforeIdRef.current
                : undefined;
        map.addLayer(
            {
                id: LYR,
                type: 'raster',
                source: SRC,
                minzoom: 5,
                paint: { 'raster-fade-duration': 0 },
            },
            beforeId,
        );
    }, [params]);

    // Mirror the enabled thematic layers on the compare side.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getLayer('bnd-country-b')) return; // wait for load

        for (const def of FEATURE_LAYERS) {
            const on = !!featureLayers[def.id];
            const srcId = `feat-b-${def.id}`;
            const fillId = `${srcId}-fill`;
            const lineId = `${srcId}-line`;
            const loaded = loadedFeaturesRef.current.has(def.id);

            if (on && !loaded) {
                loadedFeaturesRef.current.add(def.id);
                const fields = [def.categoryField, def.popupField].filter(
                    (f): f is string => Boolean(f),
                );
                fetchArcgisLayer(def.id, fields)
                    .then((geojson) => {
                        const m = mapRef.current;
                        if (!m || m.getSource(srcId)) return;
                        m.addSource(srcId, {
                            type: 'geojson',
                            data: geojson as unknown as import('geojson').FeatureCollection,
                        });
                        m.addLayer({
                            id: fillId,
                            type: 'fill',
                            source: srcId,
                            paint: {
                                'fill-color': colorExpr(def) as never,
                                'fill-opacity': opacityExpr(def) as never,
                            },
                        });
                        m.addLayer({
                            id: lineId,
                            type: 'line',
                            source: srcId,
                            paint: {
                                'line-color': colorExpr(def) as never,
                                'line-width': 0,
                                'line-opacity': 0,
                            },
                        });
                        const filter = categoryFilter(
                            def,
                            categoryEnabledRef.current,
                        );
                        if (filter) {
                            m.setFilter(fillId, filter as never);
                            m.setFilter(lineId, filter as never);
                        }
                    })
                    .catch(() => loadedFeaturesRef.current.delete(def.id));
            } else if (loaded) {
                const vis = on ? 'visible' : 'none';
                if (map.getLayer(fillId))
                    map.setLayoutProperty(fillId, 'visibility', vis);
                if (map.getLayer(lineId))
                    map.setLayoutProperty(lineId, 'visibility', vis);
            }
        }
    }, [featureLayers]);

    // Re-apply category filters on the compare side.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        for (const def of FEATURE_LAYERS) {
            const fillId = `feat-b-${def.id}-fill`;
            const lineId = `feat-b-${def.id}-line`;
            if (!map.getLayer(fillId)) continue;
            const filter = categoryFilter(def, categoryEnabled);
            if (filter) {
                map.setFilter(fillId, filter as never);
                map.setFilter(lineId, filter as never);
            }
        }
    }, [categoryEnabled]);

    return (
        <div
            className="pointer-events-none absolute inset-0 z-[5]"
            style={{ clipPath: `inset(0 0 0 ${splitAt}%)` }}
        >
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
