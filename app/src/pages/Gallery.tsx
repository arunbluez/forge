export default function Gallery() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Gallery</h2>

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] py-20">
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          No images generated yet
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Head to the Studio to create your first image.
        </p>
      </div>
    </div>
  );
}
