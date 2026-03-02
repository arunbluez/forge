import { ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';

interface PreviewCanvasProps {
  statusMessage: string | null;
}

export default function PreviewCanvas({ statusMessage }: PreviewCanvasProps) {
  const isGenerating = useGenerationStore((s) => s.isGenerating);
  const progress = useGenerationStore((s) => s.progress);
  const currentStep = useGenerationStore((s) => s.currentStep);
  const totalSteps = useGenerationStore((s) => s.totalSteps);
  const previewImage = useGenerationStore((s) => s.previewImage);
  const finalImage = useGenerationStore((s) => s.finalImage);

  const displayImage = finalImage ?? previewImage;

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      {/* Main image area */}
      <div
        className={cn(
          'relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border min-h-0',
          displayImage
            ? 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
            : 'border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30'
        )}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt="Generated"
            className={cn(
              'max-h-full max-w-full object-contain',
              isGenerating && !finalImage && 'opacity-80'
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-[hsl(var(--muted-foreground))]">
            <ImageIcon className="h-12 w-12 opacity-40" />
            <p className="text-sm">Your image will appear here</p>
          </div>
        )}

        {/* Generating overlay indicator */}
        {isGenerating && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            <span className="text-xs font-medium text-white">
              {statusMessage ?? 'Generating...'}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isGenerating && totalSteps > 0 && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--primary))] transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      {/* Status message when not generating (e.g., error or cancelled) */}
      {!isGenerating && statusMessage && (
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))]">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
