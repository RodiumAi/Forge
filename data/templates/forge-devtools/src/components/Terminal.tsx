import { ArrowRight, Check, Lightbulb } from "lucide-react";

type Part = { t?: string; c?: string; icon?: typeof Check; iconClass?: string };

const TERMINAL_LINES: Array<{ prompt?: boolean; parts: Part[] }> = [
  { prompt: true, parts: [{ t: "hexbin analyze ./dist", c: "cmd" }] },
  { parts: [{ t: "  ", c: "green" }, { icon: Check, iconClass: "ticon-check", c: "green" }, { t: " ", c: "green" }, { t: "parsed 1,284 modules in ", c: "dim" }, { t: "0.42s", c: "violet" }] },
  { parts: [{ t: "  ", c: "green" }, { icon: Check, iconClass: "ticon-check", c: "green" }, { t: " ", c: "green" }, { t: "source maps resolved (", c: "dim" }, { t: "100%", c: "green" }, { t: " coverage)", c: "dim" }] },
  { parts: [{ t: "", c: "dim" }] },
  { parts: [{ t: "  TOP OFFENDERS", c: "violet" }, { t: "                    size     % of bundle", c: "dim" }] },
  { parts: [{ t: "  1. ", c: "dim" }, { t: "moment/locale/*", c: "cmd" }, { t: "           291 KB   ", c: "yellow" }, { t: "24.1%", c: "red" }] },
  { parts: [{ t: "  2. ", c: "dim" }, { t: "lodash", c: "cmd" }, { t: " (×3 copies!)", c: "red" }, { t: "      212 KB   ", c: "yellow" }, { t: "17.6%", c: "red" }] },
  { parts: [{ t: "  3. ", c: "dim" }, { t: "@corp/icons", c: "cmd" }, { t: "               96 KB    ", c: "yellow" }, { t: "7.9%", c: "yellow" }] },
  { parts: [{ t: "", c: "dim" }] },
  { parts: [{ t: "  ", c: "dim" }, { icon: Lightbulb, iconClass: "ticon-bulb", c: "yellow" }, { t: " fix available: ", c: "dim" }, { t: "hexbin fix --dedupe --tree-shake-locales", c: "green" }] },
  { parts: [{ t: "     estimated savings: ", c: "dim" }, { t: "-38.4% (461 KB)", c: "green" }] },
  { prompt: true, parts: [{ t: "", c: "cmd" }], },
];

export default function Terminal() {
  return (
    <div className="terminal">
      <div className="terminal-bar">
        <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
        <span className="terminal-title">hexbin — zsh</span>
      </div>
      <pre className="terminal-body">
        {TERMINAL_LINES.map((line, i) => (
          <div className="tline" key={i}>
            {line.prompt && (
              <span className="tprompt">
                <ArrowRight className="ticon ticon-prompt" strokeWidth={3} aria-hidden="true" /> ~{" "}
              </span>
            )}
            {line.parts.map((p, j) => {
              const Icon = p.icon;
              return (
                <span key={j} className={`tk-${p.c ?? "dim"}`}>
                  {Icon ? <Icon className={`ticon ${p.iconClass ?? ""}`} strokeWidth={2.5} aria-hidden="true" /> : p.t}
                </span>
              );
            })}
            {i === TERMINAL_LINES.length - 1 && <span className="cursor" aria-hidden />}
          </div>
        ))}
      </pre>
    </div>
  );
}
