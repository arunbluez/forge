import { useCallback, useRef, useState } from 'react';
import { Upload, X, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';

const MAX_IMAGES = 6;

export default function ImageUpload() {
  const sourceImages = useGenerationStore((s) => s.sourceImages);
  const addSourceImage = useGenerationStore((s) => s.addSourceImage);
  const removeSourceImage = useGenerationStore((s) => s.removeSourceImage);

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = MAX_IMAGES - sourceImages.length;
      const toProcess = fileArray
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, remaining);

      toProcess.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 portion (remove data:image/...;base64, prefix for API)
          addSourceImage(result);
        };
        reader.readAsDataURL(file);
      });
    },
    [sourceImages.length, addSourceImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [processFiles]
  );

  const canAddMore = sourceImages.length < MAX_IMAGES;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Reference Images</label>

      {/* Thumbnails grid */}
      {sourceImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {sourceImages.map((img, index) => (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded-md border border-[hsl(var(--border))]"
            >
              <img
                src={img}
                alt={`Reference ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeSourceImage(index)}
                className={cn(
                  'absolute right-1 top-1 rounded-full bg-black/60 p-0.5',
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  'hover:bg-black/80'
                )}
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAddMore && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-4 transition-colors',
            isDragOver
              ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]/50'
              : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
          )}
        >
          {sourceImages.length === 0 ? (
            <Upload className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ImagePlus className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          )}
          <div className="text-center">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {sourceImages.length === 0
                ? 'Drop images here or click to upload'
                : 'Add more images'}
            </p>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]/60">
              {sourceImages.length}/{MAX_IMAGES} images
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
