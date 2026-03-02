import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev =
        (import.meta as unknown as Record<string, Record<string, unknown>>).env
          ?.DEV === true;

      return (
        <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
          <div className="flex max-w-lg flex-col items-center gap-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-10 py-10 text-center shadow-lg">
            {/* Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Something went wrong
            </h2>

            {/* Message */}
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              An unexpected error occurred. You can try again or restart the
              application.
            </p>

            {/* Stack trace in development */}
            {isDev && this.state.error && (
              <div className="w-full overflow-auto rounded-md bg-[hsl(var(--muted))] p-3 text-left">
                <p className="mb-1 text-xs font-semibold text-red-400">
                  {this.state.error.message}
                </p>
                <pre className="max-h-48 overflow-auto text-xs text-[hsl(var(--muted-foreground))]">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            {/* Retry button */}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
