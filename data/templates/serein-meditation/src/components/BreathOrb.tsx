/** Signature element: layered gradient orb that swells for 4s and settles for 4s.
 *  The two captions cross-fade on the same rhythm (pure CSS, see index.css). */
export default function BreathOrb({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <div className={`orb orb-${size}`} aria-hidden>
      <span className="orb-halo" />
      <span className="orb-ring" />
      <span className="orb-core" />
      {size === "lg" && (
        <span className="orb-words">
          <b className="in">Breathe in</b>
          <b className="out">Breathe out</b>
        </span>
      )}
    </div>
  );
}
