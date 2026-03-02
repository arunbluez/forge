import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';
import { useServerStore } from '@/stores/serverStore';
import { ForgeApiClient } from '@/lib/api/client';
import { useGeneration } from '@/hooks/useGeneration';
import type { ModelInfo, GenerateRequest } from '@/lib/api/types';

import PromptInput from '@/components/studio/PromptInput';
import GenerationSettings from '@/components/studio/GenerationSettings';
import ImageUpload from '@/components/studio/ImageUpload';
import PreviewCanvas from '@/components/studio/PreviewCanvas';
import RecentStrip from '@/components/studio/RecentStrip';

export default function Studio() {
  const serverUrl = useServerStore((s) => s.serverUrl);

  const prompt = useGenerationStore((s) => s.prompt);
  const negativePrompt = useGenerationStore((s) => s.negativePrompt);
  const selectedModelId = useGenerationStore((s) => s.selectedModelId);
  const width = useGenerationStore((s) => s.width);
  const height = useGenerationStore((s) => s.height);
  const steps = useGenerationStore((s) => s.steps);
  const seed = useGenerationStore((s) => s.seed);
  const guidanceScale = useGenerationStore((s) => s.guidanceScale);
  const sourceImages = useGenerationStore((s) => s.sourceImages);
  const isGenerating = useGenerationStore((s) => s.isGenerating);

  const { startGeneration, cancelGeneration, statusMessage } = useGeneration();

  // Fetch models to check if selected model supports img2img
  const { data: models = [] } = useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: async () => {
      const client = new ForgeApiClient(serverUrl);
      return client.getModels();
    },
    refetchInterval: 30_000,
  });

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId && m.is_downloaded) ?? null,
    [models, selectedModelId]
  );

  const showImageUpload = selectedModel?.supports_img2img ?? false;

  const canGenerate =
    !isGenerating &&
    prompt.trim().length > 0 &&
    selectedModelId !== null;

  const handleGenerate = () => {
    if (!canGenerate || !selectedModelId) return;

    const request: GenerateRequest = {
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim(),
      model_id: selectedModelId,
      width,
      height,
      steps,
      seed,
      guidance_scale: guidanceScale,
      source_images: sourceImages,
    };

    startGeneration(request);
  };

  const handleCancel = () => {
    cancelGeneration();
  };

  // Handle Ctrl+Enter to generate
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canGenerate) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex h-full gap-6" onKeyDown={handleKeyDown}>
      {/* Left Panel - Controls */}
      <div className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto pr-1 pb-2">
        <h2 className="text-lg font-semibold">Generate</h2>

        {/* Prompt Section */}
        <PromptInput />

        {/* Model & Generation Settings */}
        <GenerationSettings />

        {/* Image-to-Image Section (conditional) */}
        {showImageUpload && (
          <>
            <div className="h-px bg-[hsl(var(--border))]" />
            <ImageUpload />
          </>
        )}

        {/* Spacer to push button to bottom on short content */}
        <div className="flex-1" />

        {/* Generate / Cancel Button */}
        <div className="sticky bottom-0 bg-[hsl(var(--background))] pt-2 pb-1">
          {isGenerating ? (
            <button
              type="button"
              onClick={handleCancel}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
                'bg-[hsl(var(--destructive))] text-white',
                'text-sm font-medium transition-colors',
                'hover:bg-[hsl(var(--destructive))]/90'
              )}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerate}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
                'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                'text-sm font-medium transition-colors',
                'hover:bg-[hsl(var(--primary))]/90',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </button>
          )}
          {!isGenerating && (
            <p className="mt-1.5 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
              {canGenerate ? 'Ctrl+Enter to generate' : selectedModelId ? 'Enter a prompt to begin' : 'Select a model to begin'}
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex flex-1 flex-col gap-4 min-h-0 min-w-0">
        <PreviewCanvas statusMessage={statusMessage} />
        <RecentStrip />
      </div>
    </div>
  );
}
