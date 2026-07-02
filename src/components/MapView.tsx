import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    MONGOLIA_CENTER,
    MONGOLIA_ZOOM,
    MONGOLIA_BBOX,
    MAX_BOUNDS,
    COUNTRY_BOUNDARY_URL,
} from '../config/mongolia';

import {
    registerSentinelHubProtocol,
    buildTileUrl,
    type TileParams,
} from '../services/sentinelHub';
import {
    FEATURE_LAYERS,
    abbreviateLandscape,
    catValues,
    type FeatureLayerDef,
} from '../config/featureLayers';
import { fetchArcgisLayer } from '../services/arcgisFeatures';

/** Filter a categorized thematic layer to only its enabled categories. */
function applyCategoryFilter(
    map: maplibregl.Map,
    def: FeatureLayerDef,
    catEnabled: Record<number, Record<string, boolean>>,
) {
    if (!def.categories || !def.categoryField) return;
    const fillId = `feat-${def.id}-fill`;
    const lineId = `feat-${def.id}-line`;
    if (!map.getLayer(fillId)) return;
    const vals = def.categories
        .filter((c) => catEnabled[def.id]?.[c.value] !== false)
        .flatMap(catValues);
    const filter = [
        'in',
        ['get', def.categoryField],
        ['literal', vals],
    ] as unknown as maplibregl.FilterSpecification;
    map.setFilter(fillId, filter);
    map.setFilter(lineId, filter);
}

const BASEMAP_STYLE =
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const SH_SOURCE = 'sentinel-hub';
const SH_LAYER = 'sentinel-hub-layer';
const COUNTRY_LAYER = 'bnd-country';

interface Props {
    params: TileParams;
    /** opacity 0-1 of the imagery layer */
    opacity: number;
    /** width of the right-side panel (px) to keep the country clear of it */
    panelWidth: number;
    /** fired when the user clicks the map (for spectral sampling) */
    onMapClick?: (lngLat: { lng: number; lat: number }) => void;
    /** marker location, or null to hide */
    marker?: { lng: number; lat: number } | null;
    /** fired once with the map instance (for the compare overlay) */
    onReady?: (map: maplibregl.Map) => void;
    /** which ArcGIS thematic layers are enabled (by layer id) */
    featureLayers: Record<number, boolean>;
    /** per-layer, per-category visibility (category on unless set false) */
    categoryEnabled: Record<number, Record<string, boolean>>;
    /** report loading state of a thematic layer */
    onFeatureLoading?: (id: number, loading: boolean) => void;
}

