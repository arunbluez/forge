import { useState, useMemo, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Download,
  Trash2,
  Loader2,
  HardDrive,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X,
  Sparkles,
  Play,
} from 'lucide-react';
import { ForgeApiClient } from '@/lib/api/client';
import type { ModelInfo, SystemInfo } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';
import { cn, formatBytes } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map model IDs to human-readable descriptions */
const MODEL_DESCRIPTIONS: Record<string, string> = {
  'flux2-klein-4b-sdnq': 'Best balance of quality and speed',
  'flux2-klein-9b-sdnq': 'Higher quality, needs more RAM',
  'flux2-klein-4b-int8': 'Int8 quantization for better fidelity',
  'zimage-turbo-quant': 'Ultra-fast generation, quantized',
  'zimage-turbo-full': 'Ultra-fast generation, full precision',
};

/** Friendly quantization label */
function quantLabel(quantization: string | null): string {
  if (quantization === 'sdnq') return '4bit SDNQ';
  if (quantization === 'quanto-int8') return 'Int8';
  return 'Full Precision';
}

/** Friendly type label */
function typeLabel(model: ModelInfo): string {
  if (model.supports_img2img) return 'Text to Image + Image to Image';
  return 'Text to Image';
}

/** Short type label for badge */
function typeBadge(model: ModelInfo): string {
  if (model.supports_img2img) return 'txt2img + img2img';
  return 'txt2img';
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  modelName,
  onConfirm,
  onCancel,
}: {
  modelName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
        <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
          Delete Model
        </h3>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Are you sure you want to delete <strong>{modelName}</strong>? This
          will remove the downloaded model files from disk. You can re-download
          it later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-medium tabular-nums text-[hsl(var(--muted-foreground))]">
        {progress.toFixed(1)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model Card
// ---------------------------------------------------------------------------

function ModelCard({
  model,
  systemRam,
  isRecommended,
  onDownload,
  onLoad,
  onDelete,
  isLoadingModel,
  isDeletingModel,
}: {
  model: ModelInfo;
  systemRam: number;
  isRecommended: boolean;
  onDownload: (id: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  isLoadingModel: boolean;
  isDeletingModel: boolean;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const exceedsRam = systemRam > 0 && model.min_ram_gb > systemRam;
  const description = MODEL_DESCRIPTIONS[model.id] ?? '';

  // Determine status color for the left border accent
  const borderColor = model.loaded
    ? 'border-l-green-500'
    : model.is_downloaded
      ? 'border-l-blue-500'
      : 'border-l-[hsl(var(--border))]';

  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-[hsl(var(--border))] border-l-4 bg-[hsl(var(--card))] p-5 transition-shadow hover:shadow-md',
          borderColor
        )}
      >
        {/* Header row: name + status badges */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
              {model.name}
            </h3>
            {isRecommended && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                <Sparkles className="h-3 w-3" />
                Recommended
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {model.loaded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                <Circle className="h-2 w-2 fill-green-400" />
                Loaded
              </span>
            )}
            {!model.loaded && model.is_downloaded && !model.is_downloading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                <CheckCircle2 className="h-3 w-3" />
                Downloaded
              </span>
            )}
            {model.is_downloading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Downloading
              </span>
            )}
            {!model.is_downloaded && !model.is_downloading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Not Downloaded
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}

        {/* Download progress bar */}
        {model.is_downloading && (
          <div className="mt-3">
            <ProgressBar progress={model.download_progress} />
          </div>
        )}

        {/* Metadata grid */}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[hsl(var(--muted-foreground))]">Type:</span>
            <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-medium text-[hsl(var(--foreground))]">
              {typeBadge(model)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[hsl(var(--muted-foreground))]">Quant:</span>
            <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-xs font-medium text-[hsl(var(--foreground))]">
              {quantLabel(model.quantization)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[hsl(var(--muted-foreground))]">
              Min RAM:
            </span>
            <span className="text-[hsl(var(--foreground))]">
              {model.min_ram_gb} GB
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[hsl(var(--muted-foreground))]">
              Rec RAM:
            </span>
            <span className="text-[hsl(var(--foreground))]">
              {model.rec_ram_gb} GB
            </span>
          </div>
          {model.is_downloaded && model.disk_size_bytes > 0 && (
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[hsl(var(--foreground))]">
                {formatBytes(model.disk_size_bytes)}
              </span>
            </div>
          )}
        </div>

        {/* RAM warning */}
        {exceedsRam && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              May exceed your available RAM ({systemRam} GB). Performance may be
              degraded.
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2">
          {/* Not downloaded -> Download button */}
          {!model.is_downloaded && !model.is_downloading && (
            <button
              onClick={() => onDownload(model.id)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}

          {/* Downloaded but not loaded -> Load button */}
          {model.is_downloaded && !model.loaded && !model.is_downloading && (
            <button
              onClick={() => onLoad(model.id)}
              disabled={isLoadingModel}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoadingModel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isLoadingModel ? 'Loading...' : 'Load'}
            </button>
          )}

          {/* Currently loaded indicator */}
          {model.loaded && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </span>
          )}

          {/* Downloaded -> Delete button */}
          {model.is_downloaded && !model.is_downloading && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeletingModel}
              className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-50"
            >
              {isDeletingModel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          )}

          {/* Downloading -> cancel is not easily supported on the backend snapshot_download,
              but we show a visual indicator */}
          {model.is_downloading && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Download in progress...
            </span>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <DeleteDialog
          modelName={model.name}
          onConfirm={() => {
            setShowDeleteDialog(false);
            onDelete(model.id);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ModelManager() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const queryClient = useQueryClient();

  const apiClient = useMemo(
    () => new ForgeApiClient(serverUrl),
    [serverUrl]
  );

  // Track which model is currently in a loading mutation
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const {
    data: models,
    isLoading: modelsLoading,
    error: modelsError,
  } = useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: () => apiClient.getModels(),
    refetchInterval: (query) => {
      // Poll every 2 seconds if any model is downloading
      const data = query.state.data;
      if (data && data.some((m) => m.is_downloading)) {
        return 2000;
      }
      return false;
    },
  });

  const {
    data: systemInfo,
    isLoading: systemLoading,
  } = useQuery<SystemInfo>({
    queryKey: ['system'],
    queryFn: () => apiClient.getSystemInfo(),
    staleTime: 60_000,
  });

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const downloadMutation = useMutation({
    mutationFn: (modelId: string) => apiClient.downloadModel(modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const loadMutation = useMutation({
    mutationFn: (modelId: string) => apiClient.loadModel(modelId),
    onMutate: (modelId) => {
      setLoadingModelId(modelId);
    },
    onSettled: () => {
      setLoadingModelId(null);
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelId: string) => apiClient.deleteModel(modelId),
    onMutate: (modelId) => {
      setDeletingModelId(modelId);
    },
    onSettled: () => {
      setDeletingModelId(null);
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleDownload = useCallback(
    (modelId: string) => {
      downloadMutation.mutate(modelId);
    },
    [downloadMutation]
  );

  const handleLoad = useCallback(
    (modelId: string) => {
      loadMutation.mutate(modelId);
    },
    [loadMutation]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      deleteMutation.mutate(modelId);
    },
    [deleteMutation]
  );

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const systemRam = systemInfo?.total_ram_gb ?? 0;
  const recommendedModelId = systemInfo?.recommended_model ?? null;

  const totalDiskUsage = useMemo(() => {
    if (!models) return 0;
    return models
      .filter((m) => m.is_downloaded)
      .reduce((sum, m) => sum + m.disk_size_bytes, 0);
  }, [models]);

  const downloadedCount = useMemo(() => {
    if (!models) return 0;
    return models.filter((m) => m.is_downloaded).length;
  }, [models]);

  const recommendedModelName = useMemo(() => {
    if (!models || !recommendedModelId) return null;
    const model = models.find((m) => m.id === recommendedModelId);
    return model?.name ?? null;
  }, [models, recommendedModelId]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Model Manager
        </h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Download, load, and manage AI models for image generation.
        </p>
      </div>

      {/* System info banner */}
      {!systemLoading && systemInfo && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3">
          {/* RAM */}
          <div className="flex items-center gap-2 text-sm">
            <Cpu className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[hsl(var(--muted-foreground))]">
              System RAM:
            </span>
            <span className="font-medium text-[hsl(var(--foreground))]">
              {systemRam} GB
            </span>
          </div>

          {/* GPU */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">GPU:</span>
            <span className="font-medium uppercase text-[hsl(var(--foreground))]">
              {systemInfo.gpu_type}
            </span>
          </div>

          {/* Separator */}
          <div className="hidden h-5 w-px bg-[hsl(var(--border))] sm:block" />

          {/* Storage usage */}
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[hsl(var(--muted-foreground))]">
              Storage used:
            </span>
            <span className="font-medium text-[hsl(var(--foreground))]">
              {formatBytes(totalDiskUsage)}
            </span>
            <span className="text-[hsl(var(--muted-foreground))]">
              ({downloadedCount} model{downloadedCount !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}

      {/* Recommendation banner */}
      {recommendedModelName && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-amber-300">
            Recommended for your system:{' '}
            <strong className="text-amber-200">{recommendedModelName}</strong>
          </span>
        </div>
      )}

      {/* Loading state */}
      {modelsLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
          <span className="ml-2 text-sm text-[hsl(var(--muted-foreground))]">
            Loading models...
          </span>
        </div>
      )}

      {/* Error state */}
      {modelsError && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 py-12">
          <X className="h-6 w-6 text-red-400" />
          <p className="text-sm font-medium text-red-400">
            Failed to load models
          </p>
          <p className="text-xs text-red-400/80">
            {modelsError instanceof Error
              ? modelsError.message
              : 'Unknown error'}
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Make sure the backend server is running.
          </p>
        </div>
      )}

      {/* Model list */}
      {models && models.length > 0 && (
        <div className="flex flex-col gap-4">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              systemRam={systemRam}
              isRecommended={model.id === recommendedModelId}
              onDownload={handleDownload}
              onLoad={handleLoad}
              onDelete={handleDelete}
              isLoadingModel={loadingModelId === model.id}
              isDeletingModel={deletingModelId === model.id}
            />
          ))}
        </div>
      )}

      {/* Empty state - models loaded but none exist (unlikely for registry) */}
      {models && models.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] py-20">
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            No models available
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Check your backend configuration.
          </p>
        </div>
      )}

      {/* Mutation error toast area */}
      {(downloadMutation.error ||
        loadMutation.error ||
        deleteMutation.error) && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-red-500/30 bg-red-950 px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-red-400">Operation failed</p>
          <p className="mt-0.5 text-xs text-red-400/80">
            {(
              downloadMutation.error ??
              loadMutation.error ??
              deleteMutation.error
            ) instanceof Error
              ? (
                  (downloadMutation.error ??
                    loadMutation.error ??
                    deleteMutation.error) as Error
                ).message
              : 'An unexpected error occurred.'}
          </p>
        </div>
      )}
    </div>
  );
}
