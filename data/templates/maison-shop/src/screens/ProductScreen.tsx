import "../styles/product.css";
import { ArrowLeft, Check, ChevronDown, Heart, RotateCcw, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useShop } from "../components/Shop";
import { euro, PRODUCTS, productById } from "../data";

type Panel = "details" | "composition" | "delivery";

export default function ProductScreen() {
  const { id } = useParams();
  const p = productById(id);
  const navigate = useNavigate();
  const { add, count, isWished, toggleWish } = useShop();
  const [shot, setShot] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState(0);
  const [open, setOpen] = useState<Panel | null>("details");
  const [toast, setToast] = useState(false);
  const gallery = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setShot(0);
    setSize(null);
    setColor(0);
    gallery.current?.scrollTo({ left: 0 });
  }, [id]);

  if (!p) return <Navigate to="/shop" replace />;

  const oneSize = p.sizes.length === 1;
  const chosen = oneSize ? p.sizes[0] : size;
  const wished = isWished(p.id);
  const more = PRODUCTS.filter((x) => x.id !== p.id && (x.category === p.category || x.category === "Bags")).slice(0, 4);

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/shop");
  }

  function onScroll() {
    const el = gallery.current;
    if (el) setShot(Math.round(el.scrollLeft / el.clientWidth));
  }

  function addToBag() {
    if (!p || !chosen) return;
    add(p.id, chosen, p.colors[color].name);
    setToast(true);
  }

  const panels: { id: Panel; title: string; body: string }[] = [
    { id: "details", title: "Details", body: p.description },
    { id: "composition", title: "Composition & fit", body: `${p.composition} ${p.fit}` },
    { id: "delivery", title: "Delivery & returns", body: "Free delivery over €200, two to four days. Free returns within thirty days, collected from your door." },
  ];

  return (
    <div className="app-shell product-screen">
      <div className="gallery-wrap">
        <div className="gallery" ref={gallery} onScroll={onScroll}>
          {p.images.map((src, i) => <img key={src} src={src} alt={i === 0 ? p.name : ""} />)}
        </div>
        <div className="gallery-bar">
          <button className="round" onClick={back} aria-label="Back"><ArrowLeft size={19} strokeWidth={1.6} aria-hidden /></button>
          <button className={wished ? "round wished" : "round"} onClick={() => toggleWish(p.id)} aria-pressed={wished} aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}>
            <Heart size={19} strokeWidth={1.6} fill={wished ? "currentColor" : "none"} aria-hidden />
          </button>
        </div>
        <div className="dots" aria-hidden>
          {p.images.map((src, i) => <i key={src} className={i === shot ? "on" : ""} />)}
        </div>
      </div>

      <div className="sheet">
        <p className="label">{p.category}{p.badge && <span className="badge"> · {p.badge}</span>}</p>
        <div className="title-row">
          <h1>{p.name}</h1>
          <span className="price">{euro(p.price)}{p.was && <s>{euro(p.was)}</s>}</span>
        </div>

        <div className="opt">
          <p className="label">Colour · <span className="val">{p.colors[color].name}</span></p>
          <div className="swatches">
            {p.colors.map((c, i) => (
              <button key={c.name} className={i === color ? "swatch on" : "swatch"} onClick={() => setColor(i)} aria-label={c.name} aria-pressed={i === color}>
                <i style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </div>

        <div className="opt">
          <div className="opt-head">
            <p className="label">Size{chosen && <> · <span className="val">{chosen}</span></>}</p>
            {!oneSize && <button className="text-link">Size guide</button>}
          </div>
          <div className="sizes">
            {p.sizes.map((s) => (
              <button key={s} className={s === chosen ? "size on" : "size"} onClick={() => setSize(s)} aria-pressed={s === chosen}>{s}</button>
            ))}
          </div>
        </div>

        <div className="perks">
          <span><Truck size={15} strokeWidth={1.4} aria-hidden /> Free over €200</span>
          <span><RotateCcw size={15} strokeWidth={1.4} aria-hidden /> 30 day returns</span>
        </div>

        <div className="accordion">
          {panels.map((panel) => {
            const on = open === panel.id;
            return (
              <div key={panel.id} className={on ? "acc on" : "acc"}>
                <button className="acc-head" onClick={() => setOpen(on ? null : panel.id)} aria-expanded={on}>
                  <span>{panel.title}</span><ChevronDown size={16} strokeWidth={1.4} aria-hidden />
                </button>
                <div className="acc-body"><p>{panel.body}</p></div>
              </div>
            );
          })}
        </div>

        <section className="more">
          <p className="label">Wear it with</p>
          <div className="rail">
            {more.map((x) => (
              <Link key={x.id} to={`/product/${x.id}`} className="more-item">
                <img src={x.images[0]} alt="" loading="lazy" />
                <span>{x.name}</span>
                <small>{euro(x.price)}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="buy-bar">
        <button className="btn-primary btn-block" onClick={addToBag} disabled={!chosen}>
          {chosen ? `Add to bag · ${euro(p.price)}` : "Select a size"}
        </button>
      </div>

      <div className={toast ? "toast show" : "toast"} role="status">
        <Check size={15} strokeWidth={1.8} aria-hidden /> Added to bag ({count})
        <Link to="/bag" className="toast-link">View</Link>
      </div>
    </div>
  );
}
