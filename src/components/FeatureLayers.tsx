import { FEATURE_LAYERS } from '../config/featureLayers';

interface Props {
    enabled: Record<number, boolean>;
    loading: Record<number, boolean>;
    categoryEnabled: Record<number, Record<string, boolean>>;
    onToggle: (id: number) => void;
    onToggleCategory: (layerId: number, value: string) => void;
}

/** Thematic overlay toggles + category legends. Embedded in the right panel. */
export default function FeatureLayers({
    enabled,
    loading,
    categoryEnabled,
    onToggle,
    onToggleCategory,
}: Props) {
    return (
        <div className="space-y-1.5">
            {FEATURE_LAYERS.map((l) => (
                <div key={l.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white/5">
                        <input
                            type="checkbox"
                            checked={!!enabled[l.id]}
                            onChange={() => onToggle(l.id)}
                            className="accent-yellow-400"
                        />
                        {!l.categories && (
                            <span
                                className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/20"
                                style={{ backgroundColor: l.color }}
                            />
                        )}
                        <span className="flex-1 leading-tight">{l.name}</span>
                        {loading[l.id] && (
                            <span className="text-[10px] text-gray-400">…</span>
                        )}
                    </label>
                    {/* Unique-value legend with per-category toggles */}
                    {enabled[l.id] && l.categories && (
                        <div className="mb-1 ml-8 space-y-1 border-l border-white/10 pl-2 pt-1">
                            {l.categories.map((c) => (
                                <label
                                    key={c.value}
                                    className="flex cursor-pointer items-center gap-2 text-[11px] text-gray-300"
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            categoryEnabled[l.id]?.[c.value] !==
                                            false
                                        }
                                        onChange={() =>
                                            onToggleCategory(l.id, c.value)
                                        }
                                        className="h-3 w-3 accent-yellow-400"
                                    />
                                    <span
                                        className="inline-block h-2.5 w-4 shrink-0 rounded-sm border border-white/20"
                                        style={{ backgroundColor: c.color }}
                                    />
                                    <span className="font-medium">
                                        {c.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
