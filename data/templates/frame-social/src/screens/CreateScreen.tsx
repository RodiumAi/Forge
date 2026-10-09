import "../styles/create.css";
import { Camera, ChevronRight } from "lucide-react";
import { fb } from "../data";

type Props = { caption: string; onCaption: (value: string) => void };

export default function CreateScreen({ caption, onCaption }: Props) {
  return (
    <main className="app-main create-screen">
      <div className="compose">
        <div className="drop" style={{ backgroundImage: fb(0) }}>
          <span className="drop-ic" aria-hidden><Camera size={30} strokeWidth={1.7} /></span>
          <strong>Add a photo</strong>
          <span className="muted">Tap to pick from your library</span>
        </div>
        <label className="field">
          <span className="field-lbl">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => onCaption(e.target.value)}
            placeholder="Say something about this moment…"
            rows={3}
          />
        </label>
        <div className="opt-row">
          <div className="opt"><span>Tag people</span><span className="chev"><ChevronRight size={18} strokeWidth={1.8} aria-hidden /></span></div>
          <div className="opt"><span>Add location</span><span className="chev"><ChevronRight size={18} strokeWidth={1.8} aria-hidden /></span></div>
          <div className="opt"><span>Also share to story</span><span className="switch on" aria-hidden /></div>
        </div>
        <button className="btn-primary">Share post</button>
      </div>
    </main>
  );
}
