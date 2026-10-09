import { MessageSquare } from "lucide-react";

type Props = { title: string; wordmark?: boolean };

export default function AppNavbar({ title, wordmark }: Props) {
  return (
    <header className="app-navbar">
      {wordmark ? <span className="wordmark">{title}</span> : <h1>{title}</h1>}
      <div className="nav-right">
        <button className="nav-action" aria-label="Messages">
          <MessageSquare size={20} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  );
}
