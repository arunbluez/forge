import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';

export default function PromptInput() {
  const [showNegative, setShowNegative] = useState(false);

  const prompt = useGenerationStore((s) => s.prompt);
  const negativePrompt = useGenerationStore((s) => s.negativePrompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const setNegativePrompt = useGenerationStore((s) => s.setNegativePrompt);

  return (
    <div className="flex flex-col gap-3">
      {/* Main prompt */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          Prompt
        </label>
        <textarea
          id="prompt"
          rows={5}
          placeholder="Describe the image you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(
            'resize-none rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm',
            'placeholder:text-[hsl(var(--muted-foreground))]',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-1',
            'focus:ring-offset-[hsl(var(--background))]'
          )}
        />
      </div>

      {/* Negative prompt - collapsible */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setShowNegative(!showNegative)}
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
            'transition-colors'
          )}
        >
          {showNegative ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Negative Prompt
          {negativePrompt.trim() && !showNegative && (
            <span className="ml-1 rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs">
              active
            </span>
          )}
        </button>

        {showNegative && (
          <textarea
            id="negative-prompt"
            rows={3}
            placeholder="What to avoid in the image..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className={cn(
              'resize-none rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm',
              'placeholder:text-[hsl(var(--muted-foreground))]',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-1',
              'focus:ring-offset-[hsl(var(--background))]'
            )}
          />
        )}
      </div>
    </div>
  );
}
