const description =
  "Prototype ton projet web en moins de 5 minutes avec un seul prompt. Forge génère une vraie app React avec preview live — propulsé par RodiumAi.";

export function LandingJsonLd({ siteUrl }: { siteUrl: string }) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Forge by RodiumAi",
        description,
        inLanguage: ["fr", "en"],
        publisher: { "@id": `${siteUrl}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#org`,
        name: "RodiumAi",
        url: "https://rodiumai.io",
        logo: `${siteUrl}/logo-dark.png`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#app`,
        name: "Forge",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: siteUrl,
        description,
        image: `${siteUrl}/og.png`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Accessible with a RodiumAi account",
        },
        creator: { "@id": `${siteUrl}/#org` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw text; React escapes safely for JSON payloads.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
