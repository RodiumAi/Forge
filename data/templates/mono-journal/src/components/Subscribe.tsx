import { useState } from "react";

export default function Subscribe() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <section className="subscribe" id="subscribe">
      <div className="subscribe-inner">
        <h2 className="subscribe-title">One email a month.<br />Nothing else, ever.</h2>
        <p className="subscribe-copy">
          The full issue in your inbox on the first Monday of the month.
          No digests, no “we miss you”, no partner offers. Unsubscribing
          takes one click and no guilt.
        </p>
        {subscribed ? (
          <p className="subscribe-done">Thank you. Issue № 13 — “Repair, continued” — arrives March 2.</p>
        ) : (
          <form
            className="subscribe-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setSubscribed(true);
            }}
          >
            <input
              className="subscribe-input"
              type="email"
              placeholder="your@address.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="subscribe-btn" type="submit">Subscribe</button>
          </form>
        )}
        <p className="subscribe-fine">Free forever. The letterpress edition is €96/year, shipped worldwide.</p>
      </div>
    </section>
  );
}
