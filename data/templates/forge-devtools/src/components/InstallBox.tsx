import { useState } from "react";
import { Check } from "lucide-react";

export default function InstallBox() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"npm" | "pnpm" | "brew">("npm");

  const INSTALL: Record<typeof tab, string> = {
    npm: "npm install -g hexbin",
    pnpm: "pnpm add -g hexbin",
    brew: "brew install hexbin",
  };

  return (
    <div className="install-box" id="install">
      <div className="install-tabs">
        {(["npm", "pnpm", "brew"] as const).map((t) => (
          <button key={t} className={tab === t ? "itab active" : "itab"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="install-row">
        <code className="install-cmd">
          <span className="dollar">$</span> {INSTALL[tab]}
        </code>
        <button className="copy-btn" onClick={() => setCopied(true)}>
          {copied ? (
            <>
              <Check className="copy-icon" aria-hidden="true" /> Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
    </div>
  );
}
