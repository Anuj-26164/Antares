import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../utils/api.js';
import useAuthStore from '../store/authStore.js';
import GalleryGrid from '../components/gallery/GalleryGrid.jsx';
import MediaModal from '../components/gallery/MediaModal.jsx';

export default function GalleryPage() {
  const user = useAuthStore((state) => state.user);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [sortBy, setSortBy] = useState('uploadDate');
  const sentinelRef = useRef(null);

  const fetchMedia = useCallback(async (pageNum, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const res = await api.get('/media', {
        params: { page: pageNum, limit: 24, sortBy, sortOrder: 'desc' },
      });
      const data = res.data.data;
      const items = data.items || [];

      if (reset) {
        setMedia(items);
      } else {
        setMedia((prev) => [...prev, ...items]);
      }
      setHasMore(data.hasMore ?? items.length === 24);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load media');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sortBy]);

  // Initial load and sort change
  useEffect(() => {
    setPage(1);
    fetchMedia(1, true);
  }, [fetchMedia]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchMedia(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchMedia]);

  const handleFavourite = (id) => {
    setMedia((prev) =>
      prev.map((m) =>
        m._id === id ? { ...m, isFavourited: !m.isFavourited } : m
      )
    );
  };

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-snow text-[28px] font-bold">Gallery</h1>
          <p className="text-ash text-[14px] mt-1">All media across events</p>
        </motion.div>

        {/* Sort controls */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-[14px] bg-ink border border-graphite px-4 py-2.5 text-[14px] text-snow outline-none cursor-pointer focus:border-brand/50 transition-colors"
          >
            <option value="uploadDate">Newest first</option>
            <option value="likes">Most liked</option>
          </select>
          <span className="text-ash text-[13px]">
            {media.length} item{media.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Gallery grid */}
        <GalleryGrid
          items={media}
          loading={loading}
          error={error}
          onFavourite={handleFavourite}
          onCardClick={(mediaItem) => setSelectedMedia(mediaItem)}
          onRetry={() => { setPage(1); fetchMedia(1, true); }}
        />

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-graphite border-t-snow rounded-full animate-spin" />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && !loading && <div ref={sentinelRef} className="h-4" />}

        {/* End of content */}
        {!hasMore && media.length > 0 && (
          <p className="text-center text-ash text-[13px] py-8">You've seen it all</p>
        )}
      </div>

      {/* Media modal */}
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onFavourite={handleFavourite}
        />
      )}
    </div>
  );
}
