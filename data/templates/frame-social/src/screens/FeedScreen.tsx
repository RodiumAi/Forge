import "../styles/feed.css";
import { Plus } from "lucide-react";
import { POSTS, STORIES } from "../data";
import PostCard from "../components/PostCard";
import Ring from "../components/Ring";

type Props = {
  liked: Record<string, boolean>;
  saved: Record<string, boolean>;
  onLike: (user: string) => void;
  onSave: (user: string) => void;
};

export default function FeedScreen({ liked, saved, onLike, onSave }: Props) {
  return (
    <main className="app-main feed-screen">
      <div className="stories" aria-label="Stories">
        {STORIES.map((st, i) => (
          <button className="story" key={st.name + i}>
            <Ring ava={st.ava} index={i} w={160} me={st.me}>
              {st.me && <span className="story-add" aria-hidden><Plus size={18} strokeWidth={2.2} /></span>}
            </Ring>
            <span className="story-name">{st.me ? "Your story" : st.name}</span>
          </button>
        ))}
      </div>

      <div className="posts">
        {POSTS.map((p, i) => (
          <PostCard
            key={p.user}
            post={p}
            index={i}
            liked={liked[p.user]}
            saved={saved[p.user]}
            onLike={() => onLike(p.user)}
            onSave={() => onSave(p.user)}
          />
        ))}
      </div>
    </main>
  );
}
