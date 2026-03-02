import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGenerationStore } from '@/stores/generationStore';
import { useServerStore } from '@/stores/serverStore';
import { ForgeApiClient } from '@/lib/api/client';
import type { GalleryEntry } from '@/lib/api/types';

export default function RecentStrip() {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const setFinalImage = useGenerationStore((s) => s.setFinalImage);
  const setPreviewImage = useGenerationStore((s) => s.setPreviewImage);

  const { data: recentImages = [] } = useQuery<GalleryEntry[]>({
    queryKey: ['gallery', 'recent'],
    queryFn: async () => {
      const client = new ForgeApiClient(serverUrl);
      return client.getGallery(1, 8);
    },
    refetchInterval: 60_000,
  });

  if (recentImages.length === 0) {
    return null;
  }

  const handleClick = (entry: GalleryEntry) => {
    const client = new ForgeApiClient(serverUrl);
    const imageUrl = client.getGalleryImageUrl(entry.image_path);
    setPreviewImage(null);
    setFinalImage(imageUrl);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Recent</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recentImages.map((entry) => {
          const client = new ForgeApiClient(serverUrl);
          const thumbUrl = client.getGalleryImageUrl(entry.image_path);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => handleClick(entry)}
              title={entry.prompt}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[hsl(var(--border))]',
                'transition-all hover:border-[hsl(var(--ring))] hover:opacity-90',
                'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]'
              )}
            >
              <img
                src={thumbUrl}
                alt={entry.prompt}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
