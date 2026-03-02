import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const STATUS_MESSAGES = [
  'Starting inference engine...',
  'Connecting to backend...',
  'Initializing model registry...',
];

const MESSAGE_INTERVAL = 4_000;

export default function StartupScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) =>
        prev < STATUS_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, MESSAGE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
      <div className="flex flex-col items-center gap-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-12 py-10 shadow-lg">
        {/* Logo / Name */}
        <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
          Forge
        </h1>

        {/* Spinner */}
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--muted-foreground))]" />

        {/* Status message */}
        <p className="text-sm text-[hsl(var(--muted-foreground))] transition-opacity duration-300">
          {STATUS_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}
