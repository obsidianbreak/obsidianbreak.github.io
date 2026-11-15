import { useEffect, useRef } from "react";

export default function BoardThumb({ cells, cols, rows }: { cells: number[]; cols: number; rows: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const s = 6;
    c.width = cols * s;
    c.height = rows * s;
    cells.forEach((v, i) => {
      ctx.fillStyle = v === 0 ? "#f6eacc" : v === 1 ? "#52290e" : "#a89472";
      ctx.fillRect((i % cols) * s, Math.floor(i / cols) * s, s, s);
    });
  }, [cells, cols, rows]);
  return <canvas ref={ref} className="thumb" />;
}
