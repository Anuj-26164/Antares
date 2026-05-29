import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api.js';
import { SkeletonCard } from '../components/common/Skeleton.jsx';
import EventAlbumCard from '../components/events/EventAlbumCard.jsx';
import FilterBar from '../components/events/FilterBar.jsx';
import Button from '../components/common/Button.jsx';
import BackButton from '../components/common/BackButton.jsx';
import BrandLink from '../components/common/BrandLink.jsx';

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('date-desc');
  const navigate = useNavigate();

  // Client-side filtering: category AND tags
  const filteredEvents = useMemo(() => {
    let result = events.filter((event) => {
      // Category filter
      if (selectedCategory && event.category !== selectedCategory) {
        return false;
      }
      // Tags filter: event must contain at least one of the selected tags
      if (selectedTags.length > 0) {
        const eventTags = Array.isArray(event.tags) ? event.tags : [];
        const hasMatchingTag = selectedTags.some((tag) => eventTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.date || 0) - new Date(b.date || 0);
        case 'date-desc':
          return new Date(b.date || 0) - new Date(a.date || 0);
        case 'name-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'name-desc':
          return (b.title || '').localeCompare(a.title || '');
        default:
          return 0;
      }
    });

    return result;
  }, [events, selectedCategory, selectedTags, sortBy]);

  useEffect(() => {
    fetchPublicEvents();
  }, [page]);

  async function fetchPublicEvents() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/events/public', { params: { page, limit: 12 } });
      const data = response.data.data;
      setEvents(data.events || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  function handleCardClick(event) {
    navigate(`/events/${event._id}`);
  }

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Page content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <BackButton fallback="/" />
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <h1 className="text-[32px] font-bold text-ink dark:text-snow">Events</h1>
          <p className="text-[14px] text-ash dark:text-ash mt-2">
            Browse our collection of event albums and relive the moments.
          </p>
        </motion.div>

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-red-500 text-[14px] mb-4">{error}</p>
            <Button variant="outline" size="md" onClick={fetchPublicEvents}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0,1,2,3,4,5].map((i) => <SkeletonCard key={i} className="min-h-[240px]" />)}
          </div>
        )}

        {/* Filter bar */}
        {!loading && !error && events.length > 0 && (
          <FilterBar
            events={events}
            selectedCategory={selectedCategory}
            selectedTags={selectedTags}
            onCategoryChange={setSelectedCategory}
            onTagsChange={setSelectedTags}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        )}

        {/* Empty state */}
        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-ash text-[14px]">No events to show yet.</p>
          </div>
        )}

        {/* No results after filtering */}
        {!loading && !error && events.length > 0 && filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-ash text-[14px]">No events match the selected filters.</p>
          </div>
        )}

        {/* Events grid */}
        {!loading && !error && filteredEvents.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={event._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <EventAlbumCard event={event} onClick={handleCardClick} />
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  pill
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-[13px] text-ash dark:text-ash">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  pill
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
