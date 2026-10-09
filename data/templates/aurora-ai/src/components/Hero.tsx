import { CircleCheck, Play, Sparkle, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <span className="pill">
          <Sparkle className="pill-icon" size={11} fill="currentColor" strokeWidth={1} aria-hidden="true" /> Series B — $48M raised
        </span>
        <h1>
          Intelligence that works
          <br />
          <span className="grad-text">while you sleep.</span>
        </h1>
        <p className="lede">
          Aurora turns frontier models into reliable coworkers. Build, evaluate and deploy AI
          workflows that handle real operations — support, finance, compliance — in production, at scale.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-lg" href="#pricing">Start building free</a>
          <a className="btn btn-glass btn-lg" href="#features">
            Watch the demo <Play size={10} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          </a>
        </div>
        <p className="hero-note">No credit card required · 10k free calls every month</p>
      </div>

      <div className="hero-stage">
        <div className="mockup-tilt">
          <div className="mockup-frame glass">
            <div className="mockup-bar">
              <span className="dot dot-r" />
              <span className="dot dot-y" />
              <span className="dot dot-g" />
              <span className="mockup-url">app.aurora.ai/workflows</span>
            </div>
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70"
              alt="Aurora AI dashboard"
              className="mockup-img"
            />
          </div>
          <div className="float-card glass float-a">
            <span className="float-icon float-icon-zap">
              <Zap size={22} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong>Workflow deployed</strong>
              <small>invoice-triage · v42 · 380ms</small>
            </div>
          </div>
          <div className="float-card glass float-b">
            <span className="float-icon float-icon-ok">
              <CircleCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <strong>Evals passing</strong>
              <small>128/128 golden cases</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
