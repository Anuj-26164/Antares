import { useMemo } from 'react';

/**
 * FilterBar component for filtering events by category and tags, and sorting.
 *
 * Props:
 * - events: Event[] — full events list for extracting filter options
 * - selectedCategory: string | null
 * - selectedTags: string[]
 * - onCategoryChange: (category: string | null) => void
 * - onTagsChange: (tags: string[]) => void
 * - sortBy: string
 * - onSortChange: (sort: string) => void
 */
export default function FilterBar({
  events = [],
  selectedCategory,
  selectedTags = [],
  onCategoryChange,
  onTagsChange,
  sortBy = 'date-desc',
  onSortChange,
}) {
  // Extract distinct categories from events
  const categories = useMemo(() => {
    const cats = new Set();
    events.forEach((event) => {
      if (event.category && event.category.trim()) {
        cats.add(event.category.trim());
      }
    });
    return Array.from(cats).sort();
  }, [events]);

  // Extract distinct tags from all events
  const allTags = useMemo(() => {
    const tagSet = new Set();
    events.forEach((event) => {
      if (Array.isArray(event.tags)) {
        event.tags.forEach((tag) => {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [events]);

  function handleCategoryChange(e) {
    const value = e.target.value;
    onCategoryChange(value === '' ? null : value);
  }

  function handleTagToggle(tag) {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Category dropdown + Sort dropdown */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedCategory || ''}
          onChange={handleCategoryChange}
          className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2 text-[13px] text-ink dark:text-snow outline-none focus:ring-2 focus:ring-ember/30 transition-colors"
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value)}
          className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2 text-[13px] text-ink dark:text-snow outline-none focus:ring-2 focus:ring-ember/30 transition-colors"
          aria-label="Sort events"
        >
          <option value="date-desc">Date: Newest first</option>
          <option value="date-asc">Date: Oldest first</option>
          <option value="name-asc">Name: A → Z</option>
          <option value="name-desc">Name: Z → A</option>
        </select>
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {allTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={`rounded-[12px] px-3 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-ember text-snow border-ember'
                    : 'bg-snow dark:bg-ink text-ash dark:text-ash border-fog dark:border-graphite hover:border-ember/50'
                }`}
                aria-pressed={isSelected}
                aria-label={`Filter by tag: ${tag}`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
