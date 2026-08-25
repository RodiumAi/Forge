export type ConnectorId = "rodiumai" | "supabase" | "firebase" | "resend" | "fedapay" | "cloudinary";

type ConnectorLogoAsset = {
  src: string;
  lightSrc?: string;
  alt: string;
};

export const CONNECTOR_LOGOS: Record<ConnectorId, ConnectorLogoAsset> = {
  rodiumai: {
    src: "/connectors/rodiumai.png",
    alt: "RodiumAi",
  },
  supabase: {
    src: "/connectors/supabase.svg",
    alt: "Supabase",
  },
  firebase: {
    src: "/connectors/firebase.svg",
    alt: "Firebase",
  },
  resend: {
    src: "/connectors/resend.svg",
    lightSrc: "/connectors/resend-light.svg",
    alt: "Resend",
  },
  fedapay: {
    src: "/connectors/fedapay.png",
    alt: "FedaPay",
  },
  cloudinary: {
    src: "/connectors/cloudinary.svg",
    alt: "Cloudinary",
  },
};

export function connectorLogoSrc(id: string, theme: "dark" | "light" = "dark"): string | null {
  const asset = CONNECTOR_LOGOS[id as ConnectorId];
  if (!asset) return null;
  if (theme === "light" && asset.lightSrc) return asset.lightSrc;
  return asset.src;
}

export function connectorLogoAlt(id: string): string {
  return CONNECTOR_LOGOS[id as ConnectorId]?.alt ?? id;
}
