/** Minimal ambient types so Monaco can type-check Vite/React scaffold projects in-browser. */
export const MONACO_PROJECT_EXTRA_LIB = `
declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare namespace React {
  type ReactNode = any;
  type FC<P = Record<string, unknown>> = (props: P) => ReactNode | null;
  type FormEvent<T = Element> = Event & { currentTarget: T };
  type MouseEvent<T = Element> = Event & { currentTarget: T };
  interface ReactElement<P = any, T = any> {
    type: T;
    props: P;
  }
  function createElement(type: any, props?: any, ...children: any[]): any;
  function useState<S>(initial: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  function useRef<T>(initial: T): { current: T };
}

declare module "react" {
  export = React;
  export as namespace React;
}

declare module "react-dom" {
  export function createRoot(container: Element | DocumentFragment): { render(node: React.ReactNode): void };
}

declare module "react-dom/client" {
  export function createRoot(container: Element | DocumentFragment): { render(node: React.ReactNode): void };
}

declare module "lucide-react" {
  export const Sun: React.FC<any>;
  export const Moon: React.FC<any>;
  export const Menu: React.FC<any>;
  export const X: React.FC<any>;
  export const Code2: React.FC<any>;
  export const User: React.FC<any>;
  export const Home: React.FC<any>;
  export const Mail: React.FC<any>;
  export const ChevronDown: React.FC<any>;
  export const Briefcase: React.FC<any>;
  export const Layers: React.FC<any>;
  export const Terminal: React.FC<any>;
  export const Calculator: React.FC<any>;
  export const Sliders: React.FC<any>;
  export const ArrowLeft: React.FC<any>;
  export const ExternalLink: React.FC<any>;
  export const Github: React.FC<any>;
  export const Linkedin: React.FC<any>;
  export const Twitter: React.FC<any>;
  export const Globe: React.FC<any>;
  export const Sparkles: React.FC<any>;
  export const Shield: React.FC<any>;
  export const Award: React.FC<any>;
  export const Zap: React.FC<any>;
  export const FileCode2: React.FC<any>;
  export const Calendar: React.FC<any>;
  export const MapPin: React.FC<any>;
  export const Clock: React.FC<any>;
  export const CheckCircle2: React.FC<any>;
  export const ArrowRight: React.FC<any>;
  export const Star: React.FC<any>;
  export const Quote: React.FC<any>;
  export const Send: React.FC<any>;
  export const Phone: React.FC<any>;
  export const Download: React.FC<any>;
  export const Play: React.FC<any>;
  export const Eye: React.FC<any>;
  export const Copy: React.FC<any>;
  export const Check: React.FC<any>;
  export const Loader2: React.FC<any>;
  export const CircleAlert: React.FC<any>;
  export const Pencil: React.FC<any>;
  export const Save: React.FC<any>;
  export const Folder: React.FC<any>;
  export const FolderOpen: React.FC<any>;
  export const Braces: React.FC<any>;
  export const Settings2: React.FC<any>;
  export const Monitor: React.FC<any>;
  export const Tablet: React.FC<any>;
  export const Smartphone: React.FC<any>;
  export const RefreshCw: React.FC<any>;
  export const File: React.FC<any>;
  export const FileJson: React.FC<any>;
  export const FileText: React.FC<any>;
  export const FileImage: React.FC<any>;
}

declare module "vite/client" {
  interface ImportMetaEnv {
    readonly [key: string]: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
`;

/** TS codes that are noisy in the in-browser editor (no real node_modules). */
export const MONACO_IGNORED_DIAGNOSTIC_CODES = [
  2307, // Cannot find module
  2304, // Cannot find name
  2578, // Unused @ts-expect-error
  6133, // declared but never read
  6192, // All imports unused
  7016, // Could not find declaration for module (JS)
];
