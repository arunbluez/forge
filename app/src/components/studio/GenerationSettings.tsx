import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dices } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';
import { useServerStore } from '@/stores/serverStore';
import { ForgeApiClient } from '@/lib/api/client';
import type { ModelInfo } from '@/lib/api/types';

const RESOLUTION_PRESETS = [
  { label: '512', w: 512, h: 512 },
  { label: '768', w: 768, h: 768 },
  { label: '1024', w: 1024, h: 1024 },
  { label: '1280', w: 1280, h: 1280 },
] as const;

export default function GenerationSettings() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const selectedModelId = useGenerationStore((s) => s.selectedModelId);
  const setSelectedModelId = useGenerationStore((s) => s.setSelectedModelId);
  const width = useGenerationStore((s) => s.width);
  const height = useGenerationStore((s) => s.height);
  const setDimensions = useGenerationStore((s) => s.setDimensions);
  const steps = useGenerationStore((s) => s.steps);
  const setSteps = useGenerationStore((s) => s.setSteps);
  const guidanceScale = useGenerationStore((s) => s.guidanceScale);
  const setGuidanceScale = useGenerationStore((s) => s.setGuidanceScale);
  const seed = useGenerationStore((s) => s.seed);
  const setSeed = useGenerationStore((s) => s.setSeed);

  // Fetch models via React Query
  const { data: models = [] } = useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: async () => {
      const client = new ForgeApiClient(serverUrl);
      return client.getModels();
    },
    refetchInterval: 30_000,
  });

  // Filter to only downloaded models
  const downloadedModels = useMemo(
    () => models.filter((m) => m.is_downloaded),
    [models]
  );

  // Currently selected model object
  const selectedModel = useMemo(
    () => downloadedModels.find((m) => m.id === selectedModelId) ?? null,
    [downloadedModels, selectedModelId]
  );

  // When model selection changes, apply its defaults
  useEffect(() => {
    if (selectedModel) {
      setSteps(selectedModel.default_steps);
      setGuidanceScale(selectedModel.default_cfg);
    }
  }, [selectedModelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first model if none selected
  useEffect(() => {
    if (!selectedModelId && downloadedModels.length > 0) {
      setSelectedModelId(downloadedModels[0].id);
    }
  }, [downloadedModels, selectedModelId, setSelectedModelId]);

  // Check if current resolution matches a preset
  const isCustomResolution = !RESOLUTION_PRESETS.some(
    (p) => p.w === width && p.h === height
  );

  const randomizeSeed = () => setSeed(-1);

  return (
    <div className="flex flex-col gap-4">
      {/* Model Selector */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="model-select" className="text-sm font-medium">
          Model
        </label>
        <select
          id="model-select"
          value={selectedModelId ?? ''}
          onChange={(e) => setSelectedModelId(e.target.value || null)}
          className={cn(
            'rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-1',
            'focus:ring-offset-[hsl(var(--background))]'
          )}
        >
          <option value="">Select a model...</option>
          {downloadedModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.type})
            </option>
          ))}
        </select>
        {selectedModel && (
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                selectedModel.supports_img2img
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              )}
            >
              {selectedModel.supports_img2img ? 'img2img' : 'txt2img'}
            </span>
            {selectedModel.loaded && (
              <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                loaded
              </span>
            )}
          </div>
        )}
        {downloadedModels.length === 0 && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            No models downloaded. Visit the Models page to download one.
          </p>
        )}
      </div>

      {/* Resolution Presets */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Resolution</label>
        <div className="grid grid-cols-5 gap-1.5">
          {RESOLUTION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setDimensions(preset.w, preset.h)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                width === preset.w && height === preset.h
                  ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              // Toggle custom mode - if already custom, do nothing
              if (!isCustomResolution) {
                setDimensions(640, 480);
              }
            }}
            className={cn(
              'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
              isCustomResolution
                ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
            )}
          >
            Custom
          </button>
        </div>
        {isCustomResolution && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={64}
              max={2048}
              step={64}
              value={width}
              onChange={(e) =>
                setDimensions(Number(e.target.value) || 512, height)
              }
              className={cn(
                'w-20 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 py-1 text-xs',
                'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]'
              )}
            />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">x</span>
            <input
              type="number"
              min={64}
              max={2048}
              step={64}
              value={height}
              onChange={(e) =>
                setDimensions(width, Number(e.target.value) || 512)
              }
              className={cn(
                'w-20 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 py-1 text-xs',
                'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]'
              )}
            />
          </div>
        )}
      </div>

      {/* Steps Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="steps-slider" className="text-sm font-medium">
            Steps
          </label>
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {steps}
          </span>
        </div>
        <input
          id="steps-slider"
          type="range"
          min={1}
          max={50}
          step={1}
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[hsl(var(--muted))] accent-[hsl(var(--primary))]"
        />
        <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
          <span>1</span>
          <span>50</span>
        </div>
      </div>

      {/* Guidance Scale Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="cfg-slider" className="text-sm font-medium">
            Guidance Scale
          </label>
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {guidanceScale.toFixed(1)}
          </span>
        </div>
        <input
          id="cfg-slider"
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={guidanceScale}
          onChange={(e) => setGuidanceScale(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[hsl(var(--muted))] accent-[hsl(var(--primary))]"
        />
        <div className="flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
          <span>0</span>
          <span>20</span>
        </div>
      </div>

      {/* Seed Input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="seed-input" className="text-sm font-medium">
          Seed
        </label>
        <div className="flex items-center gap-2">
          <input
            id="seed-input"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className={cn(
              'flex-1 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-1.5 text-sm tabular-nums',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-1',
              'focus:ring-offset-[hsl(var(--background))]'
            )}
          />
          <button
            type="button"
            onClick={randomizeSeed}
            title="Random seed (-1)"
            className={cn(
              'rounded-md border border-[hsl(var(--border))] p-2 transition-colors',
              'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
              'text-[hsl(var(--muted-foreground))]'
            )}
          >
            <Dices className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Use -1 for a random seed each generation
        </p>
      </div>
    </div>
  );
}
