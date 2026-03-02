export default function ModelManager() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Manage your AI models</h2>

      {/* Placeholder model list */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[hsl(var(--border))] p-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Models will appear here once the backend is connected.
          </p>
        </div>
      </div>
    </div>
  );
}