export default function MapView({
    params,
    opacity,
    panelWidth,
    onMapClick,
    marker,
    onReady,
    featureLayers,
    categoryEnabled,
    onFeatureLoading,
}: Props) {
    const onFeatureLoadingRef = useRef(onFeatureLoading);
    onFeatureLoadingRef.current = onFeatureLoading;
    const loadedFeaturesRef = useRef<Set<number>>(new Set());
    const categoryEnabledRef = useRef(categoryEnabled);
    categoryEnabledRef.current = categoryEnabled;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    // Keep latest panel width available to the once-only load handler.
    const panelWidthRef = useRef(panelWidth);
    panelWidthRef.current = panelWidth;

    // Latest click handler (avoids stale closure in the once-only listener).
    const onMapClickRef = useRef(onMapClick);
    onMapClickRef.current = onMapClick;

    // Basemap layer id above which the imagery is inserted, so the basemap's
    // internal boundary lines (and labels) stay visible over the imagery.
    const beforeIdRef = useRef<string | undefined>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markerRef = useRef<maplibregl.Marker | null>(null);

    // Imagery only loads at zoom ≥ IMAGERY_MINZOOM (skips the huge, slow low-zoom
    // tiles). Show a hint below that so the empty basemap isn't confusing.
    const [zoomedOut, setZoomedOut] = useState(true);

    // Hover tooltip for thematic feature layers.
    const [hover, setHover] = useState<{
        x: number;
        y: number;
        title: string;
        lines: string[];
    } | null>(null);

    // Representative-fraction map scale (1 : N).
    const [scaleDenom, setScaleDenom] = useState<number | null>(null);

    // Initialise the map once.
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        registerSentinelHubProtocol();

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: BASEMAP_STYLE,
            center: MONGOLIA_CENTER,
            zoom: MONGOLIA_ZOOM,
            minZoom: 4,
            maxBounds: MAX_BOUNDS,
            attributionControl: false,
        });
        mapRef.current = map;
        onReadyRef.current?.(map);

        map.addControl(new maplibregl.NavigationControl(), 'top-left');
        // Attribution first → sits at the very bottom of the bottom-left stack.
        map.addControl(
            new maplibregl.AttributionControl({
                compact: true,
                customAttribution:
                    'Sentinel-2 © Copernicus / ESA · Boundaries © NSDI Mongolia · Basemap © CARTO',
            }),
            'bottom-left',
        );

        map.on('click', (e) => {
            onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        });

        const track = () => {
            const zoom = map.getZoom();
            setZoomedOut(zoom < 5);
            // Representative fraction: metres/pixel ÷ nominal screen pixel (0.28 mm).
            const lat = map.getCenter().lat;
            const mpp =
                (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) /
                Math.pow(2, zoom + 9);
            setScaleDenom(Math.round(mpp / 0.00028));
        };
        map.on('move', track);
        track();

        map.on('load', () => {
            // Find the lowest basemap boundary line layer. Inserting the imagery
            // just below it keeps the basemap's aimag/soum boundaries (and the
            // labels above them) visible on top of the Sentinel imagery.
            const firstBoundary = (map.getStyle().layers ?? []).find(
                (l) => l.type === 'line' && /boundary|admin/i.test(l.id),
            );
            beforeIdRef.current = firstBoundary?.id;

            // Brighten the basemap's internal admin boundaries (aimag/soum) so
            // they read clearly over the dark imagery.
            for (const l of map.getStyle().layers ?? []) {
                if (l.type !== 'line') continue;
                if (/county|state/i.test(l.id)) {
                    map.setPaintProperty(l.id, 'line-color', '#e6ebf2');
                    map.setPaintProperty(l.id, 'line-opacity', 0.8);
                    map.setPaintProperty(
                        l.id,
                        'line-width',
                        /state/i.test(l.id) ? 1.1 : 0.7,
                    );
                }
            }

            // Sentinel Hub imagery
            map.addSource(SH_SOURCE, {
                type: 'raster',
                tiles: [buildTileUrl(params)],
                tileSize: 512,
                attribution: 'Sentinel-2 © Copernicus',
            });
            map.addLayer(
                {
                    id: SH_LAYER,
                    type: 'raster',
                    source: SH_SOURCE,
                    minzoom: 5,
                    paint: {
                        'raster-opacity': opacity,
                        'raster-fade-duration': 0,
                    },
                },
                beforeIdRef.current,
            );

            // Official national boundary (user data). Internal admin divisions
            // are provided by the basemap.
            map.addSource('country', {
                type: 'geojson',
                data: COUNTRY_BOUNDARY_URL,
            });
            map.addLayer({
                id: COUNTRY_LAYER,
                type: 'line',
                source: 'country',
                paint: {
                    'line-color': '#ffd23f',
                    'line-width': 1.8,
                    'line-opacity': 0.95,
                },
            });

            // Frame the whole country in the area not covered by the panel.
            map.fitBounds(MONGOLIA_BBOX, {
                padding: {
                    top: 24,
                    bottom: 24,
                    left: 24,
                    right: panelWidthRef.current + 24,
                },
                duration: 0,
            });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-render imagery when params change (remove + re-add raster source).
    useEffect(() => {
        const map = mapRef.current;
        // Only guard on the source existing — it is added in the load handler, so
        // its presence means the style is ready. Do NOT gate on isStyleLoaded():
        // it returns false while tiles are loading, which would silently drop
        // renderer/date changes made mid-load.
        if (!map || !map.getSource(SH_SOURCE)) return;

        if (map.getLayer(SH_LAYER)) map.removeLayer(SH_LAYER);
        if (map.getSource(SH_SOURCE)) map.removeSource(SH_SOURCE);

        map.addSource(SH_SOURCE, {
            type: 'raster',
            tiles: [buildTileUrl(params)],
            tileSize: 512,
        });
        // Re-insert imagery below the basemap boundary lines (same as on load).
        const beforeId =
            beforeIdRef.current && map.getLayer(beforeIdRef.current)
                ? beforeIdRef.current
                : undefined;
        map.addLayer(
            {
                id: SH_LAYER,
                type: 'raster',
                source: SH_SOURCE,
                minzoom: 4,
                paint: {
                    'raster-opacity': opacity,
                    'raster-fade-duration': 0,
                },
            },
            beforeId,
        );
    }, [params, opacity]);

    // Opacity-only updates.
    useEffect(() => {
        const map = mapRef.current;
        if (map?.getLayer(SH_LAYER)) {
            map.setPaintProperty(SH_LAYER, 'raster-opacity', opacity);
        }
    }, [opacity]);

    // Shift the bottom-right map controls left of the panel so they stay visible.
    useEffect(() => {
        containerRef.current?.style.setProperty(
            '--panel-w',
            `${panelWidth}px`,
        );
    }, [panelWidth]);

    // Sampling marker.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!marker) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }
        if (!markerRef.current) {
            markerRef.current = new maplibregl.Marker({ color: '#ffd23f' });
        }
        markerRef.current.setLngLat([marker.lng, marker.lat]).addTo(map);
    }, [marker]);

    // ArcGIS thematic overlays: lazy-fetch on first enable, then toggle
    // visibility. Sources/layers are kept once loaded (cached).
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.getLayer(COUNTRY_LAYER)) return; // wait for load

        for (const def of FEATURE_LAYERS) {
            const on = !!featureLayers[def.id];
            const srcId = `feat-${def.id}`;
            const fillId = `${srcId}-fill`;
            const lineId = `${srcId}-line`;
            const loaded = loadedFeaturesRef.current.has(def.id);

            if (on && !loaded) {
                loadedFeaturesRef.current.add(def.id); // guard against re-fetch
                onFeatureLoadingRef.current?.(def.id, true);
                const fields = [def.categoryField, def.popupField].filter(
                    (f): f is string => Boolean(f),
                );
                fetchArcgisLayer(def.id, fields)
                    .then((geojson) => {
                        if (!mapRef.current) return;
                        const m = mapRef.current;
                        if (!m.getSource(srcId)) {
                            // Unique-value color by category field, or a flat color.
                            const catStyled =
                                def.categories && def.categoryField;
                            const colorExpr = catStyled
                                ? ([
                                      'match',
                                      ['get', def.categoryField],
                                      ...def.categories!.flatMap((c) => [
                                          catValues(c),
                                          c.color,
                                      ]),
                                      def.color,
                                  ] as unknown as string)
                                : def.color;
                            const opacityExpr = catStyled
                                ? ([
                                      'match',
                                      ['get', def.categoryField],
                                      ...def.categories!.flatMap((c) => [
                                          catValues(c),
                                          c.opacity ?? 0.45,
                                      ]),
                                      0.45,
                                  ] as unknown as number)
                                : 0.45;
                            m.addSource(srcId, {
                                type: 'geojson',
                                data: geojson as unknown as import('geojson').FeatureCollection,
                            });
                            m.addLayer({
                                id: fillId,
                                type: 'fill',
                                source: srcId,
                                paint: {
                                    'fill-color': colorExpr,
                                    'fill-opacity': opacityExpr,
                                },
                            });
                            m.addLayer({
                                id: lineId,
                                type: 'line',
                                source: srcId,
                                paint: {
                                    'line-color': colorExpr,
                                    'line-width': 0,
                                    'line-opacity': 0,
                                },
                            });
                            applyCategoryFilter(
                                m,
                                def,
                                categoryEnabledRef.current,
                            );

                            // Click popup showing the field value.
                            if (def.popupField) {
                                const field = def.popupField;
                                const abbr = def.popupAbbreviate;
                                m.on('click', fillId, (ev) => {
                                    const raw = ev.features?.[0]?.properties?.[
                                        field
                                    ] as string | undefined;
                                    if (!raw) return;
                                    const text = abbr
                                        ? abbreviateLandscape(raw)
                                        : raw;
                                    new maplibregl.Popup({ closeButton: true })
                                        .setLngLat(ev.lngLat)
                                        .setHTML(
                                            `<div style="font-size:12px;color:#111;max-width:240px">${text}</div>`,
                                        )
                                        .addTo(m);
                                });
                            }

                            // Hover tooltip (all thematic layers).
                            m.on('mousemove', fillId, (ev) => {
                                const props = ev.features?.[0]?.properties;
                                if (!props) return;
                                const lines: string[] = [];
                                if (def.categoryField) {
                                    const val = String(
                                        props[def.categoryField] ?? '',
                                    );
                                    const cat = def.categories?.find((c) =>
                                        catValues(c).includes(val),
                                    );
                                    if (val) lines.push(cat ? cat.label : val);
                                }
                                if (def.popupField) {
                                    const raw = props[def.popupField] as
                                        | string
                                        | undefined;
                                    if (raw)
                                        lines.push(
                                            def.popupAbbreviate
                                                ? abbreviateLandscape(raw)
                                                : raw,
                                        );
                                }
                                m.getCanvas().style.cursor = 'pointer';
                                setHover({
                                    x: ev.point.x,
                                    y: ev.point.y,
                                    title: def.name,
                                    lines,
                                });
                            });
                            m.on('mouseleave', fillId, () => {
                                m.getCanvas().style.cursor = '';
                                setHover(null);
                            });
                        }
                    })
                    .catch((e) => {
                        console.warn('ArcGIS layer алдаа', def.id, e);
                        loadedFeaturesRef.current.delete(def.id); // allow retry
                    })
                    .finally(() => onFeatureLoadingRef.current?.(def.id, false));
            } else if (loaded) {
                const vis = on ? 'visible' : 'none';
                if (map.getLayer(fillId))
                    map.setLayoutProperty(fillId, 'visibility', vis);
                if (map.getLayer(lineId))
                    map.setLayoutProperty(lineId, 'visibility', vis);
            }
        }
    }, [featureLayers]);

    // Re-apply category filters when per-category toggles change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        for (const def of FEATURE_LAYERS) {
            applyCategoryFilter(map, def, categoryEnabled);
        }
    }, [categoryEnabled]);

    return (
        <>
            <div ref={containerRef} className="h-full w-full" />
            {zoomedOut && (
                <div className="pointer-events-none absolute left-1/2 top-4 z-[8] -translate-x-1/2 rounded-full border border-white/10 bg-[#11161cef] px-4 py-2 text-xs text-gray-200 backdrop-blur">
                    🔍 Хиймэл дагуулын зураг харахын тулд ойртуулна уу
                </div>
            )}
            {scaleDenom && (
                <div
                    className="pointer-events-none absolute top-2 z-[8] rounded bg-[#11161cd0] px-2 py-1 text-[11px] font-medium text-gray-100 backdrop-blur"
                    style={{ right: panelWidth + 8 }}
                >
                    Масштаб 1 : {scaleDenom.toLocaleString('en-US')}
                </div>
            )}
            {hover && hover.lines.length > 0 && (
                <div
                    className="pointer-events-none absolute z-[9] max-w-[240px] rounded-md border border-white/10 bg-[#11161cf5] px-2.5 py-1.5 text-xs text-gray-100 shadow-lg backdrop-blur"
                    style={{
                        left: hover.x + 14,
                        top: hover.y + 14,
                    }}
                >
                    <div className="mb-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                        {hover.title}
                    </div>
                    {hover.lines.map((l, i) => (
                        <div key={i} className="leading-snug">
                            {l}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
