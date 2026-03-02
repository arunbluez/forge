import { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { GalleryEntry } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';

// ---- Date grouping helpers ----

interface DateGroup {
  label: string;
  entries: GalleryEntry[];
}

function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  // Start of this week (Monday)
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfToday.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);

  // Start of this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  if (date >= startOfWeek) return 'This Week';
  if (date >= startOfMonth) return 'This Month';
  return 'Older';
}

function groupEntriesByDate(entries: GalleryEntry[]): DateGroup[] {
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  const groupMap = new Map<string, GalleryEntry[]>();

  for (const entry of entries) {
    const label = getDateGroupLabel(entry.created_at);
    const group = groupMap.get(label);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(label, [entry]);
    }
  }

  const result: DateGroup[] = [];
  for (const label of groupOrder) {
    const entries = groupMap.get(label);
    if (entries && entries.length > 0) {
      result.push({ label, entries });
    }
  }

  return result;
}

// ---- Lazy thumbnail component ----

function LazyThumbnail({
  entry,
  imageUrl,
  isSelected,
  onClick,
}: {
  entry: GalleryEntry;
  imageUrl: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const ioEntry of entries) {
        if (ioEntry.isIntersecting && imgRef.current) {
          const img = imgRef.current.querySelector('img');
          if (img && img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          observerRef.current?.unobserve(ioEntry.target);
        }
      }
    },
    []
  );

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
      threshold: 0,
    });
    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersect]);

  return (
    <div
      ref={imgRef}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'group relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all',
        isSelected
          ? 'border-[hsl(var(--ring))] ring-2 ring-[hsl(var(--ring))]'
          : 'border-transparent hover:border-[hsl(var(--border))]'
      )}
    >
      <img
        data-src={imageUrl}
        alt={entry.prompt || 'Generated image'}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
      />
      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/10" />
    </div>
  );
}

// ---- Main grid component ----

interface GalleryGridProps {
  entries: GalleryEntry[];
  selectedId: string | null;
  onSelect: (entry: GalleryEntry) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
}

export default function GalleryGrid({
  entries,
  selectedId,
  onSelect,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: GalleryGridProps) {
  const serverUrl = useServerStore((s) => s.serverUrl);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: observe sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '400px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  const groups = groupEntriesByDate(entries);

  function getImageUrl(entry: GalleryEntry): string {
    return `${serverUrl}/api/v1/gallery/${entry.id}/image`;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            {group.label}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {group.entries.map((entry) => (
              <LazyThumbnail
                key={entry.id}
                entry={entry}
                imageUrl={getImageUrl(entry)}
                isSelected={entry.id === selectedId}
                onClick={() => onSelect(entry)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          {isLoadingMore && (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--muted-foreground))] border-t-transparent" />
          )}
        </div>
      )}
    </div>
  );
}
