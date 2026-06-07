import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../utils/api.js';
import { SkeletonMediaCard } from '../../components/common/Skeleton.jsx';

/** Extract a short display name from an R2 key or URL */
function getMediaName(item) {
  const key = item.r2Key || item.url || '';
  const filename = key.split('/').pop() || '';
  // Strip UUID prefix (36 chars + optional dot) and extension
  const withoutUUID = filename.replace(/^[0-9a-f-]{36}\.?/i, '');
  const withoutExt = withoutUUID.replace(/\.[^.]+$/, '');
  if (withoutExt) return withoutExt;
  // Fallback: show type + short date
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return `${item.type === 'video' ? 'Video' : 'Photo'}${date ? ` · ${date}` : ''}`;
}

/** Format a date string concisely */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MediaManagementPanel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [media, setMedia] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [eventFilter, setEventFilter] = useState(() => searchParams.get('event') || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [selected, setSelected] = useState([]);
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadEventId, setUploadEventId] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadPreviews, setUploadPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLightbox, setUploadLightbox] = useState(null);
  const uploadInputRef = useRef(null);

  // Sync filter if query param changes (e.g. browser back/forward)
  useEffect(() => {
    const paramEvent = searchParams.get('event') || '';
    setEventFilter(paramEvent);
  }, [searchParams]);

  useEffect(() => {
    fetchMedia();
    fetchEvents();
  }, []);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media');
      const response = res.data.data;
      setMedia(Array.isArray(response) ? response : response.items || []);
    } catch (err) {
      console.error('Failed to load media:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      const response = res.data.data;
      setEvents(Array.isArray(response) ? response : response.events || []);
    } catch {
      // silently fail
    }
  };

  /** Resolve event name — handles populated object, ID string, or nested _id */
  const getEventName = (item) => {
    // Populated eventId object (from the API populate)
    if (item.eventId?.title) return item.eventId.title;
    // Legacy: populated event field
    if (item.event?.title) return item.event.title;
    // Raw ID string — look up from events list
    const rawId = typeof item.eventId === 'string' ? item.eventId
      : typeof item.event === 'string' ? item.event
      : item.eventId?._id || item.event?._id || null;
    if (rawId && events.length > 0) {
      const found = events.find((ev) => ev._id === rawId);
      if (found) return found.title;
    }
    return null;
  };

  /** Upload media to a specific event */
  const handleUpload = async () => {
    if (!uploadEventId || uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      uploadFiles.forEach((file) => formData.append('files', file));
      await api.post(`/media/upload/${uploadEventId}`, formData, {
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
      });
      uploadPreviews.forEach(p => URL.revokeObjectURL(p.preview));
      setUploadModalOpen(false);
      setUploadFiles([]);
      setUploadPreviews([]);
      setUploadEventId('');
      setUploadProgress(0);
      fetchMedia();
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  const filtered = media.filter((m) => {
    const matchesEvent = !eventFilter || m.event === eventFilter || m.event?._id === eventFilter || m.eventId === eventFilter || m.eventId?._id === eventFilter;
    const matchesType = !typeFilter || m.type === typeFilter;
    const matchesVisibility =
      !visibilityFilter ||
      (visibilityFilter === 'public' && m.isPublic) ||
      (visibilityFilter === 'private' && !m.isPublic);
    return matchesEvent && matchesType && matchesVisibility;
  });

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selected.length === filtered.length) {
      setSelected([]);
    } else {
      setSelected(filtered.map((m) => m._id));
    }
  };

  const handleBulkAction = async (action) => {
    try {
      if (action === 'delete') {
        await Promise.all(selected.map((id) => api.delete(`/media/${id}`)));
      } else if (action === 'public') {
        await Promise.all(selected.map((id) => api.patch(`/media/${id}`, { isPublic: true })));
      } else if (action === 'private') {
        await Promise.all(selected.map((id) => api.patch(`/media/${id}`, { isPublic: false })));
      }
      setSelected([]);
      setConfirmBulk(null);
      fetchMedia();
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[0,1,2,3,4,5,6,7].map((i) => <SkeletonMediaCard key={i} />)}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Breadcrumb — shown when filtered by a specific event */}
      {eventFilter && events.length > 0 && (() => {
        const activeEvent = events.find((ev) => ev._id === eventFilter);
        return activeEvent ? (
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => navigate('/admin/events')}
              className="text-ash text-[13px] hover:text-snow transition-colors"
            >
              Events
            </button>
            <span className="text-graphite text-[13px]">/</span>
            <span className="text-snow text-[13px] font-medium">{activeEvent.title}</span>
            <button
              onClick={() => {
                setEventFilter('');
                navigate('/admin/media');
              }}
              className="ml-2 text-ash text-[11px] hover:text-snow transition-colors underline underline-offset-2"
            >
              Clear filter
            </button>
          </div>
        ) : null;
      })()}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={eventFilter}
          onChange={(e) => {
            const val = e.target.value;
            setEventFilter(val);
            // Keep URL in sync so browser back works correctly
            if (val) {
              navigate(`/admin/media?event=${val}`, { replace: true });
            } else {
              navigate('/admin/media', { replace: true });
            }
          }}
          className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none cursor-pointer"
        >
          <option value="">All events</option>
          {events.map((ev) => (
            <option key={ev._id} value={ev._id}>{ev.title}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none cursor-pointer"
        >
          <option value="">All types</option>
          <option value="photo">Photo</option>
          <option value="video">Video</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
          className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none cursor-pointer"
        >
          <option value="">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>

        <span className="text-steel dark:text-ash text-[13px] ml-1">
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>

        {/* Upload button */}
        <button
          onClick={() => {
            setUploadEventId(eventFilter || '');
            setUploadFiles([]);
            setUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-[0_0_16px_rgba(96,165,250,0.25)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Upload Media
        </button>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-snow dark:bg-ink border border-fog dark:border-graphite rounded-[14px] p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-fog dark:bg-graphite text-ink dark:text-snow' : 'text-steel dark:text-ash hover:text-snow hover:bg-graphite/30'}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all active:scale-95 ${viewMode === 'table' ? 'bg-fog dark:bg-graphite text-ink dark:text-snow' : 'text-steel dark:text-ash hover:text-snow hover:bg-graphite/30'}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[14px]">
          <span className="text-ink dark:text-snow text-[13px] font-medium">{selected.length} selected</span>
          <button
            onClick={() => setConfirmBulk('delete')}
            className="px-3 py-1.5 rounded-[8px] bg-red-600 text-white text-[12px] font-semibold hover:bg-red-500 active:scale-95 transition-all"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmBulk('public')}
            className="px-3 py-1.5 rounded-[8px] bg-graphite/60 text-snow text-[12px] font-medium hover:bg-graphite active:scale-95 transition-all"
          >
            Make Public
          </button>
          <button
            onClick={() => setConfirmBulk('private')}
            className="px-3 py-1.5 rounded-[8px] bg-graphite/60 text-snow text-[12px] font-medium hover:bg-graphite active:scale-95 transition-all"
          >
            Make Private
          </button>
          <button
            onClick={() => setSelected([])}
            className="ml-auto px-3 py-1.5 rounded-[8px] text-ash text-[12px] font-medium hover:text-snow hover:bg-graphite/40 active:scale-95 transition-all"
          >
            Clear
          </button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-steel dark:text-ash text-[14px]">No media found</p>
          <p className="text-ash text-[12px] mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const isSelected = selected.includes(item._id);
            const isVideo = item.type === 'video';
            const displayName = getMediaName(item);
            const uploaderName = item.uploadedBy?.name || 'Admin Upload';
            const eventName = getEventName(item);

            return (
              <div
                key={item._id}
                onClick={() => toggleSelect(item._id)}
                className={`relative rounded-[20px] overflow-hidden bg-white dark:bg-ink cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'ring-2 ring-ember ring-offset-2 ring-offset-white dark:ring-offset-obsidian'
                    : 'border border-gray-200 dark:border-graphite hover:border-gray-400 dark:hover:border-ash'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-graphite/30 relative">
                  <img
                    src={item.thumbnailUrl || (isVideo ? `/api/media/${item._id}/thumbnail` : item.url)}
                    alt={displayName}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selection checkbox overlay */}
                <div className="absolute top-2 left-2">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-ember border-ember' : 'bg-black/40 dark:bg-obsidian/60 border-white/60'
                  }`}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Info footer */}
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-ink dark:text-snow text-[12px] font-medium truncate flex-1">{uploaderName}</p>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      item.isPublic
                        ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}>
                      {item.isPublic ? '● Public' : '○ Private'}
                    </span>
                  </div>
                  {eventName && (
                    <p className="text-steel dark:text-ash text-[11px] truncate">{eventName}</p>
                  )}
                  <p className="text-steel/60 dark:text-graphite text-[10px] mt-0.5">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-[20px] border border-gray-200 dark:border-graphite">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-graphite bg-gray-50 dark:bg-ink/60">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer accent-ember"
                  />
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Preview</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Uploader</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isVideo = item.type === 'video';
                const eventName = getEventName(item) || '—';
                const uploaderName = item.uploadedBy?.name || '—';

                return (
                  <tr
                    key={item._id}
                    className={`border-b border-gray-100 dark:border-graphite/40 transition-colors ${
                      selected.includes(item._id) ? 'bg-ember/5' : 'hover:bg-gray-50 dark:hover:bg-graphite/20'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(item._id)}
                        onChange={() => toggleSelect(item._id)}
                        className="w-4 h-4 rounded cursor-pointer accent-ember"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <img
                        src={item.thumbnailUrl || (isVideo ? `/api/media/${item._id}/thumbnail` : item.url)}
                        alt=""
                        className="w-12 h-9 rounded-[8px] object-cover"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isVideo
                          ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                          : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {isVideo ? 'Video' : 'Photo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink dark:text-snow">{uploaderName}</td>
                    <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{eventName}</td>
                    <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        item.isPublic
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isPublic ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {item.isPublic ? 'Public' : 'Private'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload media modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-[480px] bg-ink border border-graphite rounded-[28px] p-6 mx-4 shadow-xl">
            <h3 className="text-snow text-[18px] font-semibold mb-4">Upload Media</h3>
            <div className="flex flex-col gap-4">
              {/* Event selector */}
              <div>
                <p className="text-[13px] font-medium text-ash mb-2">Select Event</p>
                <select
                  value={uploadEventId}
                  onChange={(e) => setUploadEventId(e.target.value)}
                  className="w-full rounded-[14px] bg-obsidian border border-graphite px-4 py-2.5 text-[14px] text-snow outline-none focus:border-brand/50 transition-colors cursor-pointer"
                >
                  <option value="">Choose an event...</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>{ev.title}</option>
                  ))}
                </select>
              </div>

              {/* File picker */}
              <div>
                <p className="text-[13px] font-medium text-ash mb-2">Files</p>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  multiple
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files);
                    setUploadFiles((prev) => [...prev, ...newFiles]);
                    const newPreviews = newFiles.map(f => ({
                      name: f.name,
                      size: f.size,
                      isVideo: f.type.startsWith('video/'),
                      preview: URL.createObjectURL(f),
                    }));
                    setUploadPreviews(prev => [...prev, ...newPreviews]);
                  }}
                  className="hidden"
                />
                {uploadFiles.length > 0 ? (
                  <div className="rounded-[14px] border border-graphite bg-obsidian/60 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-snow text-[13px] font-medium">{uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => uploadInputRef.current?.click()} className="text-brand text-[12px] font-medium hover:underline">Add more</button>
                        <button type="button" onClick={() => { setUploadFiles([]); setUploadPreviews([]); }} className="text-red-400 text-[12px] hover:underline">Clear</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {uploadPreviews.map((p, i) => (
                        <div
                          key={i}
                          className="relative group rounded-[10px] overflow-hidden bg-graphite/30 aspect-square cursor-pointer"
                          onClick={() => setUploadLightbox(i)}
                        >
                          {p.isVideo ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                          ) : (
                            <img src={p.preview} alt={p.name} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                            <p className="text-white text-[9px] truncate w-full">{p.name}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              URL.revokeObjectURL(p.preview);
                              setUploadFiles(prev => prev.filter((_, idx) => idx !== i));
                              setUploadPreviews(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    className="w-full rounded-[14px] border-2 border-dashed border-graphite hover:border-brand/40 transition-colors py-8 flex flex-col items-center gap-2 text-ash"
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span className="text-[14px]">Click to select files</span>
                    <span className="text-[12px] text-steel">Photos & videos — multiple allowed</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { uploadPreviews.forEach(p => URL.revokeObjectURL(p.preview)); setUploadModalOpen(false); setUploadFiles([]); setUploadPreviews([]); }}
                className="px-4 py-2 rounded-[12px] text-ash text-[13px] font-medium hover:text-snow hover:bg-graphite/40 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadEventId || uploadFiles.length === 0}
                className="inline-flex items-center justify-center gap-2 min-w-[80px] px-5 py-2 rounded-[12px] bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? `${uploadProgress}%` : 'Upload'}
              </button>
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="w-full h-1.5 bg-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox for upload preview */}
      {uploadLightbox !== null && uploadPreviews[uploadLightbox] && (
        <div
          className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setUploadLightbox(null)}
        >
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" onClick={() => setUploadLightbox(null)}>×</button>
          {uploadPreviews.length > 1 && (
            <>
              <button className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setUploadLightbox(i => (i - 1 + uploadPreviews.length) % uploadPreviews.length); }}>‹</button>
              <button className="absolute right-16 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setUploadLightbox(i => (i + 1) % uploadPreviews.length); }}>›</button>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            {uploadPreviews[uploadLightbox].isVideo ? (
              <video src={uploadPreviews[uploadLightbox].preview} controls className="max-w-[90vw] max-h-[80vh] rounded-[16px]" />
            ) : (
              <img src={uploadPreviews[uploadLightbox].preview} alt="" className="max-w-[90vw] max-h-[80vh] rounded-[16px] object-contain" />
            )}
            <p className="text-white/60 text-[12px] text-center mt-2">{uploadPreviews[uploadLightbox].name}</p>
          </div>
        </div>
      )}

      {/* Bulk action confirmation modal */}
      {confirmBulk && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="w-full max-w-[360px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[28px] p-6 mx-4 shadow-xl">
            <h3 className="text-ink dark:text-snow text-[16px] font-semibold mb-2">Confirm Action</h3>
            <p className="text-steel dark:text-ash text-[13px] mb-6">
              {confirmBulk === 'delete'
                ? `Permanently delete ${selected.length} item${selected.length > 1 ? 's' : ''}? This cannot be undone.`
                : `Make ${selected.length} item${selected.length > 1 ? 's' : ''} ${confirmBulk}?`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBulk(null)}
                className="px-4 py-2 rounded-[12px] text-ash text-[13px] font-medium hover:text-snow hover:bg-graphite/40 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAction(confirmBulk)}
                className={`px-4 py-2 rounded-[12px] text-white text-[13px] font-semibold active:scale-95 transition-all ${
                  confirmBulk === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-brand text-obsidian hover:opacity-90'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

