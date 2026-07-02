import {
    useState,
    type ReactNode,
    type MouseEvent as ReactMouseEvent,
} from 'react';
import { RENDERERS, type RendererId } from '../services/evalscripts';
import type { Scene } from '../services/catalog';
import type { Mode } from '../App';
import ScenePicker from './ScenePicker';
import FeatureLayers from './FeatureLayers';

interface Props {
    renderer: RendererId;
    mode: Mode;
    scenes: Scene[] | null;
    scenesLoading: boolean;
    sceneDate: string | null;
    width: number;
    compareOn: boolean;
    bRenderer: RendererId;
    featureLayers: Record<number, boolean>;
    featureLoading: Record<number, boolean>;
    categoryEnabled: Record<number, Record<string, boolean>>;
    onRendererChange: (r: RendererId) => void;
    onModeChange: (m: Mode) => void;
    onSearchScenes: () => void;
    onPickScene: (s: Scene) => void;
    onToggleCompare: () => void;
    onBRendererChange: (r: RendererId) => void;
    onWidthChange: (w: number) => void;
    onToggleFeature: (id: number) => void;
    onToggleCategory: (layerId: number, value: string) => void;
}

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

export default function ControlPanel({
    renderer,
    mode,
    scenes,
    scenesLoading,
    sceneDate,
    width,
    compareOn,
    bRenderer,
    featureLayers,
    featureLoading,
    categoryEnabled,
    onRendererChange,
    onModeChange,
    onSearchScenes,
    onPickScene,
    onToggleCompare,
    onBRendererChange,
    onWidthChange,
    onToggleFeature,
    onToggleCategory,
}: Props) {
    const composites = RENDERERS.filter((r) => r.group === 'composite');
    const indices = RENDERERS.filter((r) => r.group === 'index');
    const active = RENDERERS.find((r) => r.id === renderer);

    const startResize = (e: ReactMouseEvent) => {
        e.preventDefault();
        const onMove = (ev: MouseEvent) => {
            const next = Math.min(
                MAX_WIDTH,
                Math.max(MIN_WIDTH, window.innerWidth - ev.clientX),
            );
            onWidthChange(next);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div
            className="absolute top-0 right-0 z-10 h-full bg-[#11161cee] backdrop-blur border-l border-white/10 text-xs text-gray-200"
            style={{ width }}
        >
            {/* Resize handle (fixed to the panel edge, outside the scroll area) */}
            <div
                onMouseDown={startResize}
                title="Чирж өргөнийг өөрчлөх"
                className="group absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize hover:bg-yellow-400/40"
            >
                <div className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-white/25 group-hover:bg-yellow-400" />
            </div>

            {/* Scrollable content */}
            <div className="custom-scroll h-full overflow-y-auto p-4">
            <h1 className="text-lg font-semibold text-white">
                🛰️ Mongolia Imagery Explorer
            </h1>
            <p className="mt-1 text-xs text-gray-400">
                Sentinel-2 · Copernicus / ESA
            </p>

            {/* Renderer */}
            <Section title="Дүрслэл (Renderer)">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                    Зураг (Composite)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                    {composites.map((r) => (
                        <RendererButton
                            key={r.id}
                            label={r.label}
                            active={renderer === r.id}
                            onClick={() => onRendererChange(r.id)}
                        />
                    ))}
                </div>
                <p className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-gray-500">
                    Индекс (Analysis)
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                    {indices.map((r) => (
                        <RendererButton
                            key={r.id}
                            label={r.label}
                            active={renderer === r.id}
                            onClick={() => onRendererChange(r.id)}
                        />
                    ))}
                </div>
            </Section>

            {/* Mode */}
            <Section title="Горим">
                <div className="grid grid-cols-2 gap-1.5">
                    <ModeButton
                        label="Динамик"
                        active={mode === 'dynamic'}
                        onClick={() => onModeChange('dynamic')}
                    />
                    <ModeButton
                        label="Зураг сонгох"
                        active={mode === 'scene'}
                        onClick={() => onModeChange('scene')}
                    />
                </div>
            </Section>

            {/* Scene list (find-a-scene mode) */}
            {mode === 'scene' && (
                <Section title="Зургууд">
                    <ScenePicker
                        scenes={scenes}
                        loading={scenesLoading}
                        selectedDate={sceneDate}
                        onSearch={onSearchScenes}
                        onPick={onPickScene}
                    />
                </Section>
            )}

            {/* Swipe comparison */}
            <Section title="Харьцуулах (Swipe)">
                <button
                    onClick={onToggleCompare}
                    className={`w-full rounded px-2 py-2 text-xs font-medium transition ${
                        compareOn
                            ? 'bg-yellow-400 text-black'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                >
                    Энд дарж сонгоно уу
                </button>
                {compareOn && (
                    <div className="mt-2">
                        <p className="mb-1 text-[11px] text-gray-500">
                            Зүүн тал: <b>{active?.label}</b> · Баруун тал (доор
                            сонго):
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                            {RENDERERS.map((r) => (
                                <RendererButton
                                    key={r.id}
                                    label={r.label}
                                    active={bRenderer === r.id}
                                    onClick={() => onBRendererChange(r.id)}
                                />
                            ))}
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">
                            Голын шар бариулыг чирж хуваалтыг зөөнө.
                        </p>
                    </div>
                )}
            </Section>

            {/* Thematic overlay layers */}
            <Section title="Давхарга" defaultOpen={false}>
                <FeatureLayers
                    enabled={featureLayers}
                    loading={featureLoading}
                    categoryEnabled={categoryEnabled}
                    onToggle={onToggleFeature}
                    onToggleCategory={onToggleCategory}
                />
            </Section>
            </div>
        </div>
    );
}

function Section({
    title,
    children,
    defaultOpen = true,
}: {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="mt-5">
            <button
                onClick={() => setOpen((v) => !v)}
                className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-white"
            >
                <span>{title}</span>
                <span className="text-gray-400">{open ? '▾' : '▸'}</span>
            </button>
            {open && children}
        </div>
    );
}

function RendererButton({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded px-2 py-1.5 text-xs font-medium transition ${
                active
                    ? 'bg-yellow-400 text-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
        >
            {label}
        </button>
    );
}

function ModeButton({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded px-2 py-2 text-xs font-medium transition ${
                active
                    ? 'bg-yellow-400 text-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
        >
            {label}
        </button>
    );
}
