/**
 * Ambient types for the in-browser editor.
 *
 * There is no real node_modules in the preview, so Monaco needs declarations
 * for everything the generated app may import. The previous version hard-coded
 * a partial React namespace and a fixed list of ~55 lucide icons, which meant
 * valid code lit up red: any icon outside the list, and any hook beyond the six
 * declared ones. Module declarations are now generated from the runtime
 * manifest, and React is typed permissively rather than partially.
 */

const REACT_AND_JSX = `
declare namespace JSX {
  interface Element {}
  interface ElementClass { render(): any }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type Key = string | number;
  type Ref<T = any> = any;
  type CSSProperties = Record<string, any>;
  type ComponentType<P = any> = (props: P) => any;
  type FC<P = any> = (props: P & { children?: ReactNode }) => any;
  type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  type SetStateAction<S> = S | ((prev: S) => S);
  type Dispatch<A> = (value: A) => void;
  type MutableRefObject<T> = { current: T };
  type RefObject<T> = { readonly current: T | null };
  type Context<T> = { Provider: any; Consumer: any; displayName?: string };

  interface SyntheticEvent<T = Element> {
    currentTarget: T & Record<string, any>;
    target: any;
    preventDefault(): void;
    stopPropagation(): void;
    [key: string]: any;
  }
  type FormEvent<T = Element> = SyntheticEvent<T>;
  type MouseEvent<T = Element> = SyntheticEvent<T>;
  type ChangeEvent<T = Element> = SyntheticEvent<T> & { target: T & { value: any; checked?: boolean } };
  type KeyboardEvent<T = Element> = SyntheticEvent<T> & { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };
  type FocusEvent<T = Element> = SyntheticEvent<T>;
  type DragEvent<T = Element> = SyntheticEvent<T> & { dataTransfer: any };
  type ClipboardEvent<T = Element> = SyntheticEvent<T> & { clipboardData: any };

  const Fragment: any;
  const StrictMode: any;
  const Suspense: any;

  function createElement(type: any, props?: any, ...children: any[]): any;
  function cloneElement(element: any, props?: any, ...children: any[]): any;
  function createContext<T>(defaultValue: T): Context<T>;
  function forwardRef<T = any, P = any>(render: (props: P, ref: Ref<T>) => any): any;
  function memo<T>(component: T, propsAreEqual?: (a: any, b: any) => boolean): T;
  function lazy<T>(factory: () => Promise<{ default: T }>): T;

  function useState<S>(initial?: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useLayoutEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  function useMemo<T>(factory: () => T, deps?: readonly any[]): T;
  function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: readonly any[]): T;
  function useRef<T = any>(initial?: T | null): MutableRefObject<T>;
  function useContext<T>(context: Context<T>): T;
  function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, Dispatch<A>];
  function useId(): string;
  function useTransition(): [boolean, (cb: () => void) => void];
  function useDeferredValue<T>(value: T): T;
  function useImperativeHandle(ref: any, init: () => any, deps?: readonly any[]): void;
  function useSyncExternalStore<T>(subscribe: any, getSnapshot: () => T): T;
}

declare module "react" {
  export = React;
  export as namespace React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react-dom" {
  export function createRoot(container: any): { render(node: any): void; unmount(): void };
  export function flushSync<T>(fn: () => T): T;
}

declare module "react-dom/client" {
  export function createRoot(container: any): { render(node: any): void; unmount(): void };
  export function hydrateRoot(container: any, node: any): any;
}

declare module "vite/client" {
  interface ImportMetaEnv {
    readonly [key: string]: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

interface ImportMetaEnv {
  readonly [key: string]: any;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
`;

/** Modules declared by hand above; must not be re-declared from the manifest. */
const ALREADY_DECLARED = new Set([
  "react",
  "react-dom",
  "vite",
  "typescript",
  "@vitejs/plugin-react",
  "@types/react",
  "@types/react-dom",
]);

/**
 * Build ambient declarations for every allowed package.
 *
 * `any` rather than real types: the goal is to stop false errors and keep JSX
 * usable, not to reimplement each library's typings in the browser.
 */
export function buildProjectExtraLib(packages: string[]): string {
  const modules = packages
    .filter((name) => !ALREADY_DECLARED.has(name))
    .map(
      (name) =>
        `declare module "${name}" {\n` +
        `  const whatever: any;\n` +
        `  export = whatever;\n` +
        `}\n` +
        // Subpath imports (lucide-react/icons, @hookform/resolvers/zod, ...)
        `declare module "${name}/*" {\n` +
        `  const whatever: any;\n` +
        `  export = whatever;\n` +
        `}`,
    )
    .join("\n\n");

  return `${REACT_AND_JSX}\n${modules}\n`;
}

/** Fallback used before the manifest has been fetched. */
export const MONACO_PROJECT_EXTRA_LIB = buildProjectExtraLib([]);

/** TS codes that are noisy in the in-browser editor (no real node_modules). */
export const MONACO_IGNORED_DIAGNOSTIC_CODES = [
  2307, // Cannot find module
  2304, // Cannot find name
  2305, // Module has no exported member — icon/helper names we cannot enumerate
  2339, // Property does not exist — permissive `any` shims
  2578, // Unused @ts-expect-error
  6133, // declared but never read
  6192, // All imports unused
  7016, // Could not find declaration for module (JS)
];
