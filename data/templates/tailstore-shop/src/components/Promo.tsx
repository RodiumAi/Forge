export default function Promo() {
  return (
    <section className="promo">
      <h2>Join the list, get 15% off your first order</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="you@example.com" aria-label="Email" />
        <button className="btn btn-dark" type="submit">Subscribe</button>
      </form>
    </section>
  );
}
