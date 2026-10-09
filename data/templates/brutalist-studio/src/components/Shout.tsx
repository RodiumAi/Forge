const AWARDS = ["AWWWARDS SOTD ×3", "D&AD WOOD PENCIL", "CANNES SHORTLIST '25", "FWA OF THE MONTH"];

export default function Shout() {
  return (
    <section className="shout">
      <p>
        "THEY REBRANDED US IN SIX WEEKS AND OUR SIGN-UPS <em>DOUBLED</em>.
        ALSO THEY'RE ANNOYINGLY FUN TO WORK WITH."
      </p>
      <span className="shout-credit">— Petra Molnár, CEO of Tangerine Bank</span>
      <div className="shout-awards">
        {AWARDS.map((a) => (
          <span key={a} className="tag">{a}</span>
        ))}
      </div>
    </section>
  );
}
