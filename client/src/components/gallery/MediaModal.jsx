import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useMediaStore from '../../store/mediaStore.js';
import useAuthStore from '../../store/authStore.js';
import useMediaInteractionStore from '../../store/mediaInteractionStore.js';
import api from '../../utils/api.js';
import { relativeTime } from '../../utils/formatters.js';
import VideoPlayer from './VideoPlayer.jsx';

export default function MediaModal({ media, onClose, onFavourite }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [localComments, setLocalComments] = useState([]);
  const [likeLoading, setLikeLoading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadMenuPos, setDownloadMenuPos] = useState({ top: 0, left: 0 });
  const downloadBtnRef = useRef(null);

  // Tag state
  const [tagOpen, setTagOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [tagSelected, setTagSelected] = useState([]);
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagSuccess, setTagSuccess] = useState(false);
  const tagSearchRef = useRef(null);
  const tagDebounceRef = useRef(null);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const navigate = useNavigate();

  // Read from the optimistic interaction store
  const interactionData = useMediaInteractionStore((state) => state.byId[media?._id]);
  const toggleFavourite = useMediaInteractionStore((state) => state.toggleFavourite);
  const addCommentToStore = useMediaInteractionStore((state) => state.addComment);

  // Seed the interaction store on mount so like state is correct even on
  // first open (before any toggle has been made by this session).
  useEffect(() => {
    if (!media?._id) return;
    const existing = useMediaInteractionStore.getState().byId[media._id];
    // Only seed when there is no entry yet — don't overwrite a live optimistic state
    if (existing && typeof existing.favourited === 'boolean') return;

    const favBy = Array.isArray(media?.favouritedBy) ? media.favouritedBy : [];
    const userId = user?._id?.toString();
    const seedFavourited = userId && favBy.length > 0
      ? favBy.some(id => (id?._id || id)?.toString() === userId)
      : (media?.isFavourited || false);
    const seedCount = favBy.length || media?.likes || 0;

    useMediaInteractionStore.setState((state) => ({
      byId: {
        ...state.byId,
        [media._id]: {
          favourited: seedFavourited,
          favouriteCount: seedCount,
          comments: existing?.comments ?? [],
        },
      },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?._id]);

  // Derive like state: prefer interaction store (when known), fall back to media props
  const liked = (interactionData && typeof interactionData.favourited === 'boolean')
    ? interactionData.favourited
    : (() => {
        const favBy = Array.isArray(media?.favouritedBy) ? media.favouritedBy : [];
        const userId = user?._id?.toString();
        if (userId && favBy.length > 0) {
          const inFavBy = favBy.some(id => (id?._id || id)?.toString() === userId);
          if (inFavBy) return true;
        }
        return media?.isFavourited || false;
      })();

  const likeCount = interactionData
    ? interactionData.favouriteCount
    : (() => {
        const favBy = Array.isArray(media?.favouritedBy) ? media.favouritedBy : [];
        return favBy.length || media?.likes || 0;
      })();

  // Derive comments: merge store comments with locally fetched ones
  // Store comments take precedence (optimistic + socket updates)
  // but we always show localComments as the base hydration
  const storeComments = interactionData?.comments ?? [];
  const comments = (storeComments.length > 0 ? storeComments : localComments).filter(Boolean);

  useEffect(() => {
    if (!media?._id) return;

    // Fetch comments from API to hydrate local state
    setLoadingComments(true);
    api.get(`/media/${media._id}/comments`)
      .then((res) => setLocalComments(res.data.data || []))
      .catch(() => setLocalComments([]))
      .finally(() => setLoadingComments(false));
  }, [media?._id]);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const close = () => setDownloadMenuOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', close); };
  }, [downloadMenuOpen]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const handleLike = async () => {
    if (!isAuthenticated) { onClose?.(); navigate('/login'); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      await toggleFavourite(media._id, { favourited: liked, favouriteCount: likeCount });
      onFavourite?.(media._id);
    } catch {
      // Store handles rollback internally
    } finally {
      setLikeLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) { onClose?.(); navigate('/login'); return; }
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      // Seed the store with existing comments before optimistic update
      // so the store list is complete, not just the new comment
      const currentStore = useMediaInteractionStore.getState().byId[media._id];
      if (!currentStore?.comments?.length && localComments.length > 0) {
        useMediaInteractionStore.setState((state) => ({
          byId: {
            ...state.byId,
            [media._id]: {
              favourited: currentStore?.favourited ?? false,
              favouriteCount: currentStore?.favouriteCount ?? likeCount,
              comments: localComments,
            },
          },
        }));
      }
      await addCommentToStore(media._id, comment);
      setComment('');
    } catch {
      // Store handles rollback internally
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (withWatermark = true) => {
    if (!isAuthenticated) { onClose?.(); navigate('/login'); return; }
    try {
      const url = withWatermark
        ? `/media/${media._id}/download`
        : `/media/${media._id}/download?watermark=false`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = res.data;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      // Try to get filename from Content-Disposition header
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="([^"]+)"/);
      link.download = match ? match[1] : `media-${media._id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert('Download failed. Please try again.');
    }
  };

  // Helper to get comment display name
  const getCommentUserName = (c) => {
    if (c.user?.name) return c.user.name;
    if (c.userId?.name) return c.userId.name;
    return 'User';
  };

  // Tag handlers
  const handleTagQueryChange = (e) => {
    const q = e.target.value;
    setTagQuery(q);
    clearTimeout(tagDebounceRef.current);
    if (q.trim().length < 2) { setTagResults([]); return; }
    tagDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/search', { params: { q: q.trim() } });
        setTagResults(res.data.data || []);
      } catch { setTagResults([]); }
    }, 300);
  };

  const handleTagSelect = (u) => {
    if (!tagSelected.find((s) => s._id === u._id)) {
      setTagSelected((prev) => [...prev, u]);
    }
    setTagQuery('');
    setTagResults([]);
    tagSearchRef.current?.focus();
  };

  const handleTagRemove = (id) => {
    setTagSelected((prev) => prev.filter((u) => u._id !== id));
  };

  const handleTagSubmit = async () => {
    if (!tagSelected.length || tagSubmitting) return;
    setTagSubmitting(true);
    try {
      await api.post(`/media/${media._id}/tag`, { userIds: tagSelected.map((u) => u._id) });
      setTagSuccess(true);
      setTagSelected([]);
      // Re-fetch comments so the auto-generated tag comment appears
      api.get(`/media/${media._id}/comments`)
        .then((res) => {
          const fresh = res.data.data || [];
          setLocalComments(fresh);
          // Also update the interaction store so the tag comment is visible
          // even when storeComments is being used as the primary source
          useMediaInteractionStore.setState((state) => {
            const existing = state.byId[media._id];
            return {
              byId: {
                ...state.byId,
                [media._id]: {
                  favourited: existing?.favourited ?? false,
                  favouriteCount: existing?.favouriteCount ?? likeCount,
                  comments: fresh,
                },
              },
            };
          });
        })
        .catch(() => {});
      setTimeout(() => { setTagSuccess(false); setTagOpen(false); }, 1500);
    } catch {
      // silently fail
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/gallery?media=${media._id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: media.title || 'Media', url });
      } else {
        await navigator.clipboard.writeText(url);
        // Brief visual feedback — could be improved with a toast
        alert('Link copied to clipboard!');
      }
    } catch {
      // User cancelled share or clipboard failed
    }
  };

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="bg-ink border border-graphite rounded-[28px] w-full max-w-[960px] max-h-[90vh] overflow-hidden flex flex-col lg:flex-row"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media display */}
          <div className="flex-1 bg-obsidian flex items-center justify-center min-h-[300px] relative">
            {media.type === 'video' ? (
              <div className="w-full h-full min-h-[300px] max-h-[70vh]">
                <VideoPlayer
                  src={media.accessUrl || `${import.meta.env.VITE_API_URL || ''}/api/media/${media._id}/serve`}
                  poster={media.thumbnailUrl || undefined}
                  onDownload={() => handleDownload(true)}
                  onFavourite={handleLike}
                  onShare={handleShare}
                  liked={liked}
                  likeCount={likeCount}
                />
              </div>
            ) : (
              <img
                src={media.accessUrl || `${import.meta.env.VITE_API_URL || ''}/api/media/${media._id}/serve`}
                alt={media.title || 'Media'}
                className="w-full h-full object-contain max-h-[70vh]"
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            )}
            {/* Close button on media */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-20"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[320px] flex flex-col border-l border-graphite">
            {/* Header */}
            <div className="px-5 py-4 border-b border-graphite">
              {media.title && (
                <h3 className="text-snow text-[16px] font-semibold truncate">
                  {media.title}
                </h3>
              )}
              {media.uploadedBy?.name && (
                <p className="text-ash text-[12px] mt-0.5">
                  Uploaded by {media.uploadedBy.name}
                  {media.createdAt && (
                    <>
                      {' · '}
                      <span title={new Date(media.createdAt).toLocaleString()}>
                        {relativeTime(media.createdAt)}
                      </span>
                    </>
                  )}
                </p>
              )}
              {media.caption && (
                <p className="text-snow/85 text-[13px] mt-2.5 leading-relaxed whitespace-pre-line">
                  {media.caption}
                </p>
              )}
              {Array.isArray(media.tags) && media.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {media.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/30 text-brand text-[10px] font-medium tracking-wide capitalize"
                      title="Auto-generated tag"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-b border-graphite flex items-center gap-4 overflow-visible">
              {/* Like button with count */}
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className={`flex items-center gap-1.5 text-[15px] font-semibold transition-all duration-200 cursor-pointer ${
                  liked ? 'text-red-400' : 'text-ash hover:text-red-400'
                }`}
                title={!isAuthenticated ? 'Sign in to like' : ''}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{likeCount}</span>
              </button>

              {/* Comment count */}
              <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ash">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>{comments.length}</span>
              </span>

              {/* Tag people button */}
              {isAuthenticated && (
                <button
                  onClick={() => { setTagOpen((p) => !p); setTagQuery(''); setTagResults([]); setTagSuccess(false); }}
                  className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-pointer ${tagOpen ? 'text-brand' : 'text-ash hover:text-brand'}`}
                  title="Tag people"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  Tag
                </button>
              )}

              {/* Download button — admin gets dropdown, others get single button */}
              {user?.role === 'admin' ? (
                <div className="ml-auto">
                  <button
                    ref={downloadBtnRef}
                    onClick={() => {
                      if (!downloadMenuOpen && downloadBtnRef.current) {
                        const rect = downloadBtnRef.current.getBoundingClientRect();
                        setDownloadMenuPos({
                          top: rect.bottom + 6,
                          left: rect.right - 200,
                        });
                      }
                      setDownloadMenuOpen(prev => !prev);
                    }}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-ash hover:text-brand transition-colors cursor-pointer"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: downloadMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDownload(true)}
                  className="ml-auto flex items-center gap-1.5 text-[13px] font-medium text-ash hover:text-brand transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
              )}
            </div>

            {/* Tag panel */}
            {tagOpen && isAuthenticated && (
              <div className="px-5 py-3 border-b border-graphite bg-obsidian/40">
                {tagSuccess ? (
                  <p className="text-green-400 text-[13px] text-center py-1">Tagged successfully!</p>
                ) : (
                  <>
                    {/* Selected tags */}
                    {tagSelected.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tagSelected.map((u) => (
                          <span key={u._id} className="flex items-center gap-1 bg-brand/20 text-brand text-[12px] px-2 py-0.5 rounded-full">
                            {u.name}
                            <button onClick={() => handleTagRemove(u._id)} className="hover:text-red-400 transition-colors ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Search input */}
                    <input
                      ref={tagSearchRef}
                      type="text"
                      placeholder="Search by name or email..."
                      value={tagQuery}
                      onChange={handleTagQueryChange}
                      className="w-full bg-obsidian border border-graphite rounded-[10px] px-3 py-1.5 text-[13px] text-snow placeholder:text-steel outline-none focus:border-brand/50 transition-colors"
                      autoFocus
                    />
                    {/* Results */}
                    {tagResults.length > 0 && (
                      <div className="mt-1.5 rounded-[10px] border border-graphite overflow-hidden">
                        {tagResults.map((u) => (
                          <button
                            key={u._id}
                            onClick={() => handleTagSelect(u)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-graphite overflow-hidden shrink-0">
                              {u.avatar
                                ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                : <span className="w-full h-full flex items-center justify-center text-[10px] text-ash">{u.name?.[0]?.toUpperCase()}</span>
                              }
                            </div>
                            <div>
                              <p className="text-snow text-[12px] font-medium">{u.name}</p>
                              <p className="text-ash text-[11px]">{u.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Submit */}
                    {tagSelected.length > 0 && (
                      <button
                        onClick={handleTagSubmit}
                        disabled={tagSubmitting}
                        className="mt-2 w-full py-1.5 rounded-[10px] bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        {tagSubmitting ? 'Tagging...' : `Tag ${tagSelected.length} ${tagSelected.length === 1 ? 'person' : 'people'}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[11px] text-ash font-semibold uppercase tracking-wider mb-3">
                Comments {comments.length > 0 && `(${comments.length})`}
              </p>
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-graphite border-t-brand rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-ash text-[13px]">No comments yet. Be the first!</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comments.filter(Boolean).map((c, i) => (
                    <div key={c._id || i} className={`bg-obsidian/60 rounded-[12px] px-3 py-2.5 ${c.pending ? 'opacity-60' : ''}`}>
                      <p className="text-[12px] font-semibold text-snow">
                        {getCommentUserName(c)}
                      </p>
                      <p className="text-[13px] text-ash mt-0.5 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add comment */}
            <div className="px-5 py-4 border-t border-graphite">
              {isAuthenticated ? (
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="flex-1 bg-obsidian border border-graphite rounded-full px-4 py-2 text-[13px] text-snow placeholder:text-steel outline-none focus:border-brand/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !comment.trim()}
                    className="px-4 py-2 rounded-full bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? '...' : 'Post'}
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => { onClose?.(); navigate('/login'); }}
                  className="w-full py-2 rounded-full border border-graphite text-ash text-[13px] hover:text-brand hover:border-brand/50 transition-colors"
                >
                  Sign in to like, comment & download
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    {/* Download dropdown — rendered via portal to escape all stacking contexts */}
    {downloadMenuOpen && user?.role === 'admin' && createPortal(
      <div
        className="fixed w-[200px] rounded-[14px] overflow-hidden"
        style={{
          top: downloadMenuPos.top,
          left: Math.max(8, downloadMenuPos.left),
          zIndex: 999999,
          background: '#18181b',
          border: '1px solid rgba(96,165,250,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}
      >
        <button
          onClick={() => { setDownloadMenuOpen(false); handleDownload(true); }}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-ash hover:text-snow hover:bg-white/5 transition-colors text-left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          With Watermark
        </button>
        <div className="h-px bg-graphite/50 mx-3" />
        <button
          onClick={() => { setDownloadMenuOpen(false); handleDownload(false); }}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] text-brand hover:text-snow hover:bg-white/5 transition-colors text-left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Original (No Watermark)
        </button>
      </div>,
      document.body
    )}
    </>
  );
}
