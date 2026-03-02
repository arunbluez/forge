import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Images, Wand2 } from 'lucide-react';
import { ForgeApiClient } from '@/lib/api/client';
import type { GalleryEntry } from '@/lib/api/types';
import { useServerStore } from '@/stores/serverStore';
import GallerySearch from '@/components/gallery/GallerySearch';
import GalleryGrid from '@/components/gallery/GalleryGrid';
import GalleryDetail from '@/components/gallery/GalleryDetail';

const PAGE_SIZE = 30;

export default function Gallery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<GalleryEntry | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const serverUrl = useServerStore((s) => s.serverUrl);

  const apiClient = useMemo(() => new ForgeApiClient(serverUrl), [serverUrl]);

  // ---- Paginated gallery query (when not searching) ----
  const galleryQuery = useInfiniteQuery({
    queryKey: ['gallery'],
    queryFn: async ({ pageParam = 1 }) => {
      const entries = await apiClient.getGallery(pageParam, PAGE_SIZE);
      return entries;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    enabled: !searchQuery,
  });

  // ---- Search query (when searching) ----
  const searchResultsQuery = useQuery({
    queryKey: ['gallery', 'search', searchQuery],
    queryFn: () => apiClient.searchGallery(searchQuery),
    enabled: !!searchQuery,
  });

  // ---- Delete mutation ----
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteGalleryEntry(id),
    onMutate: async (id) => {
      // Optimistic update: remove from cache
      await queryClient.cancelQueries({ queryKey: ['gallery'] });

      // Update infinite query cache
      queryClient.setQueryData<typeof galleryQuery.data>(
        ['gallery'],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.filter((entry) => entry.id !== id)
            ),
          };
        }
      );

      // Update search cache if active
      if (searchQuery) {
        queryClient.setQueryData<GalleryEntry[]>(
          ['gallery', 'search', searchQuery],
          (old) => old?.filter((entry) => entry.id !== id)
        );
      }
    },
    onSuccess: () => {
      setSelectedEntry(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  // ---- Derived data ----
  const isSearching = !!searchQuery;
  const isLoading = isSearching ? searchResultsQuery.isLoading : galleryQuery.isLoading;
  const isError = isSearching ? searchResultsQuery.isError : galleryQuery.isError;
  const error = isSearching ? searchResultsQuery.error : galleryQuery.error;

  const entries: GalleryEntry[] = useMemo(() => {
    if (isSearching) {
      return searchResultsQuery.data ?? [];
    }
    return galleryQuery.data?.pages.flat() ?? [];
  }, [isSearching, searchResultsQuery.data, galleryQuery.data]);

  const hasMore = !isSearching && !!galleryQuery.hasNextPage;
  const isLoadingMore = galleryQuery.isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (galleryQuery.hasNextPage && !galleryQuery.isFetchingNextPage) {
      galleryQuery.fetchNextPage();
    }
  }, [galleryQuery]);

  function handleSelect(entry: GalleryEntry) {
    setSelectedEntry(entry);
  }

  function handleCloseDetail() {
    setSelectedEntry(null);
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  // ---- Render ----

  // Empty state
  const isEmpty = !isLoading && !isError && entries.length === 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Gallery</h2>
        <GallerySearch
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-72"
        />
        {entries.length > 0 && (
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
            {entries.length} image{entries.length !== 1 ? 's' : ''}
            {isSearching && ' found'}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--muted-foreground))] border-t-transparent" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Loading gallery...
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-[hsl(var(--destructive))]">
              Failed to load gallery
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </p>
            <button
              onClick={() => {
                if (isSearching) {
                  searchResultsQuery.refetch();
                } else {
                  galleryQuery.refetch();
                }
              }}
              className="mt-2 rounded-md bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--secondary-foreground))] transition-colors hover:bg-[hsl(var(--secondary))]/80"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isSearching && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[hsl(var(--border))] py-20">
          <Images className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            No images generated yet
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Head to the Studio to create your first image.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition-colors hover:bg-[hsl(var(--primary))]/90"
          >
            <Wand2 className="h-4 w-4" />
            Go to Studio
          </button>
        </div>
      )}

      {/* Empty search results */}
      {isEmpty && isSearching && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] py-20">
          <Images className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            No images match your search
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Try a different search term or clear the search.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && entries.length > 0 && (
        <GalleryGrid
          entries={entries}
          selectedId={selectedEntry?.id ?? null}
          onSelect={handleSelect}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
        />
      )}

      {/* Detail panel */}
      {selectedEntry && (
        <GalleryDetail
          entry={selectedEntry}
          onClose={handleCloseDetail}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
