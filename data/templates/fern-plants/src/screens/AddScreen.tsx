import "../styles/add.css";
import { Check, Minus, Plus } from "lucide-react";
import { LIGHTS, type PlantForm } from "../data";

type Props = {
  form: PlantForm;
  saved: boolean;
  onForm: (form: PlantForm) => void;
  onSaved: (saved: boolean) => void;
};

export default function AddScreen({ form, saved, onForm, onSaved }: Props) {
  return (
    <main className="app-main add-screen">
      <section className="card form">
        <h3>Identify &amp; add a plant</h3>
        <p className="muted" style={{ fontSize: ".82rem", marginBottom: ".4rem" }}>A few details and Fern builds a watering schedule.</p>

        <label className="field">
          <span>Plant name</span>
          <input value={form.name} onChange={(e) => { onForm({ ...form, name: e.target.value }); onSaved(false); }} placeholder="e.g. Rubber plant" />
        </label>

        <label className="field">
          <span>Room</span>
          <input value={form.room} onChange={(e) => { onForm({ ...form, room: e.target.value }); onSaved(false); }} placeholder="e.g. Living room" />
        </label>

        <label className="field">
          <span>Watering interval</span>
          <div className="stepper">
            <button type="button" aria-label="Less often" onClick={() => onForm({ ...form, interval: String(Math.max(1, Number(form.interval) - 1)) })}>
              <Minus size={18} strokeWidth={2.4} aria-hidden />
            </button>
            <span>{form.interval} days</span>
            <button type="button" aria-label="More often" onClick={() => onForm({ ...form, interval: String(Math.min(60, Number(form.interval) + 1)) })}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
            </button>
          </div>
        </label>

        <label className="field">
          <span>Light</span>
          <div className="segmented">
            {LIGHTS.map((l) => (
              <button type="button" key={l} className={form.light === l ? "seg on" : "seg"} onClick={() => onForm({ ...form, light: l })}>{l}</button>
            ))}
          </div>
        </label>

        <button className="btn-primary" onClick={() => onSaved(true)}>Add plant</button>
        {saved && <p className="saved"><Check size={18} strokeWidth={2.2} aria-hidden /> {form.name || "Plant"} added — reminders set every {form.interval} days.</p>}
      </section>
    </main>
  );
}
