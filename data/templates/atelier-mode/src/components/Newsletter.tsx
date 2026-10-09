import { useState } from "react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <section className="letter">
      <p className="kicker">Correspondence</p>
      <h2>Le Journal de la Maison</h2>
      <p className="letter-sub">One letter per season. Atelier notes, fabric stories, and first access to new pieces.</p>
      {subscribed ? (
        <p className="letter-thanks">Merci. Your first letter arrives with the new season.</p>
      ) : (
        <form
          className="letter-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) setSubscribed(true);
          }}
        >
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Subscribe</button>
        </form>
      )}
    </section>
  );
}
