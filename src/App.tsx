import { useMemo, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import MapView from './components/MapView';
import ControlPanel from './components/ControlPanel';
import SpectralChart from './components/SpectralChart';
import CompareMap from './components/CompareMap';
import CompareDivider from './components/CompareDivider';
import { hasCredentials, type TileParams } from './services/sentinelHub';
import type { RendererId } from './services/evalscripts';
import { findScenes, type Scene } from './services/catalog';
import {
    getSpectralSignature,
    type SpectralPoint,
} from './services/statistics';

interface LngLat {
    lng: number;
    lat: number;
}

export type Mode = 'dynamic' | 'scene';
const MAX_CLOUD = 20;

export default function App() {
    const [renderer, setRenderer] = useState<RendererId>('natural-color');
    // Fixed imagery date window (mosaic + scene search range).
    const windowFrom = '2024-06-01';
    const windowTo = '2024-08-31';

    // Mode: dynamic mosaic over the window, or a single picked scene.
    const [mode, setMode] = useState<Mode>('dynamic');
    const [sceneDate, setSceneDate] = useState<string | null>(null);
    const [scenes, setScenes] = useState<Scene[] | null>(null);
    const [scenesLoading, setScenesLoading] = useState(false);

    const opacity = 1;
    const [panelWidth, setPanelWidth] = useState(380);

    // Spectral sampling
    const [point, setPoint] = useState<LngLat | null>(null);
    const [spectral, setSpectral] = useState<SpectralPoint[] | null>(null);
    const [specLoading, setSpecLoading] = useState(false);
    const [specError, setSpecError] = useState<string | null>(null);

    // ArcGIS thematic overlay layers
    const [featureLayers, setFeatureLayers] = useState<Record<number, boolean>>(
        {},
    );
    const [featureLoading, setFeatureLoading] = useState<
        Record<number, boolean>
    >({});
    // Per-layer, per-category visibility (a category is on unless set false).
    const [categoryEnabled, setCategoryEnabled] = useState<
        Record<number, Record<string, boolean>>
    >({});

    const toggleCategory = (layerId: number, value: string) =>
        setCategoryEnabled((prev) => {
            const layer = prev[layerId] ?? {};
            const current = layer[value] !== false;
            return { ...prev, [layerId]: { ...layer, [value]: !current } };
        });

    // Swipe comparison
    const [baseMap, setBaseMap] = useState<maplibregl.Map | null>(null);
    const [compareOn, setCompareOn] = useState(false);
    const [bRenderer, setBRenderer] = useState<RendererId>('ndvi');
    const [splitAt, setSplitAt] = useState(50);

    // Imagery params: a single scene day in scene mode, else the window mosaic.
    const params: TileParams = useMemo(() => {
        const single = mode === 'scene' && sceneDate;
        return {
            renderer,
            maxCloud: MAX_CLOUD,
            from: single ? sceneDate : windowFrom,
            to: single ? sceneDate : windowTo,
        };
    }, [renderer, mode, sceneDate, windowFrom, windowTo]);

    const handleModeChange = (m: Mode) => {
        setMode(m);
        if (m === 'dynamic') setSceneDate(null);
    };

    const searchScenes = async () => {
        if (!baseMap) return;
        const c = baseMap.getCenter();
        setScenesLoading(true);
        setScenes(null);
        try {
            const found = await findScenes(c.lng, c.lat, windowFrom, windowTo);
            setScenes(found);
        } finally {
            setScenesLoading(false);
        }
    };

    const handleMapClick = async (lngLat: LngLat) => {
        setPoint(lngLat);
        setSpectral(null);
        setSpecError(null);
        setSpecLoading(true);
        try {
            const sig = await getSpectralSignature(
                lngLat.lng,
                lngLat.lat,
                params.from,
                params.to,
                MAX_CLOUD,
            );
            if (!sig) {
                setSpecError('Энэ цэгт өгөгдөл олдсонгүй (үүл/огноо шалгана уу).');
            } else {
                setSpectral(sig);
            }
        } catch {
            setSpecError('Спектр татахад алдаа гарлаа.');
        } finally {
            setSpecLoading(false);
        }
    };

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-[#0b0e12]">
            <MapView
                params={params}
                opacity={opacity}
                panelWidth={panelWidth}
                onMapClick={handleMapClick}
                marker={point}
                onReady={setBaseMap}
                featureLayers={featureLayers}
                categoryEnabled={categoryEnabled}
                onFeatureLoading={(id, loading) =>
                    setFeatureLoading((prev) => ({ ...prev, [id]: loading }))
                }
            />
            {compareOn && baseMap && (
                <CompareMap
                    baseMap={baseMap}
                    params={{ ...params, renderer: bRenderer }}
                    splitAt={splitAt}
                    featureLayers={featureLayers}
                    categoryEnabled={categoryEnabled}
                />
            )}
            {compareOn && (
                <CompareDivider splitAt={splitAt} onChange={setSplitAt} />
            )}
            <ControlPanel
                renderer={renderer}
                mode={mode}
                scenes={scenes}
                scenesLoading={scenesLoading}
                sceneDate={sceneDate}
                width={panelWidth}
                compareOn={compareOn}
                bRenderer={bRenderer}
                featureLayers={featureLayers}
                featureLoading={featureLoading}
                categoryEnabled={categoryEnabled}
                onRendererChange={setRenderer}
                onModeChange={handleModeChange}
                onSearchScenes={searchScenes}
                onPickScene={(s) => setSceneDate(s.date)}
                onToggleCompare={() => setCompareOn((v) => !v)}
                onBRendererChange={setBRenderer}
                onWidthChange={setPanelWidth}
                onToggleFeature={(id) =>
                    setFeatureLayers((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                onToggleCategory={toggleCategory}
            />
            {point && (
                <SpectralChart
                    lngLat={point}
                    points={spectral}
                    loading={specLoading}
                    error={specError}
                    onClose={() => setPoint(null)}
                />
            )}
            {!hasCredentials() && <CredsBanner />}
        </div>
    );
}

function CredsBanner() {
    return (
        <div className="absolute bottom-4 left-4 z-20 max-w-md rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-100">
            <strong>⚠️ Sentinel Hub холболт тохируулаагүй.</strong>
            <p className="mt-1 leading-relaxed">
                Зураг харагдахын тулд{' '}
                <a
                    href="https://dataspace.copernicus.eu/"
                    target="_blank"
                    className="underline"
                    rel="noreferrer"
                >
                    Copernicus Data Space
                </a>{' '}
                дээр үнэгүй бүртгүүлж, OAuth client үүсгээд төслийн{' '}
                <code className="rounded bg-black/30 px-1">.env</code> файлд{' '}
                <code className="rounded bg-black/30 px-1">VITE_SH_CLIENT_ID</code>{' '}
                ба{' '}
                <code className="rounded bg-black/30 px-1">
                    VITE_SH_CLIENT_SECRET
                </code>{' '}
                оруулна уу.
            </p>
        </div>
    );
}
