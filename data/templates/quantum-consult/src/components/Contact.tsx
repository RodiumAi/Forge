import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", message: "" });

  return (
    <section className="contact" id="contact">
      <div className="contact-grid">
        <div className="contact-copy">
          <p className="rule-label">§5 — Contact</p>
          <h2>Begin with a confidential conversation</h2>
          <p>
            First discussions are held under NDA at no charge. Within ten business days you will
            receive a written point of view — whether or not we propose an engagement.
          </p>
          <address>
            Quantum Partners LLP
            <br />
            One Exchange Square, London EC2A
            <br />
            mandates@quantumpartners.com
          </address>
        </div>
        {sent ? (
          <div className="contact-form contact-thanks">
            <h3>Received.</h3>
            <p>A partner will respond within two business days.</p>
          </div>
        ) : (
          <form
            className="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.name && form.company) setSent(true);
            }}
          >
            <label>
              Full name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Company
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
            </label>
            <label>
              The decision you are facing
              <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            <button type="submit" className="btn-solid">Submit inquiry</button>
          </form>
        )}
      </div>
    </section>
  );
}
