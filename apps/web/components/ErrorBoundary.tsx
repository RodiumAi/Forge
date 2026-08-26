"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Rendered instead of the crashed subtree. Receives a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Remounting key: changing it clears a previous error automatically. */
  resetKey?: unknown;
  label?: string;
};

type State = { error: Error | null };

/**
 * Class error boundary for isolating a subtree.
 *
 * Next.js `error.tsx` only catches at route level, so one throw in a preview or
 * code pane would still blank the entire builder. Wrapping each heavy panel
 * keeps the rest of the builder — and the user's unsaved work — alive.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label || "ErrorBoundary"}]`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="panel-error" role="alert">
        <p className="panel-error-title">{this.props.label || "Panel"} crashed</p>
        <pre className="panel-error-detail">{error.message}</pre>
        <button type="button" className="panel-error-retry" onClick={this.reset}>
          Retry
        </button>
      </div>
    );
  }
}
