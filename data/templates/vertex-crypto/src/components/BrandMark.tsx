// The Vertex "V" logo mark (a brand shape, not a UI icon).
export default function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 4l9 16L21 4h-5l-4 8-4-8H3z" fill="#00e5a0" />
    </svg>
  );
}
