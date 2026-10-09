import { useState } from "react";
import { Sparkle } from "lucide-react";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <section className="signup">
      <h2>JOIN THE NIGHT SHIFT</h2>
      <p>Unreleased demos, presale codes and tape drops. One email a month, zero spam.</p>
      {subscribed ? (
        <p className="signup-done">
          <Sparkle size={14} fill="currentColor" aria-hidden="true" /> You're in. Check your inbox after dark.
        </p>
      ) : (
        <form
          className="signup-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setSubscribed(true);
          }}
        >
          <input
            type="email"
            placeholder="you@midnight.fm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-neon" type="submit">Subscribe</button>
        </form>
      )}
    </section>
  );
}
