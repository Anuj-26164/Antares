import { useState } from 'react';
import { motion } from 'framer-motion';
import BorderGlow from '../common/BorderGlow.jsx';
import useMediaInteractionStore from '../../store/mediaInteractionStore.js';

export default function MediaCard({ media, onFavourite, onClick }) {
  const [thumbError, setThumbError] = useState(false);

  // Read from the optimistic interaction store, fall back to media props
  const interactionData = useMediaInteractionStore((state) => state.byId[media._id]);

  const isFavourited = (interactionData && typeof interactionData.favourited === 'boolean')
    ? interactionData.favourited
    : (media.isFavourited || false);

  const likeCount = interactionData
    ? interactionData.favouriteCount
    : (Array.isArray(media.favouritedBy)
        ? media.favouritedBy.length
        : (media.favouriteCount ?? 0));

  const commentCount = interactionData?.comments?.length > 0
    ? interactionData.comments.length
    : (Array.isArray(media.comments) ? media.comments.length : 0);

  const type = media.type || 'photo';
  const videoThumbSrc = media.thumbnailUrl || `/api/media/${media._id}/thumbnail`;

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
        className="rounded-[36px] overflow-hidden bg-ink cursor-pointer relative group"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={() => onClick?.(media)}
      >
        {/* Thumbnail */}
        <div className="aspect-[4/3] overflow-hidden relative bg-graphite/30">
          {type === 'video' ? (
            thumbError ? (
              <div className="w-full h-full flex items-center justify-center bg-graphite/50" />
            ) : (
              <img
                src={videoThumbSrc}
                alt={media.title || 'Video'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={() => setThumbError(true)}
              />
            )
          ) : (
            <img
              src={`/api/media/${media._id}/serve`}
              alt={media.title || 'Media'}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}

          {/* Video play icon overlay */}
          {type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          )}

          {/* Hover overlay with like + comment counts */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-start p-3 gap-3">
            <span className="flex items-center gap-1 text-white text-[13px] font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavourited ? 'white' : 'none'} stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {likeCount}
            </span>
            <span className="flex items-center gap-1 text-white text-[13px] font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {commentCount}
            </span>
          </div>
        </div>
      </motion.div>
    </BorderGlow>
  );
}
