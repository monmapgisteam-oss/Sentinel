import type { Scene } from '../services/catalog';

interface Props {
    scenes: Scene[] | null;
    loading: boolean;
    selectedDate: string | null;
    onSearch: () => void;
    onPick: (scene: Scene) => void;
}

const cloudColor = (c: number) =>
    c < 10 ? '#4ade80' : c < 30 ? '#facc15' : c < 60 ? '#fb923c' : '#f87171';

export default function ScenePicker({
    scenes,
    loading,
    selectedDate,
    onSearch,
    onPick,
}: Props) {
    return (
        <div>
            <button
                onClick={onSearch}
                disabled={loading}
                className="mb-2 w-full rounded bg-yellow-400 px-2 py-1.5 text-xs font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
            >
                {loading ? 'Хайж байна…' : '🔍 Энэ байршлын зургуудыг хайх'}
            </button>

            {scenes && scenes.length === 0 && !loading && (
                <p className="text-[11px] text-gray-500">
                    Зураг олдсонгүй. Огнооны мужаа өргөсгөж үзнэ үү.
                </p>
            )}

            {scenes && scenes.length > 0 && (
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {scenes.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => onPick(s)}
                            className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition ${
                                selectedDate === s.date
                                    ? 'bg-yellow-400 text-black'
                                    : 'bg-white/5 text-gray-200 hover:bg-white/10'
                            }`}
                        >
                            <span className="font-medium">{s.date}</span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: cloudColor(s.cloud) }}
                                />
                                <span
                                    className={
                                        selectedDate === s.date
                                            ? 'text-black/70'
                                            : 'text-gray-400'
                                    }
                                >
                                    ☁ {s.cloud}%
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <p className="mt-1 text-[11px] text-gray-500">
                Газрын зургийн голд байгаа цэгийн зургууд. Өнгөт цэг = үүлшилт.
            </p>
        </div>
    );
}
