import { ShieldCheck, Lock, EyeOff, FileText, ArrowLeft, Terminal, Key, Database, RefreshCw, Mail } from "lucide-react";
import { STUDIO_DATA } from "../data/studioData";

interface PrivacyPolicyProps {
  onBack: () => void;
}

export function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="privacy-page">
      <div className="privacy-header-banner">
        <button className="btn btn-black btn-back" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>BACK TO MAIN LAB</span>
        </button>
        <div className="privacy-status-pill">
          <span className="privacy-pulse" />
          <span>STATUS: GDPR COMPLIANT // PRIVACY CHARTER 2026</span>
        </div>
      </div>

      <section className="privacy-hero">
        <div className="sticker sticker-yellow privacy-sticker-1">
          ZERO BEIGE.
          <br />
          ZERO TRACKERS.
        </div>
        <div className="sticker sticker-blue privacy-sticker-2">
          RAW LAW
          <br />
          HONEST DATA ✷
        </div>

        <span className="privacy-tag">LEGAL &amp; DATA CHARTER</span>
        <h1 className="privacy-title">
          PRIVACY <br />
          <span className="scribble">WITHOUT THE BS.</span>
        </h1>
        <p className="privacy-lead">
          Most privacy policies are 14,000 words of weaponized legalese written to hide the fact that someone sold your email. We don't do that. Here is every single byte we touch, why we touch it, and how to tell us to burn it.
        </p>
        <div className="privacy-meta-strip">
          <span className="tag">EFFECTIVE: JAN 01, 2026</span>
          <span className="tag tag-year">VERSION 3.2</span>
          <span className="tag">DPO: LEGAL@{STUDIO_DATA.email.split("@")[1]}</span>
        </div>
      </section>

      <section className="privacy-grid-section">
        <div className="privacy-grid">
          <article className="privacy-card highlight-yellow">
            <div className="privacy-card-icon">
              <EyeOff size={28} />
            </div>
            <span className="privacy-num">01 // TRACKING</span>
            <h2>WE DON'T SELL YOUR DATA. PERIOD.</h2>
            <p>
              We run a creative design studio, not an ad exchange. We don't buy third-party databases, we don't sell your inquiries to marketing brokers, and we never will. Your project specs remain under strict vault conditions.
            </p>
            <div className="privacy-card-points">
              <div className="point-row">
                <span className="point-badge">NO</span>
                <span>Third-party tracking pixels (Meta, TikTok, adtech networks)</span>
              </div>
              <div className="point-row">
                <span className="point-badge">NO</span>
                <span>Selling or renting client contact details</span>
              </div>
              <div className="point-row">
                <span className="point-badge">NO</span>
                <span>Silent telemetry or invasive keystroke recording</span>
              </div>
            </div>
          </article>

          <article className="privacy-card highlight-orange">
            <div className="privacy-card-icon">
              <Database size={28} />
            </div>
            <span className="privacy-num">02 // COLLECTION</span>
            <h2>WHAT WE ACTUALLY COLLECT</h2>
            <p>
              Only what you willingly submit when you contact our studio or collaborate with our team on branding, code, or campaign contracts.
            </p>
            <ul className="privacy-list">
              <li>
                <strong>Project Briefs:</strong> Company name, contact person, project budget ranges, and design targets.
              </li>
              <li>
                <strong>Direct Correspondence:</strong> Emails and call notes when scoping deliverables.
              </li>
              <li>
                <strong>Server Access Logs:</strong> Strictly anonymized IP addresses for DDoS protection and system reliability, retained for 14 days maximum.
              </li>
            </ul>
          </article>

          <article className="privacy-card">
            <div className="privacy-card-icon">
              <Lock size={28} />
            </div>
            <span className="privacy-num">03 // CONFIDENTIALITY</span>
            <h2>NDA &amp; UNRELEASED WORK</h2>
            <p>
              Every unreleased pitch, confidential rebrand vector, deck, and source code repository is treated as classified intellectual property until public drop day.
            </p>
            <div className="privacy-quote-box">
              "If we sign an NDA, nobody in the studio posts teasers, leaks brandmarks, or brags until you give the green light. We take client secrecy seriously."
            </div>
          </article>

          <article className="privacy-card highlight-blue">
            <div className="privacy-card-icon">
              <ShieldCheck size={28} />
            </div>
            <span className="privacy-num">04 // YOUR RIGHTS</span>
            <h2>GDPR, CCPA &amp; DATA DELETION</h2>
            <p>
              You own your information. Under European GDPR and international privacy legislation, you have full sovereignty over any stored data:
            </p>
            <div className="privacy-rights-grid">
              <div className="right-badge">RIGHT TO ACCESS</div>
              <div className="right-badge">RIGHT TO RECTIFY</div>
              <div className="right-badge">RIGHT TO ERASURE ("FORGOTTEN")</div>
              <div className="right-badge">RIGHT TO PORTABILITY</div>
            </div>
            <p className="privacy-note">
              To trigger an instant archive scrub, email <a href={`mailto:${STUDIO_DATA.email}`} className="privacy-link">{STUDIO_DATA.email}</a> with subject <code>[PURGE REQUEST]</code>. Done in 48h.
            </p>
          </article>

          <article className="privacy-card">
            <div className="privacy-card-icon">
              <RefreshCw size={28} />
            </div>
            <span className="privacy-num">05 // COOKIES &amp; STORAGE</span>
            <h2>LOCALSTORAGE &amp; COOKIES</h2>
            <p>
              This website uses purely functional client storage (like theme preferences and navigation cache). No creepy retargeting cookies that chase you around the internet for shoes you looked at once.
            </p>
            <div className="privacy-chip-group">
              <span className="privacy-chip">Session State (Essential)</span>
              <span className="privacy-chip">UI Filters (Local Cache)</span>
              <span className="privacy-chip-off">Ad-Tracking: 0%</span>
            </div>
          </article>

          <article className="privacy-card highlight-dark">
            <div className="privacy-card-icon">
              <Terminal size={28} />
            </div>
            <span className="privacy-num">06 // SECURITY</span>
            <h2>ENCRYPTION &amp; STORAGE</h2>
            <p>
              All client contracts and design vaults are hosted behind TLS 1.3 encryption, role-based key access, and two-factor authentication for all 14 team members.
            </p>
            <div className="security-terminal">
              <code>&gt; TLS_ENCRYPTION: ACTIVE (AES-256)</code>
              <code>&gt; 2FA_ENFORCEMENT: 100% STUDIO-WIDE</code>
              <code>&gt; DATA_LOCATION: ROTTERDAM / AMSTERDAM (EU-WEST)</code>
            </div>
          </article>
        </div>
      </section>

      <section className="privacy-cta-section">
        <div className="privacy-cta-box">
          <div className="privacy-cta-badge">
            <Key size={20} />
            <span>GOT QUESTIONS OR SPECIAL NDA REQUIREMENTS?</span>
          </div>
          <h2>NEED A MUTUAL NDA BEFORE SENDING YOUR BRIEF?</h2>
          <p>
            We regularly sign mutual NDAs before reviewing sensitive product concepts, stealth fundings, or unannounced campaigns. Send your draft or ask for ours.
          </p>
          <div className="privacy-cta-actions">
            <a href={`mailto:${STUDIO_DATA.email}?subject=NDA%20and%20Privacy%20Inquiry`} className="btn btn-accent btn-big">
              <Mail size={18} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "8px" }} />
              CONTACT PRIVACY OFFICER
            </a>
            <button className="btn btn-white btn-big" onClick={onBack}>
              ← RETURN TO RAW WORKS
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}