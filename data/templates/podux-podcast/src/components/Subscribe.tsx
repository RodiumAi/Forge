export default function Subscribe() {
  return (
    <section className="subscribe" id="subscribe">
      <h2>Never miss an episode</h2>
      <p>Drop your email, we&apos;ll ping you when a new one lands. No spam, ever.</p>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="you@example.com" aria-label="Email" />
        <button className="btn btn-accent" type="submit">Subscribe</button>
      </form>
    </section>
  );
}
