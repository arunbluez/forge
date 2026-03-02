import { useState, useMemo, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { ForgeApiClient } from '@/lib/api/client';
import type { ModelInfo, SystemInfo } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';

const ONBOARDING_COMPLETE_KEY = 'forge_onboarding_complete';

/**
 * Returns true if onboarding has been completed previously.
 */
export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as complete in localStorage.
 */
function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {
    // localStorage might be unavailable
  }
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
// Onboarding Flow
// ---------------------------------------------------------------------------

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const apiClient = useMemo(
    () => new ForgeApiClient(serverUrl),
    [serverUrl]
  );

  const [step, setStep] = useState<'welcome' | 'download' | 'ready'>('welcome');

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const { data: models } = useQuery<ModelInfo[]>({
    queryKey: ['models'],
    queryFn: () => apiClient.getModels(),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((m) => m.is_downloading)) {
        return 2000;
      }
      return false;
    },
  });

  const { data: systemInfo } = useQuery<SystemInfo>({
    queryKey: ['system'],
    queryFn: () => apiClient.getSystemInfo(),
    staleTime: 60_000,
  });

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  const recommendedModelId = systemInfo?.recommended_model ?? null;

  const recommendedModels = useMemo(() => {
    if (!models) return [];
    // Show the system-recommended model first, then any small/fast models
    if (recommendedModelId) {
      const rec = models.find((m) => m.id === recommendedModelId);
      if (rec) return [rec];
    }
    // Fallback: pick the first model with lowest min_ram
    const sorted = [...models].sort((a, b) => a.min_ram_gb - b.min_ram_gb);
    return sorted.slice(0, 1);
  }, [models, recommendedModelId]);

  // Check if any recommended model finished downloading
  const hasDownloadedModel = useMemo(() => {
    if (!models) return false;
    return models.some((m) => m.is_downloaded);
  }, [models]);

  const isDownloading = useMemo(() => {
    if (!models) return false;
    return models.some((m) => m.is_downloading);
  }, [models]);

  // Auto-advance to ready when download completes
  const downloadingModel = useMemo(() => {
    if (!models) return null;
    return models.find((m) => m.is_downloading) ?? null;
  }, [models]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const downloadMutation = useMutation({
    mutationFn: (modelId: string) => apiClient.downloadModel(modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const handleDownload = useCallback(
    (modelId: string) => {
      downloadMutation.mutate(modelId);
    },
    [downloadMutation]
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleGoToStudio = () => {
    markOnboardingComplete();
    onComplete();
    navigate('/');
  };

  const handleSkip = () => {
    markOnboardingComplete();
    onComplete();
  };

  // -------------------------------------------------------------------------
  // If download completes while on download step, advance to ready
  // -------------------------------------------------------------------------

  if (step === 'download' && hasDownloadedModel && !isDownloading) {
    setStep('ready');
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-2xl">
        {/* ---- Welcome step ---- */}
        {step === 'welcome' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              Welcome to Forge
            </h1>

            <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              Generate stunning images with AI, right on your Mac.
            </p>

            <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3 text-left">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Forge runs entirely on your Mac. No cloud, no subscription, no
                data leaves your device.
              </p>
            </div>

            <button
              onClick={() => setStep('download')}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ---- Download step ---- */}
        {step === 'download' && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Step 1 of 1
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))]">
                Download a model to get started
              </h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                You need at least one model to generate images.
              </p>
            </div>

            {/* Recommended models list */}
            <div className="flex flex-col gap-3">
              {recommendedModels.map((model) => (
                <div
                  key={model.id}
                  className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                        {model.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Requires {model.min_ram_gb} GB RAM (recommended {model.rec_ram_gb} GB)
                  </p>

                  {/* Download progress */}
                  {model.is_downloading && (
                    <div className="mt-3">
                      <ProgressBar progress={model.download_progress} />
                    </div>
                  )}

                  {/* Action */}
                  <div className="mt-3">
                    {!model.is_downloaded && !model.is_downloading && (
                      <button
                        onClick={() => handleDownload(model.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Model
                      </button>
                    )}
                    {model.is_downloading && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Downloading...
                      </span>
                    )}
                    {model.is_downloaded && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Downloaded
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Show active download from elsewhere (not recommended) */}
              {downloadingModel &&
                !recommendedModels.some((m) => m.id === downloadingModel.id) && (
                  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {downloadingModel.name}
                    </p>
                    <div className="mt-2">
                      <ProgressBar progress={downloadingModel.download_progress} />
                    </div>
                  </div>
                )}
            </div>

            {/* Skip link */}
            <div className="text-center">
              <button
                onClick={handleSkip}
                className="text-xs text-[hsl(var(--muted-foreground))] underline transition-colors hover:text-[hsl(var(--foreground))]"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ---- Ready step ---- */}
        {step === 'ready' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <CheckCircle2 className="h-7 w-7 text-green-400" />
            </div>

            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              You're ready!
            </h2>

            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Head to the Studio to generate your first image.
            </p>

            <button
              onClick={handleGoToStudio}
              className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              Go to Studio
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
