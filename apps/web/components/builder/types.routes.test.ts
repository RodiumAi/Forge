import { describe, expect, it } from "vitest";
import { detectRoutes, type FileNode } from "./types";

const tree = (paths: string[]): FileNode[] => paths.map((path) => ({ path, type: "file" }));

describe("detectRoutes", () => {
  it("lists the routes an app declares, screens included", () => {
    const app = `
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route element={<Shell />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="search" element={<SearchScreen />} />
          <Route path="/now-playing" element={<NowPlayingScreen />} />
          <Route path="/album/:id" element={<AlbumScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>`;
    const files = [
      "src/App.tsx",
      "src/screens/HomeScreen.tsx",
      "src/screens/SearchScreen.tsx",
      "src/screens/NowPlayingScreen.tsx",
      "src/screens/OnboardingScreen.tsx",
      "src/screens/AlbumScreen.tsx",
    ];
    expect(detectRoutes(tree(files), { "src/App.tsx": app })).toEqual([
      "/",
      "/now-playing",
      "/onboarding",
      "/search",
    ]);
  });

  it("finds pages from src/pages in kebab case", () => {
    const app = `<Routes><Route path="/" element={<Home />} /><Route path="/about-us" element={<AboutUs />} /></Routes>`;
    const routes = detectRoutes(tree(["src/App.tsx", "src/pages/Home.tsx", "src/pages/AboutUs.tsx"]), {
      "src/App.tsx": app,
    });
    expect(routes).toContain("/about-us");
    expect(routes).not.toContain("/home");
  });

  it("does not invent pages from plain links when nothing declares them", () => {
    const app = `export default function App() { return <a href="/pricing">Pricing</a>; }`;
    expect(detectRoutes(tree(["src/App.tsx"]), { "src/App.tsx": app })).toEqual(["/"]);
  });
});
