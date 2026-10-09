import { useState } from "react";
import { Sprout } from "lucide-react";

export default function Join() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <section className="join" id="join">
      <div className="blob blob-cta" aria-hidden />
      <h2 className="h2 light">Put roots in the ground this quarter.</h2>
      <p className="section-sub light">
        For teams: offset honestly and fund regeneration from €190/month.
        For citizens: adopt a plot from €8/month. Cancel anytime; the trees stay.
      </p>
      {joined ? (
        <p className="join-done">
          <Sprout size={20} /> Welcome to the collective — check your inbox for your first plot.
        </p>
      ) : (
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.includes("@")) setJoined(true);
          }}
        >
          <input
            className="join-input"
            type="email"
            placeholder="you@company.earth"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-accent" type="submit">Join Terra</button>
        </form>
      )}
    </section>
  );
}
