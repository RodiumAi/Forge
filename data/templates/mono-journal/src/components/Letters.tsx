import { MoveRight } from "lucide-react";

export default function Letters() {
  return (
    <section className="section" id="letters">
      <div className="section-rule">
        <h2 className="section-title">Letters to the editor</h2>
        <span className="section-note">Selected replies to Issue № 11, “Attention”</span>
      </div>
      <ol className="article-list">
        <li className="article">
          <span className="article-n">i.</span>
          <div className="article-main">
            <div className="article-meta">
              <span>From R. Whitfield</span>
              <span className="meta-sep">·</span>
              <span>Edinburgh</span>
            </div>
            <h3 className="article-title"><a href="#letters">On finishing things</a></h3>
            <p className="article-excerpt">
              Your essay on unfinished books shamed me into completing
              “Middlemarch” after eleven years of trying. I am writing to
              report that the last hundred pages were worth the decade.
            </p>
          </div>
          <span className="article-arrow" aria-hidden>
            <MoveRight size={22} strokeWidth={1.25} />
          </span>
        </li>
        <li className="article">
          <span className="article-n">ii.</span>
          <div className="article-main">
            <div className="article-meta">
              <span>From T. Okonkwo</span>
              <span className="meta-sep">·</span>
              <span>Lagos</span>
            </div>
            <h3 className="article-title"><a href="#letters">A correction, gently</a></h3>
            <p className="article-excerpt">
              The Lagos danfo network you cited as “informal” moves four
              million people daily with better on-time rates than two European
              capitals I have lived in. Informal is doing heavy lifting there.
            </p>
          </div>
          <span className="article-arrow" aria-hidden>
            <MoveRight size={22} strokeWidth={1.25} />
          </span>
        </li>
        <li className="article">
          <span className="article-n">iii.</span>
          <div className="article-main">
            <div className="article-meta">
              <span>From M. Duras-Lemoine</span>
              <span className="meta-sep">·</span>
              <span>Marseille</span>
            </div>
            <h3 className="article-title"><a href="#letters">Against the tote bag</a></h3>
            <p className="article-excerpt">
              You will sell tote bags eventually. Every publication does.
              I write only to ask that when you do, you at least have the
              decency to set the type properly on them.
            </p>
          </div>
          <span className="article-arrow" aria-hidden>
            <MoveRight size={22} strokeWidth={1.25} />
          </span>
        </li>
      </ol>
    </section>
  );
}
