interface Props {
    splitAt: number;
    onChange: (v: number) => void;
}

/** Draggable vertical divider for the swipe comparison. */
export default function CompareDivider({ splitAt, onChange }: Props) {
    const startDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        const onMove = (ev: MouseEvent) => {
            const pct = (ev.clientX / window.innerWidth) * 100;
            onChange(Math.min(95, Math.max(5, pct)));
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
            className="absolute top-0 z-[6] h-full"
            style={{ left: `${splitAt}%` }}
        >
            <div className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-yellow-400" />
            <div
                onMouseDown={startDrag}
                className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-yellow-400 bg-[#11161c] text-yellow-400 shadow-lg"
            >
                ⇆
            </div>
        </div>
    );
}
