import { useState } from "react";
import { Check } from "lucide-react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section className="block block-accent">
      <h2 className="block-title">Speaker waves drop by email first.</h2>
      {sent ? (
        <p className="news-done">
          <Check className="news-check" size={20} strokeWidth={3} aria-hidden="true" /> You are on the list. See you in Berlin.
        </p>
      ) : (
        <form
          className="news-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setSent(true);
          }}
        >
          <input
            className="news-input"
            type="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-fg" type="submit">Subscribe</button>
        </form>
      )}
    </section>
  );
}
