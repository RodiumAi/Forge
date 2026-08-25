export default function App() {
  const menu = [
    { img: "/01-1.jpg", cat: "Burgers", title: "Classic Smash Burger", desc: "Double smashed patty, cheddar, caramelized onions & special sauce", price: "$14.99" },
    { img: "/02-2.jpg", cat: "Pizza", title: "Margherita Royale", desc: "San Marzano tomatoes, buffalo mozzarella, basil & truffle oil", price: "$19.99" },
    { img: "/03-3.jpg", cat: "Chicken", title: "Nashville Hot Chicken", desc: "Crispy fried chicken in fiery spice blend with honey drizzle", price: "$12.99" },
    { img: "/04-4.jpg", cat: "Wraps", title: "Loaded Fajita Wrap", desc: "Grilled chicken, peppers, sour cream & guacamole", price: "$10.99" },
    { img: "/05-5.jpg", cat: "Desserts", title: "Nutella Lava Cake", desc: "Molten chocolate cake with Nutella center & vanilla ice cream", price: "$8.99" },
    { img: "/06-6.jpg", cat: "Pasta", title: "Truffle Mushroom Pasta", desc: "Tagliatelle, wild mushrooms, black truffle & parmesan", price: "$16.99" },
  ];
  return (
    <div>
      <header className="top">
        <div className="brand"><span className="logo">S</span><div>Sarab<br /><small style={{fontFamily:"system-ui",fontSize:10,color:"#6b7280",letterSpacing:".08em"}}>FAST FOOD &amp; RESTAURANT</small></div></div>
        <nav className="nav"><a href="#menu">Menu</a><a href="#about">About</a><a href="#offer">Offers</a><a href="#contact">Contact</a></nav>
        <button className="btn" type="button">Order Now</button>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">#1 Rated Fast Food in New York</p>
          <h1>Delicious Fast Food for Every Moment</h1>
          <p>Experience bold flavors crafted from premium ingredients. From crispy burgers to gourmet pizzas — every bite is an adventure.</p>
          <div className="actions"><button className="btn" type="button">Explore Menu</button><button className="ghost" type="button">Watch Our Story</button></div>
        </div>
        <div className="hero-card"><img src="/07-banner-img.jpg" alt="Sarab burger" /></div>
      </section>
      <div className="stats">
        {[["850+","Happy Customers"],["120+","Menu Items"],["15+","Expert Chefs"],["12 yr","Experience"]].map(([v,l]) => (
          <article key={l}><strong>{v}</strong><span style={{color:"#6b7280"}}>{l}</span></article>
        ))}
      </div>
      <section className="section" id="menu">
        <h2>Our Delicious Menu</h2>
        <p>Hand-crafted plates ready for dine-in or delivery.</p>
        <div className="grid3">
          {menu.map((m) => (
            <article className="card" key={m.title}>
              <img src={m.img} alt={m.title} />
              <div className="body">
                <div className="cat">{m.cat}</div>
                <h3 style={{margin:".35rem 0",fontFamily:"Georgia,serif"}}>{m.title}</h3>
                <p style={{color:"#6b7280",fontSize:".9rem",margin:0}}>{m.desc}</p>
                <div className="row"><span className="price">{m.price}</span><button className="plus" type="button">+</button></div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section" id="about">
        <h2>We Invite You to Visit</h2>
        <p>Founded in 2012, Sarab began as a small corner joint with a big dream — food that brings people together.</p>
        <div className="grid3">
          <article className="card"><img src="/14-about1.jpg" alt="Restaurant" /><div className="body"><h3>100% Fresh Ingredients</h3><p style={{color:"#6b7280"}}>Hand-picked daily for maximum freshness.</p></div></article>
          <article className="card"><img src="/15-about2.jpg" alt="Kitchen" /><div className="body"><h3>Award-Winning Recipes</h3><p style={{color:"#6b7280"}}>Signature dishes loved across the city.</p></div></article>
          <article className="card"><img src="/16-off-img.jpg" alt="Deal" /><div className="body"><h3>Lightning Delivery</h3><p style={{color:"#6b7280"}}>Hot food at your door in under 25 minutes.</p></div></article>
        </div>
      </section>
      <section className="offer" id="offer">
        <div className="txt">
          <p className="eyebrow" style={{color:"#fca5a5"}}>Limited Time Offer</p>
          <h2 style={{fontFamily:"Georgia,serif",fontSize:"2rem"}}>Get 30% Off Our Signature Burger Meal</h2>
          <p style={{opacity:.8}}>Weekend special — signature burger, loaded fries and a premium shake.</p>
          <button className="btn" type="button" style={{marginTop:"1rem"}}>Grab the Deal</button>
        </div>
        <img src="/16-off-img.jpg" alt="Offer" />
      </section>
      <footer className="section" id="contact" style={{paddingBottom:"3rem"}}>
        <h2>Sarab</h2>
        <p>42 Flavor Street, NY · +1 (800) 123-4567 · hello@sarabfood.com</p>
      </footer>
    </div>
  );
}
