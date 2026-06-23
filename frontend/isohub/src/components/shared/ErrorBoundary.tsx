import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label shown above the error so the user knows which area broke. */
  area?: string;
}

interface State {
  error: Error | null;
}

/**
 * Minimal Error Boundary. Survives render-time crashes in its subtree and
 * renders the captured error instead of unmounting the whole page. Use it
 * to wrap optional/secondary regions (a side panel, a detail block) so a
 * bug there doesn't kill the rest of the UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", this.props.area ?? "render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-md border border-danger/30 bg-danger-bg/40 p-4 text-sm text-danger-text">
          <p className="font-semibold mb-1">
            {this.props.area ? `${this.props.area} — ` : ""}render error
          </p>
          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
