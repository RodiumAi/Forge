import { useState } from "react";
import { Check } from "lucide-react";

export default function Booking() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section className="book" id="book">
      <div className="book-inner">
        <h2 className="book-title">The ice doesn't wait.</h2>
        <p className="book-sub">
          Departures for the 2026–27 season open on March 1. Leave your email
          and we'll hold you a briefing call before public booking opens.
        </p>
        {sent ? (
          <p className="book-done">
            <Check size={17} strokeWidth={3} aria-hidden="true" /> You're on the list. Talk soon — bring questions.
          </p>
        ) : (
          <form
            className="book-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setSent(true);
            }}
          >
            <input
              type="email"
              required
              placeholder="you@basecamp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
            />
            <button className="btn btn-solid" type="submit">Reserve a call</button>
          </form>
        )}
        <p className="book-note">No deposit required · Full refund 90 days out · ATOL protected</p>
      </div>
    </section>
  );
}
