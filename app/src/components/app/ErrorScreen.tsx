import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorScreen({
  title = 'Backend failed to start',
  message = 'Forge could not connect to the backend server.',
  onRetry,
}: ErrorScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex max-w-md flex-col items-center gap-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-10 py-10 text-center shadow-lg">
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          {title}
        </h2>

        {/* Message */}
        <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {message}
        </p>

        {/* Helper text */}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Check that the backend is running on port 8188
        </p>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
          >
            <RotateCcw className="h-4 w-4" />
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}
