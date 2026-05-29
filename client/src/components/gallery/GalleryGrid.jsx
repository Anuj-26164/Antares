import MediaCard from './MediaCard.jsx';
import EmptyState from '../common/EmptyState.jsx';
import Button from '../common/Button.jsx';
import useMediaInteractionStore from '../../store/mediaInteractionStore.js';

export default function GalleryGrid({ items, onFavourite, onCardClick, loading, error, onRetry }) {
  const toggleFavourite = useMediaInteractionStore((state) => state.toggleFavourite);

  const handleFavourite = async (mediaId) => {
    try {
      await toggleFavourite(mediaId);
    } catch {
      // Store handles rollback internally
    }
    // Also notify parent if it needs to sync its own state
    onFavourite?.(mediaId);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-red-500 text-[14px] mb-4">{error}</p>
        <Button variant="outline" size="md" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!loading && (!items || items.length === 0)) {
    return <EmptyState message="No media found" />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => (
        <MediaCard
          key={item._id}
          media={item}
          onFavourite={handleFavourite}
          onClick={onCardClick}
        />
      ))}
    </div>
  );
}
