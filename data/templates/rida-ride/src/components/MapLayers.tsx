import { MapPin } from "lucide-react";

type Props = { routeClass: string; viewBox: string; path: string };

/** CSS-only map: street grid, glowing route, origin dot and destination pin. */
export default function MapLayers({ routeClass, viewBox, path }: Props) {
  return (
    <>
      <div className="map-grid" />
      <svg className={routeClass} viewBox={viewBox} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span className="map-origin" />
      <span className="map-pin"><MapPin size={20} strokeWidth={1.8} aria-hidden /></span>
    </>
  );
}
