import { Bookmark, Heart, MessageCircle, Share } from "lucide-react";
import { fb, incr, photo, type Post } from "../data";
import Ring from "./Ring";

type Props = {
  post: Post;
  index: number;
  liked?: boolean;
  saved?: boolean;
  onLike: () => void;
  onSave: () => void;
};

export default function PostCard({ post: p, index: i, liked, saved, onLike, onSave }: Props) {
  return (
    <article className="post">
      <header className="post-head">
        <Ring ava={p.ava} index={i} w={96} size="sm" />
        <div className="post-who"><strong>{p.user}</strong><span>{p.tag}</span></div>
        <span className="post-time">{p.time}</span>
      </header>
      <div className="post-photo" style={{ backgroundImage: fb(i + 1) }}>
        <img src={photo(p.photo, 900)} alt="" />
      </div>
      <div className="post-actions">
        <button className={liked ? "pa liked" : "pa"} aria-pressed={liked} aria-label="Like" onClick={onLike}>
          <Heart size={22} strokeWidth={1.8} fill={liked ? "currentColor" : "none"} aria-hidden />
        </button>
        <button className="pa" aria-label="Comment"><MessageCircle size={22} strokeWidth={1.8} aria-hidden /></button>
        <button className="pa" aria-label="Share"><Share size={22} strokeWidth={1.8} aria-hidden /></button>
        <button className={saved ? "pa save on" : "pa save"} aria-pressed={saved} aria-label="Save" onClick={onSave}>
          <Bookmark size={22} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>
      <div className="post-body">
        <p className="likes">{liked ? incr(p.likes) : p.likes} likes</p>
        <p className="caption"><strong>{p.user}</strong> {p.caption}</p>
        <p className="cmt-link">View all comments</p>
      </div>
    </article>
  );
}
