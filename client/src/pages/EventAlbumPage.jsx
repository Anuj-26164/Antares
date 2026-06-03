import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../utils/api.js';
import useAuthStore from '../store/authStore.js';
import { subscribeToEventRoom } from '../sockets/mediaSocket.js';
import GalleryGrid from '../components/gallery/GalleryGrid.jsx';
import MediaModal from '../components/gallery/MediaModal.jsx';
import UploadZone from '../components/gallery/UploadZone.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import BackButton from '../components/common/BackButton.jsx';
import BrandLink from '../components/common/BrandLink.jsx';

export default function EventAlbumPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [event, setEvent] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaTotalPages, setMediaTotalPages] = useState(1);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { allowed, reason, grantStatus }
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    fetchEventAlbum();
  }, [id, mediaPage]);

  // Fetch the user's upload eligibility once the user and event are known.
  useEffect(() => {
    if (!user || !id) {
      setUploadStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/events/${id}/upload-status`);
        if (!cancelled) setUploadStatus(res.data?.data || null);
      } catch {
        if (!cancelled) setUploadStatus(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user, id]);

  async function submitUploadRequest() {
    setSubmittingRequest(true);
    setRequestError('');
    try {
      await api.post(`/events/${id}/upload-requests`, { message: requestMessage });
      // Refresh status; will land in pending state.
      const res = await api.get(`/events/${id}/upload-status`);
      setUploadStatus(res.data?.data || null);
      setShowRequestForm(false);
      setRequestMessage('');
    } catch (err) {
      setRequestError(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmittingRequest(false);
    }
  }

  // Subscribe to the event room for realtime media updates; unsubscribe on unmount or eventId change
  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToEventRoom(id);
    return () => {
      unsubscribe();
    };
  }, [id]);

  async function fetchEventAlbum() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/events/public/${id}`, { params: { page: mediaPage, limit: 20 } });
      const data = response.data.data;
      setEvent(data.event);
      setMedia(data.media || []);
      setMediaTotalPages(data.mediaTotalPages || 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }

  const formattedDate = event?.date
    ? new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-obsidian">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-6 pt-4">
        <BackButton fallback="/events" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-fog dark:border-graphite border-t-obsidian dark:border-t-snow rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-red-500 text-[14px] mb-4">{error}</p>
          <Button variant="outline" size="md" onClick={() => navigate('/events')}>
            Back to Events
          </Button>
        </div>
      )}

      {/* Event content */}
      {event && !loading && !error && (
        <>
          {/* Hero header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative w-full h-[320px] overflow-hidden"
          >
            {event.coverImage ? (
              <img
                src={event.coverImage}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-graphite dark:bg-ink" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/80 via-obsidian/30 to-transparent" />

            {/* Event info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto">
              <div className="flex items-center gap-3 mb-3">
                {event.category && <Badge label={event.category} variant="ember" />}
                {formattedDate && (
                  <span className="text-snow/70 text-[12px]">{formattedDate}</span>
                )}
              </div>
              <h1 className="text-snow text-[28px] font-bold leading-tight">
                {event.title}
              </h1>
            </div>
          </motion.div>

          {/* Expandable description — below hero, outside the fixed-height overlay */}
          {event.description && (
            <div className="max-w-7xl mx-auto px-6 mt-4">
              <div className="relative">
                <motion.div
                  initial={false}
                  animate={{ height: descExpanded ? 'auto' : '3.6em' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <p className="text-snow/70 text-[14px] leading-[1.8]">
                    {event.description}
                  </p>
                </motion.div>
                {event.description.length > 150 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-brand text-[12px] font-medium mt-1.5 hover:underline transition-colors"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Login CTA for anonymous users */}
          {!user && (
            <div className="max-w-7xl mx-auto px-6 mt-6">
              <div className="rounded-[28px] bg-white/60 dark:bg-ink/60 backdrop-blur-[12px] border border-fog dark:border-graphite px-6 py-4 flex items-center justify-between">
                <p className="text-[14px] text-ink dark:text-snow">
                  Sign in to like, comment, and download media.
                </p>
                <Button variant="filled" size="sm" pill onClick={() => navigate('/login')}>
                  Login to interact
                </Button>
              </div>
            </div>
          )}

          {/* Upload zone for authorized roles or approved requesters */}
          {user && uploadStatus?.allowed && (
            <div className="max-w-7xl mx-auto px-6 mt-6">
              <UploadZone eventId={id} onUploadComplete={fetchEventAlbum} />
            </div>
          )}

          {/* Request upload access — for users without an existing role grant */}
          {user && uploadStatus && !uploadStatus.allowed && (
            <div className="max-w-7xl mx-auto px-6 mt-6">
              <div className="rounded-[28px] bg-white/60 dark:bg-ink/60 backdrop-blur-[12px] border border-fog dark:border-graphite px-6 py-4">
                {uploadStatus.grantStatus === 'pending' && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[14px] text-ink dark:text-snow">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2 align-middle" />
                      Your upload request is pending review.
                    </p>
                  </div>
                )}

                {uploadStatus.grantStatus === 'denied' && !showRequestForm && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[14px] text-ink dark:text-snow">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-2 align-middle" />
                      Your previous request was declined.
                    </p>
                    <Button variant="outline" size="sm" pill onClick={() => setShowRequestForm(true)}>
                      Try again
                    </Button>
                  </div>
                )}

                {uploadStatus.grantStatus === 'revoked' && !showRequestForm && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[14px] text-ink dark:text-snow">
                      Your upload access was revoked.
                    </p>
                    <Button variant="outline" size="sm" pill onClick={() => setShowRequestForm(true)}>
                      Request again
                    </Button>
                  </div>
                )}

                {(uploadStatus.grantStatus === null || uploadStatus.grantStatus === undefined) && !showRequestForm && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[14px] text-ink dark:text-snow">
                      Want to add photos to this event? Request upload access from an admin.
                    </p>
                    <Button variant="filled" size="sm" pill onClick={() => setShowRequestForm(true)}>
                      Request upload access
                    </Button>
                  </div>
                )}

                {showRequestForm && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[13px] text-steel dark:text-ash">
                      Add an optional note for the organiser (e.g. which photos you plan to share).
                    </p>
                    <textarea
                      value={requestMessage}
                      onChange={(e) => setRequestMessage(e.target.value)}
                      placeholder="Optional message…"
                      maxLength={500}
                      className="w-full rounded-[14px] bg-gray-50 dark:bg-obsidian border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow placeholder:text-steel outline-none resize-none h-[80px]"
                    />
                    {requestError && (
                      <p className="text-[12px] text-red-400">{requestError}</p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        pill
                        onClick={() => { setShowRequestForm(false); setRequestError(''); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="filled"
                        size="sm"
                        pill
                        disabled={submittingRequest}
                        onClick={submitUploadRequest}
                      >
                        {submittingRequest ? 'Submitting…' : 'Submit request'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media grid */}
          <div className="max-w-7xl mx-auto px-6 py-8">
            <GalleryGrid
              items={media}
              loading={loading}
              error={null}
              onFavourite={(id) => {
                setMedia(prev => prev.map(m =>
                  m._id === id ? { ...m, isFavourited: !m.isFavourited } : m
                ));
              }}
              onCardClick={(mediaItem) => setSelectedMedia(mediaItem)}
              onRetry={fetchEventAlbum}
            />

            {/* Media pagination */}
            {mediaTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  pill
                  disabled={mediaPage <= 1}
                  onClick={() => setMediaPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-[13px] text-ash dark:text-ash">
                  Page {mediaPage} of {mediaTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  pill
                  disabled={mediaPage >= mediaTotalPages}
                  onClick={() => setMediaPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Media modal */}
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onFavourite={(id) => {
            setMedia(prev => prev.map(m =>
              m._id === id ? { ...m, isFavourited: !m.isFavourited } : m
            ));
          }}
        />
      )}
    </div>
  );
}
