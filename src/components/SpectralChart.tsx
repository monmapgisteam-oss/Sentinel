import type { SpectralPoint } from '../services/statistics';

interface Props {
    lngLat: { lng: number; lat: number };
    points: SpectralPoint[] | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
}

const W = 300;
const H = 170;
const PAD = { l: 34, r: 10, t: 10, b: 26 };

export default function SpectralChart({
    lngLat,
    points,
    loading,
    error,
    onClose,
}: Props) {
    const valid = (points ?? []).filter((p) => !Number.isNaN(p.reflectance));
    const maxR = Math.max(0.4, ...valid.map((p) => p.reflectance));
    const minW = 400;
    const maxW = 2200;

    const px = (wl: number) =>
        PAD.l + ((wl - minW) / (maxW - minW)) * (W - PAD.l - PAD.r);
    const py = (r: number) =>
        H - PAD.b - (r / maxR) * (H - PAD.t - PAD.b);

    const path = valid
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.wavelength)} ${py(p.reflectance)}`)
        .join(' ');

    return (
        <div className="absolute bottom-6 left-6 z-20 w-[330px] rounded-xl border border-white/10 bg-[#11161cf2] p-3 text-gray-200 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                    📊 Спектрийн муруй
                </span>
                <button
                    onClick={onClose}
                    className="rounded px-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                    ✕
                </button>
            </div>
            <p className="mb-1 text-[11px] text-gray-500">
                {lngLat.lat.toFixed(4)}°, {lngLat.lng.toFixed(4)}°
            </p>

            {loading && (
                <div className="py-8 text-center text-xs text-gray-400">
                    Ачаалж байна…
                </div>
            )}
            {!loading && error && (
                <div className="py-6 text-center text-xs text-yellow-300">
                    {error}
                </div>
            )}
            {!loading && !error && valid.length > 0 && (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                    {/* axes */}
                    <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#4b5563" strokeWidth={1} />
                    <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#4b5563" strokeWidth={1} />
                    {/* y ticks */}
                    {[0, maxR / 2, maxR].map((r, i) => (
                        <g key={i}>
                            <text x={PAD.l - 4} y={py(r) + 3} textAnchor="end" fontSize={8} fill="#9ca3af">
                                {r.toFixed(2)}
                            </text>
                        </g>
                    ))}
                    {/* x ticks */}
                    {[490, 842, 1610, 2190].map((wl) => (
                        <text key={wl} x={px(wl)} y={H - PAD.b + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
                            {wl}
                        </text>
                    ))}
                    <text x={(W) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="#6b7280">
                        Долгионы урт (nm)
                    </text>
                    {/* signature line */}
                    <path d={path} fill="none" stroke="#ffd23f" strokeWidth={1.8} />
                    {valid.map((p) => (
                        <circle key={p.name} cx={px(p.wavelength)} cy={py(p.reflectance)} r={2.4} fill="#ffd23f">
                            <title>{`${p.name}: ${p.reflectance.toFixed(3)}`}</title>
                        </circle>
                    ))}
                </svg>
            )}
            {!loading && !error && valid.length === 0 && !points && null}
        </div>
    );
}
