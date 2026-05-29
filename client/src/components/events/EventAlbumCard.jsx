import { motion } from 'framer-motion';
import Badge from '../common/Badge.jsx';
import BorderGlow from '../common/BorderGlow.jsx';

export default function EventAlbumCard({ event, onClick }) {
  const coverImage = event.coverImage || '/placeholder-event.jpg';
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <BorderGlow
      borderRadius={36}
      glowIntensity={0.5}
      colors={['#60A5FA', '#3b82f6', '#60A5FA']}
      backgroundColor="#18181b"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="rounded-[36px] overflow-hidden bg-snow dark:bg-ink cursor-pointer relative group"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={() => onClick?.(event)}
      >
        {/* Cover image */}
        <div className="aspect-[16/10] overflow-hidden relative">
          <img
            src={coverImage}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-obsidian/20 to-transparent" />

          {/* Category badge */}
          {event.category && (
            <div className="absolute top-4 left-4">
              <Badge label={event.category} variant="ember" />
            </div>
          )}

          {/* Media count badges */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {(event.photoCount > 0 || (!event.photoCount && !event.videoCount)) && (
              <span className="inline-flex items-center gap-1 rounded-[12px] px-3 py-1 text-[10px] font-medium bg-obsidian/70 text-snow backdrop-blur-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {event.photoCount || event.mediaCount || 0}
              </span>
            )}
            {event.videoCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-[12px] px-3 py-1 text-[10px] font-medium bg-obsidian/70 text-snow backdrop-blur-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                {event.videoCount}
              </span>
            )}
          </div>

          {/* Title + date + tags overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-snow text-[16px] font-semibold leading-tight truncate">
              {event.title}
            </h3>
            {formattedDate && (
              <p className="text-snow/70 text-[12px] mt-1">{formattedDate}</p>
            )}
            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {event.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-white/10 backdrop-blur-sm px-2.5 py-0.5 text-[11px] text-snow/90 font-medium"
                  >
                    {tag}
                  </span>
                ))}
                {event.tags.length > 3 && (
                  <span className="inline-block rounded-full bg-white/10 backdrop-blur-sm px-2.5 py-0.5 text-[11px] text-snow/70 font-medium">
                    +{event.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </BorderGlow>
  );
}
