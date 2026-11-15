export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
      <rect width="12" height="12" fill="#52290e" />
      {[6, 6, 5, 5, 6, 7, 7, 6, 5, 5, 6, 6].map((b, r) => (
        <rect key={r} x="0" y={r} width={b} height="1" fill="#f6eacc" />
      ))}
      <rect x="8" y="6" width="1" height="1" fill="#d9654f" />
      <circle cx="2.8" cy="8.4" r="0.78" fill="#1b0f07" shapeRendering="auto" />
      <circle cx="9.4" cy="3.6" r="0.78" fill="#e3b95f" shapeRendering="auto" />
    </svg>
  );
}
