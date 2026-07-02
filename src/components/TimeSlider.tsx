import { useMemo } from 'react';

interface Props {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}

interface Month {
    year: number;
    month: number; // 1-12
    label: string;
    from: string;
    to: string;
}

const START = { year: 2022, month: 6 };
const END = { year: 2025, month: 9 };

// Months on each side of the selected month included in the query window, so a
// single position still has enough acquisitions to avoid no-data (black) gaps.
const WINDOW = 1;

const pad = (n: number) => String(n).padStart(2, '0');

/** Build the list of selectable months between START and END. */
function buildMonths(): Month[] {
    const out: Month[] = [];
    let y = START.year;
    let m = START.month;
    while (y < END.year || (y === END.year && m <= END.month)) {
        // Query window = [month-WINDOW .. month+WINDOW]. JS Date rolls months over.
        const fromD = new Date(y, m - 1 - WINDOW, 1);
        const toD = new Date(y, m - 1 + WINDOW + 1, 0); // day 0 → last day
        out.push({
            year: y,
            month: m,
            label: `${y}.${pad(m)}`,
            from: `${fromD.getFullYear()}-${pad(fromD.getMonth() + 1)}-01`,
            to: `${toD.getFullYear()}-${pad(toD.getMonth() + 1)}-${pad(
                toD.getDate(),
            )}`,
        });
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
    }
    return out;
}

export default function TimeSlider({ from, to, onChange }: Props) {
    const months = useMemo(buildMonths, []);

    // Find the month index whose range best matches the current from/to.
    const index = useMemo(() => {
        const exact = months.findIndex((mo) => mo.from === from && mo.to === to);
        if (exact >= 0) return exact;
        // Fall back to matching the year-month of `from`.
        const ym = from.slice(0, 7);
        const near = months.findIndex((mo) => mo.from.slice(0, 7) === ym);
        return near >= 0 ? near : months.length - 1;
    }, [from, to, months]);

    const current = months[index];

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-white">🗓️ Хугацаа</span>
                <span className="rounded bg-yellow-400 px-2 py-0.5 font-semibold text-black">
                    {current.label}
                </span>
            </div>
            <input
                type="range"
                min={0}
                max={months.length - 1}
                value={index}
                onChange={(e) => {
                    const mo = months[Number(e.target.value)];
                    onChange(mo.from, mo.to);
                }}
                className="w-full accent-yellow-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                <span>{months[0].label}</span>
                <span>{months[months.length - 1].label}</span>
            </div>
        </div>
    );
}
