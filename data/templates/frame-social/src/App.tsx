import { useEffect, useState } from "react";

/* ---- Inline icons (kit runs React-only: no icon packs) ---- */
function IconFeed({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
    </svg>
  );
}
function IconExplore({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
      <path d="m14.4 9.6-1.5 4-4 1.5 1.5-4 4-1.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconCreate({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconProfile({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconHeart({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20s-7-4.35-7-9.3A3.7 3.7 0 0 1 12 8.2 3.7 3.7 0 0 1 19 10.7c0 4.95-7 9.3-7 9.3Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={filled ? "currentColor" : "none"} />
    </svg>
  );
}
function IconComment() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 0 14H8l-4 3v-4.2A7 7 0 0 1 4 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function IconShare() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6M12 15V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconBookmark({ filled }: { filled?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 4h12v16l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill={filled ? "currentColor" : "none"} /></svg>;
}
function IconPlus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
}
function IconMessage() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function IconCamera() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" /></svg>;
}
function IconGrid({ active }: { active?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="4" y="4" width="7" height="7" rx="1.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="4" width="7" height="7" rx="1.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" /><rect x="4" y="13" width="7" height="7" rx="1.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" /><rect x="13" y="13" width="7" height="7" rx="1.4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" /></svg>;
}

const ONBOARD_KEY = "frame_onboard_done";
const U = "https://images.unsplash.com/";
function photo(id: string, w: number) {
  return `${U}${id}?auto=format&fit=crop&w=${w}&q=70`;
}

const AVA = {
  you: "photo-1500648767791-00dcc994a43e",
  maya: "photo-1494790108377-be9c29b29330",
  noor: "photo-1438761681033-6461ffad8d80",
};

const SLIDES = [
  { kicker: "Welcome", title: "Share the moment", body: "Post the photo you actually love. Frame keeps your feed about people, not noise." },
  { kicker: "Discover", title: "Find your people", body: "Explore hand-picked photos and follow the creators who make your day brighter." },
  { kicker: "Stories", title: "Here for 24 hours", body: "Drop a story that vanishes tomorrow. Low pressure, all play." },
];

type Tab = "feed" | "explore" | "create" | "profile";

const STORIES = [
  { name: "You", ava: AVA.you, me: true },
  { name: "maya", ava: AVA.maya },
  { name: "noor", ava: AVA.noor },
  { name: "leo", ava: AVA.you },
  { name: "ines", ava: AVA.maya },
  { name: "sam", ava: AVA.noor },
];

const POSTS = [
  { user: "maya.k", ava: AVA.maya, time: "2h", photo: "photo-1504674900247-0877df9cc836", likes: "1,204", caption: "Sunday plates, slow morning. Recipe soon 🍑", tag: "Marrakech" },
  { user: "noor.travels", ava: AVA.noor, time: "5h", photo: "photo-1464822759023-fed622ff2c3b", likes: "3,872", caption: "Above the clouds again. This ridge never gets old.", tag: "Chefchaouen" },
  { user: "studio.leo", ava: AVA.you, time: "8h", photo: "photo-1523275335684-37898b6baf30", likes: "642", caption: "New drop, shot on film. Which colourway? 1 or 2 👀", tag: "The Studio" },
];

const EXPLORE = [
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1500648767791-00dcc994a43e",
  "photo-1494790108377-be9c29b29330",
  "photo-1438761681033-6461ffad8d80",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
];

const GALLERY = [
  "photo-1500648767791-00dcc994a43e",
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1438761681033-6461ffad8d80",
  "photo-1494790108377-be9c29b29330",
];

const FALLBACKS = [
  "linear-gradient(135deg, #ede9fe, #c4b5fd)",
  "linear-gradient(135deg, #fce7f3, #fbcfe8)",
  "linear-gradient(135deg, #dbeafe, #bfdbfe)",
  "linear-gradient(135deg, #fef3c7, #fde68a)",
  "linear-gradient(135deg, #d1fae5, #a7f3d0)",
  "linear-gradient(135deg, #ffe4e6, #fecdd3)",
];
function fb(i: number) {
  return FALLBACKS[i % FALLBACKS.length];
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("feed");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState("");

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <div className="ob-photo" style={{ backgroundImage: fb(1) }}>
            <img src={photo("photo-1523275335684-37898b6baf30", 640)} alt="" />
          </div>
          <div className="ob-card">
            <span className="ob-ring"><img src={photo(AVA.maya, 120)} alt="" /></span>
            <div><strong>maya.k</strong><span>liked your photo</span></div>
            <span className="ob-heart"><IconHeart filled /></span>
          </div>
        </div>
        <div className="onboard-body">
          <p className="onboard-kicker">{s.kicker}</p>
          <h2>{s.title}</h2>
          <p className="muted">{s.body}</p>
        </div>
        <div className="onboard-actions">
          <div className="dots" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
          </div>
          <button className="btn-primary" onClick={() => (last ? finish() : setSlide((n) => n + 1))}>
            {last ? "Join Frame" : "Next"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { feed: "Frame", explore: "Explore", create: "New post", profile: "leo.rey" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        {tab === "feed" ? (
          <span className="wordmark">Frame</span>
        ) : (
          <h1>{titles[tab]}</h1>
        )}
        <div className="nav-right">
          <button className="nav-action" aria-label="Messages"><IconMessage /></button>
        </div>
      </header>

      <main className="app-main">
        {tab === "feed" && (
          <>
            <div className="stories" aria-label="Stories">
              {STORIES.map((st, i) => (
                <button className="story" key={st.name + i}>
                  <span className={st.me ? "ring me" : "ring"}>
                    <span className="ring-in" style={{ backgroundImage: fb(i) }}>
                      <img src={photo(st.ava, 160)} alt="" />
                    </span>
                    {st.me && <span className="story-add" aria-hidden><IconPlus /></span>}
                  </span>
                  <span className="story-name">{st.me ? "Your story" : st.name}</span>
                </button>
              ))}
            </div>

            <div className="posts">
              {POSTS.map((p, i) => {
                const isLiked = liked[p.user];
                const isSaved = saved[p.user];
                return (
                  <article className="post" key={p.user}>
                    <header className="post-head">
                      <span className="ring sm"><span className="ring-in" style={{ backgroundImage: fb(i) }}><img src={photo(p.ava, 96)} alt="" /></span></span>
                      <div className="post-who"><strong>{p.user}</strong><span>{p.tag}</span></div>
                      <span className="post-time">{p.time}</span>
                    </header>
                    <div className="post-photo" style={{ backgroundImage: fb(i + 1) }}>
                      <img src={photo(p.photo, 900)} alt="" />
                    </div>
                    <div className="post-actions">
                      <button className={isLiked ? "pa liked" : "pa"} aria-pressed={isLiked} aria-label="Like" onClick={() => setLiked((m) => ({ ...m, [p.user]: !m[p.user] }))}><IconHeart filled={isLiked} /></button>
                      <button className="pa" aria-label="Comment"><IconComment /></button>
                      <button className="pa" aria-label="Share"><IconShare /></button>
                      <button className={isSaved ? "pa save on" : "pa save"} aria-pressed={isSaved} aria-label="Save" onClick={() => setSaved((m) => ({ ...m, [p.user]: !m[p.user] }))}><IconBookmark filled={isSaved} /></button>
                    </div>
                    <div className="post-body">
                      <p className="likes">{isLiked ? incr(p.likes) : p.likes} likes</p>
                      <p className="caption"><strong>{p.user}</strong> {p.caption}</p>
                      <p className="cmt-link">View all comments</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {tab === "explore" && (
          <>
            <div className="search" aria-hidden>Search people, places, tags</div>
            <div className="grid explore-grid">
              {EXPLORE.map((id, i) => (
                <span className={i % 5 === 0 ? "cell tall" : "cell"} key={id + i} style={{ backgroundImage: fb(i) }}>
                  <img src={photo(id, 500)} alt="" />
                </span>
              ))}
            </div>
          </>
        )}

        {tab === "create" && (
          <div className="compose">
            <div className="drop" style={{ backgroundImage: fb(0) }}>
              <span className="drop-ic" aria-hidden><IconCamera /></span>
              <strong>Add a photo</strong>
              <span className="muted">Tap to pick from your library</span>
            </div>
            <label className="field">
              <span className="field-lbl">Caption</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Say something about this moment…"
                rows={3}
              />
            </label>
            <div className="opt-row">
              <div className="opt"><span>Tag people</span><span className="chev">›</span></div>
              <div className="opt"><span>Add location</span><span className="chev">›</span></div>
              <div className="opt"><span>Also share to story</span><span className="switch on" aria-hidden /></div>
            </div>
            <button className="btn-primary">Share post</button>
          </div>
        )}

        {tab === "profile" && (
          <>
            <div className="profile-head">
              <span className="ring lg"><span className="ring-in" style={{ backgroundImage: fb(0) }}><img src={photo(AVA.you, 200)} alt="" /></span></span>
              <div className="stats">
                <div><strong>128</strong><span>posts</span></div>
                <div><strong>18.4k</strong><span>followers</span></div>
                <div><strong>312</strong><span>following</span></div>
              </div>
            </div>
            <div className="profile-bio">
              <strong>Leo Rey</strong>
              <p className="muted">Film photographer · Casablanca ↔ everywhere. Chasing soft light and good coffee.</p>
            </div>
            <div className="profile-cta">
              <button className="btn-line">Edit profile</button>
              <button className="btn-line">Share</button>
            </div>
            <div className="grid-tabs" aria-hidden>
              <span className="gt active"><IconGrid active /></span>
              <span className="gt"><IconBookmark /></span>
            </div>
            <div className="grid profile-grid">
              {GALLERY.map((id, i) => (
                <span className="cell" key={id + i} style={{ backgroundImage: fb(i) }}>
                  <img src={photo(id, 400)} alt="" />
                </span>
              ))}
            </div>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "feed" ? "tab active" : "tab"} aria-current={tab === "feed" ? "page" : undefined} onClick={() => setTab("feed")}><IconFeed active={tab === "feed"} /><span>Feed</span></button>
        <button className={tab === "explore" ? "tab active" : "tab"} aria-current={tab === "explore" ? "page" : undefined} onClick={() => setTab("explore")}><IconExplore active={tab === "explore"} /><span>Explore</span></button>
        <button className={tab === "create" ? "tab active" : "tab"} aria-current={tab === "create" ? "page" : undefined} onClick={() => setTab("create")}><IconCreate active={tab === "create"} /><span>Create</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconProfile active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

/* +1 like when you tap the heart — keeps the count honest without a backend. */
function incr(likes: string): string {
  const n = Number(likes.replace(/,/g, ""));
  if (!Number.isFinite(n)) return likes;
  return (n + 1).toLocaleString("en-US");
}
