const products = [
  { img: "/01-photo-1579338559194-a162d19bf842.jpg", name: "AirFlex Runner", price: "$89" },
  { img: "/02-photo-1608667508764-33cf0726b13a.jpg", name: "Urban Street Pro", price: "$99" },
  { img: "/03-photo-1465453869711-7e174808ace9.jpg", name: "Classic Court 90s", price: "$79" },
  { img: "/04-photo-1512374382149-233c42b6a83b.jpg", name: "Volt Edge", price: "$119" },
  { img: "/05-photo-1608231387042-66d1773070a5.jpg", name: "Zenith Flow", price: "$129" },
  { img: "/06-photo-1511556532299-8f662fc26c06.jpg", name: "Street Vibe Low", price: "$69" },
  { img: "/07-photo-1516767254874-281bffac9e9a.jpg", name: "Nova Horizon", price: "$109" },
  { img: "/08-photo-1560769629-975ec94e6a86.jpg", name: "Pulse React", price: "$99" },
];

export default function App() {
  return (
    <div>
      <header className="top"><strong className="brand">BLOOMSHOP</strong><nav style={{display:"flex",gap:"1rem",color:"#6b7280"}}><a href="#">Contact</a><a href="#">Sign In</a></nav></header>
      <section className="hero">
        <h1>Step Into Style</h1>
        <p>Discover our latest collection of premium sneakers — comfort, design, and performance in every pair.</p>
      </section>
      <section className="grid">
        {products.map((p) => (
          <article className="card" key={p.name}>
            <img src={p.img} alt={p.name} />
            <div className="body">
              <h3 style={{margin:"0 0 .35rem",fontSize:"1rem"}}>{p.name}</h3>
              <div className="price">{p.price}.00</div>
              <button className="btn" type="button">Add to Cart</button>
            </div>
          </article>
        ))}
      </section>
      <section className="news">
        <h2 style={{marginTop:0}}>Stay in the loop</h2>
        <p style={{opacity:.75}}>Subscribe for exclusive offers and new arrivals.</p>
        <button className="btn" type="button" style={{background:"#fff",color:"#111",maxWidth:220,margin:"1rem auto 0"}}>Subscribe</button>
      </section>
    </div>
  );
}
