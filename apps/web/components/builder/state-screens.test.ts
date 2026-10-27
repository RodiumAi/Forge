import { describe, expect, it } from "vitest";
import { stateScreenNames } from "./page-rail-model";

const STATE_APP = `
export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <main>
      {tab === "home" && (
        <section className="home">...</section>
      )}
      {tab === "search" && <SearchScreen />}
      {tab === "library" ? <LibraryScreen /> : null}
      <button className={tab === "home" ? "tab active" : "tab"} onClick={() => setTab("home")} />
    </main>
  );
}`;

describe("stateScreenNames", () => {
  it("finds screens switched by a state, inline or as components", () => {
    expect(stateScreenNames({ "src/App.tsx": STATE_APP }).sort()).toEqual(["home", "library", "search"]);
  });

  it("is empty once the app has a router", () => {
    const routed = { "src/App.tsx": STATE_APP, "src/main.tsx": "<BrowserRouter><Routes /></BrowserRouter>" };
    expect(stateScreenNames(routed)).toEqual([]);
  });

  it("ignores a two-way toggle", () => {
    const app = `const [view, setView] = useState("grid"); return view === "grid" ? <Grid /> : <List />;`;
    expect(stateScreenNames({ "src/App.tsx": app })).toEqual([]);
  });
});
