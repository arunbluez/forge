import { useGenerationStore } from '@/stores/generationStore';

export default function Studio() {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    isGenerating,
    previewImage,
    finalImage,
  } = useGenerationStore();

  const displayImage = finalImage ?? previewImage;

  return (
    <div className="flex h-full gap-6">
      {/* Controls */}
      <div className="flex w-80 shrink-0 flex-col gap-4">
        <h2 className="text-lg font-semibold">Generate</h2>

        <div className="flex flex-col gap-2">
          <label htmlFor="prompt" className="text-sm font-medium">
            Prompt
          </label>
          <textarea
            id="prompt"
            rows={4}
            placeholder="Describe the image you want to create..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="resize-none rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="negative-prompt" className="text-sm font-medium">
            Negative Prompt
          </label>
          <textarea
            id="negative-prompt"
            rows={2}
            placeholder="What to avoid..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            className="resize-none rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <button
          disabled={isGenerating || !prompt.trim()}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Preview */}
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50">
        {displayImage ? (
          <img
            src={displayImage}
            alt="Generated"
            className="max-h-full max-w-full rounded-md object-contain"
          />
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Generated image will appear here
          </p>
        )}
      </div>
    </div>
  );
}
