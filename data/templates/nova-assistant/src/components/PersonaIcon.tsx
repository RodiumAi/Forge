import { personaById } from "../data";

/** A persona's icon in a tinted, softly glowing tile. */
export default function PersonaIcon({ id, size = "md" }: { id: string; size?: "sm" | "md" | "lg" }) {
  const p = personaById(id);
  const Icon = p.icon;
  const px = size === "lg" ? 24 : size === "sm" ? 16 : 19;
  return (
    <span className={`p-icon p-${size} tone-${p.tone}`}>
      <Icon size={px} strokeWidth={1.9} aria-hidden />
    </span>
  );
}
