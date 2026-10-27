import { BellRing, ChevronRight, FileHeart, HeartHandshake, LogOut, Pill, ShieldCheck, ShieldPlus, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";
import { INSURANCE, ME } from "../data";
import "../styles/profile.css";

type Props = { onSignOut: () => void };

const LINKS = [
  { icon: FileHeart, label: "Medical records", hint: "12 documents" },
  { icon: Users, label: "Family members", hint: "Inaya, 6" },
  { icon: ShieldCheck, label: "Privacy and security", hint: "Face ID on" },
  { icon: HeartHandshake, label: "Help and support", hint: "" },
];

export default function ProfileScreen({ onSignOut }: Props) {
  const [reminders, setReminders] = useState(true);
  const [meds, setMeds] = useState(true);

  return (
    <main className="app-main profile-screen">
      <section className="patient card">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="muted">Patient ID KN-40921</p>
        </div>
      </section>
      <div className="facts">
        <span><small>Age</small><strong>{ME.age}</strong></span>
        <span><small>Blood</small><strong>{ME.blood}</strong></span>
        <span><small>Weight</small><strong>{ME.weight}</strong></span>
        <span><small>Height</small><strong>{ME.height}</strong></span>
      </div>

      <section className="insurance" aria-label="Insurance card">
        <div className="ins-top">
          <span className="ins-mark"><ShieldPlus size={20} strokeWidth={2.2} aria-hidden /></span>
          <span className="ins-cover">Covers {INSURANCE.cover}</span>
        </div>
        <p className="ins-plan">{INSURANCE.plan}</p>
        <p className="ins-member">{INSURANCE.member}</p>
        <div className="ins-foot">
          <span><small>Member</small>{ME.name}</span>
          <span><small>Insurer</small>{INSURANCE.insurer}</span>
          <span><small>Valid</small>{INSURANCE.valid}</span>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Medical info</h2><button className="link">Edit</button></div>
        <ul className="med card">
          <li>
            <span className="m-icon alert"><TriangleAlert size={18} strokeWidth={2.2} aria-hidden /></span>
            <span><small>Allergies</small><strong>Penicillin</strong></span>
            <span className="tag coral">Severe</span>
          </li>
          <li>
            <span className="m-icon"><FileHeart size={18} strokeWidth={2.2} aria-hidden /></span>
            <span><small>Conditions</small><strong>Mild asthma</strong></span>
            <span className="tag">Since 2015</span>
          </li>
          <li>
            <span className="m-icon"><Pill size={18} strokeWidth={2.2} aria-hidden /></span>
            <span><small>Medication</small><strong>Ventolin, as needed</strong></span>
          </li>
        </ul>
      </section>

      <section>
        <div className="section-head"><h2>Reminders</h2></div>
        <div className="card toggles">
          <div className="row">
            <span className="m-icon"><BellRing size={18} strokeWidth={2.2} aria-hidden /></span>
            <span><strong>Visit reminders</strong><small>The day before and 1 hour ahead</small></span>
            <button className={reminders ? "toggle on" : "toggle"} onClick={() => setReminders(!reminders)} aria-pressed={reminders} aria-label="Visit reminders" />
          </div>
          <div className="row">
            <span className="m-icon"><Pill size={18} strokeWidth={2.2} aria-hidden /></span>
            <span><strong>Medication alerts</strong><small>When a refill is due</small></span>
            <button className={meds ? "toggle on" : "toggle"} onClick={() => setMeds(!meds)} aria-pressed={meds} aria-label="Medication alerts" />
          </div>
        </div>
      </section>

      <ul className="links card">
        {LINKS.map(({ icon: Icon, label, hint }) => (
          <li key={label}>
            <button>
              <span className="m-icon"><Icon size={18} strokeWidth={2.2} aria-hidden /></span>
              <strong>{label}</strong>
              {hint && <small>{hint}</small>}
              <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <button className="signout" onClick={onSignOut}><LogOut size={18} strokeWidth={2.2} aria-hidden /> Sign out</button>
    </main>
  );
}
