import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Copy,
  Check,
  Download,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
  Clock,
  Ruler,
  Layers,
  Gauge,
  Hash,
  ImageIcon,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { GalleryEntry } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';
import { useGenerationStore } from '@/stores/generationStore';

interface GalleryDetailProps {
  entry: GalleryEntry;
  onClose: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore clipboard errors
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-sm p-0.5 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function MetadataRow({
  icon: Icon,
  label,
  value,
  copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
        <div className="flex items-center gap-1">
          <span className="break-all">{value}</span>
          {copyable && <CopyButton text={value} label={label} />}
        </div>
      </div>
    </div>
  );
}

export default function GalleryDetail({
  entry,
  onClose,
  onDelete,
  isDeleting,
}: GalleryDetailProps) {
  const [zoomed, setZoomed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const navigate = useNavigate();
  const serverUrl = useServerStore((s) => s.serverUrl);
  const generationStore = useGenerationStore();

  const imageUrl = `${serverUrl}/api/v1/gallery/${entry.id}/image`;

  const createdDate = new Date(entry.created_at);
  const formattedDate = createdDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = createdDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleRemix() {
    generationStore.setPrompt(entry.prompt);
    generationStore.setNegativePrompt(entry.negative_prompt);
    generationStore.setSelectedModelId(entry.model_id);
    generationStore.setSeed(entry.seed);
    generationStore.setDimensions(entry.width, entry.height);
    generationStore.setSteps(entry.steps);
    generationStore.setGuidanceScale(entry.guidance_scale);
    generationStore.clearSourceImages();
    if (entry.source_images?.length > 0) {
      for (const src of entry.source_images) {
        generationStore.addSourceImage(src);
      }
    }
    navigate('/');
  }

  function handleExport() {
    // Open image in a new tab for browser download
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `forge-${entry.id}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDelete() {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete(entry.id);
    setShowDeleteConfirm(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-fade-in fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Slide-in panel from right */}
      <div
        className="animate-slide-in-from-right fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
          <h3 className="text-sm font-semibold">Image Details</h3>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
            aria-label="Close detail panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          <div className="relative border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-4">
            <div
              className={cn(
                'relative cursor-pointer overflow-hidden rounded-lg transition-all',
                zoomed ? 'max-h-none' : 'max-h-80'
              )}
              onClick={() => setZoomed(!zoomed)}
            >
              <img
                src={imageUrl}
                alt={entry.prompt || 'Generated image'}
                className={cn(
                  'w-full rounded-lg object-contain transition-all',
                  zoomed ? 'max-h-none' : 'max-h-80'
                )}
              />
            </div>
            <button
              onClick={() => setZoomed(!zoomed)}
              className="absolute bottom-6 right-6 rounded-md bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
              aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            >
              {zoomed ? (
                <ZoomOut className="h-4 w-4" />
              ) : (
                <ZoomIn className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
            <button
              onClick={handleRemix}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
            >
              <Wand2 className="h-4 w-4" />
              Remix in Studio
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-[hsl(var(--accent))]"
              title="Save image"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                showDeleteConfirm
                  ? 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive))]/90'
                  : 'border-[hsl(var(--input))] bg-transparent text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10',
                isDeleting && 'pointer-events-none opacity-50'
              )}
              title={showDeleteConfirm ? 'Click again to confirm delete' : 'Delete image'}
            >
              <Trash2 className="h-4 w-4" />
              {showDeleteConfirm && <span>Confirm</span>}
            </button>
          </div>

          {/* Metadata */}
          <div className="flex flex-col gap-4 px-4 py-4">
            {/* Prompt */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                <span>Prompt</span>
                <CopyButton text={entry.prompt} label="prompt" />
              </div>
              <p className="text-sm leading-relaxed">
                {entry.prompt || <span className="italic text-[hsl(var(--muted-foreground))]">No prompt</span>}
              </p>
            </div>

            {/* Negative prompt */}
            {entry.negative_prompt && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>Negative Prompt</span>
                  <CopyButton text={entry.negative_prompt} label="negative prompt" />
                </div>
                <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {entry.negative_prompt}
                </p>
              </div>
            )}

            <hr className="border-[hsl(var(--border))]" />

            {/* Settings grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetadataRow
                icon={Layers}
                label="Model"
                value={entry.model_id}
              />
              <MetadataRow
                icon={Hash}
                label="Seed"
                value={String(entry.seed)}
                copyable
              />
              <MetadataRow
                icon={Ruler}
                label="Dimensions"
                value={`${entry.width} x ${entry.height}`}
              />
              <MetadataRow
                icon={Layers}
                label="Steps"
                value={String(entry.steps)}
              />
              <MetadataRow
                icon={Gauge}
                label="Guidance Scale"
                value={String(entry.guidance_scale)}
              />
              <MetadataRow
                icon={Clock}
                label="Generation Time"
                value={formatDuration(entry.generation_time_ms)}
              />
            </div>

            <hr className="border-[hsl(var(--border))]" />

            {/* Date */}
            <MetadataRow
              icon={Clock}
              label="Created"
              value={`${formattedDate} at ${formattedTime}`}
            />

            {/* Source images */}
            {entry.source_images && entry.source_images.length > 0 && (
              <>
                <hr className="border-[hsl(var(--border))]" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Source Images ({entry.source_images.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.source_images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Source image ${i + 1}`}
                        className="h-16 w-16 rounded-md border border-[hsl(var(--border))] object-cover"
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
