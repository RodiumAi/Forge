const gallery = [
  {
    src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=70",
    alt: "Team gathered around laptops during a product planning session",
  },
  {
    src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=70",
    alt: "Laptop showing source code during a release build",
  },
  {
    src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=70",
    alt: "Team collaborating at a shared desk in a bright office",
  },
];

export default function Gallery() {
  return (
    <section className="gallery" aria-label="Product in use">
      {gallery.map((img) => (
        <figure key={img.src} className="gallery-item">
          <img src={img.src} alt={img.alt} loading="lazy" />
        </figure>
      ))}
    </section>
  );
}
