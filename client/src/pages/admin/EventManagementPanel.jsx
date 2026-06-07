import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../utils/api.js';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';

export default function EventManagementPanel() {
  const navigate = useNavigate();
  const coverInputRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', date: '', isPublic: true, coverImage: '' });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  // Upload-request review modal
  const [requestsEvent, setRequestsEvent] = useState(null); // event being reviewed
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState('');

  const [customTag, setCustomTag] = useState('');

  const PRESET_TAGS = ['Music', 'Workshop', 'Hackathon', 'Photography', 'Sports', 'Cultural', 'Tech Talk', 'Social', 'Competition', 'Seminar'];

  const handleTagSelect = (tag) => {
    setForm({ ...form, category: tag });
  };

  const handleCustomTagAdd = () => {
    const trimmed = customTag.trim();
    if (trimmed) {
      setForm({ ...form, category: trimmed });
      setCustomTag('');
    }
  };

  const handleCustomTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomTagAdd();
    }
  };

  const handleAiDescription = async (mode) => {
    setAiError('');
    if (mode === 'generate' && !form.title.trim()) {
      setAiError('Add a title first so the AI has something to work with.');
      return;
    }
    if (mode === 'improve' && !form.description.trim()) {
      setAiError('There’s no description to improve yet.');
      return;
    }
    setAiBusy(true);
    try {
      const res = await api.post('/events/ai/description', {
        mode,
        title: form.title,
        description: form.description,
        category: form.category,
        date: form.date,
      });
      const next = res.data?.data?.description;
      if (next) {
        setForm((prev) => ({ ...prev, description: next }));
      } else {
        setAiError('AI returned no text. Please try again.');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        (err.response?.status === 503
          ? 'AI is not configured on the server.'
          : 'AI request failed. Please try again.');
      setAiError(msg);
    } finally {
      setAiBusy(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/events');
      const response = res.data.data;
      setEvents(Array.isArray(response) ? response : response.events || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const filtered = events.filter((e) => {
    const matchesSearch =
      !search ||
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase());
    const matchesVisibility =
      !visibilityFilter ||
      (visibilityFilter === 'public' && e.isPublic) ||
      (visibilityFilter === 'private' && !e.isPublic);
    return matchesSearch && matchesVisibility;
  });

  const openCreate = () => {
    setEditingEvent(null);
    setForm({ title: '', description: '', category: '', date: '', isPublic: true, coverImage: '' });
    setCoverFile(null);
    setCoverPreview('');
    setAiError('');
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      category: event.category || '',
      date: event.date ? event.date.slice(0, 10) : '',
      isPublic: event.isPublic !== false,
      coverImage: event.coverImage || '',
    });
    setCoverFile(null);
    setCoverPreview(event.coverImage || '');
    setAiError('');
    setModalOpen(true);
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let eventId;

      if (editingEvent) {
        // Update existing event (without cover — cover is handled separately)
        const { coverImage, ...payload } = form;
        await api.put(`/events/${editingEvent._id}`, payload);
        eventId = editingEvent._id;
      } else {
        // Create new event (without cover)
        const { coverImage, ...payload } = form;
        const createRes = await api.post('/events', payload);
        eventId = createRes.data.data._id;
      }

      // Upload cover image via dedicated endpoint if a new file was selected
      if (coverFile && eventId) {
        const coverForm = new FormData();
        coverForm.append('avatar', coverFile);
        await api.post(`/events/${eventId}/cover`, coverForm);
      }

      setModalOpen(false);
      setCoverFile(null);
      setCoverPreview('');
      fetchEvents();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/events/${id}`);
      setConfirmDelete(null);
      fetchEvents();
    } catch {
      // silently fail
    }
  };

  // ── Upload-request review ──────────────────────────────────────────────
  const openRequests = async (event) => {
    setRequestsEvent(event);
    setRequestsLoading(true);
    setRequestsError('');
    try {
      const res = await api.get(`/events/${event._id}/upload-requests`);
      setRequests(res.data?.data || []);
    } catch (err) {
      setRequestsError(err.response?.data?.error || 'Failed to load requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  const closeRequests = () => {
    setRequestsEvent(null);
    setRequests([]);
    setRequestsError('');
  };

  const decideRequest = async (userId, status) => {
    try {
      await api.patch(
        `/events/${requestsEvent._id}/upload-requests/${userId}`,
        { status }
      );
      // Refresh in place.
      const res = await api.get(`/events/${requestsEvent._id}/upload-requests`);
      setRequests(res.data?.data || []);
    } catch (err) {
      setRequestsError(err.response?.data?.error || 'Failed to update request');
    }
  };

  const revokeRequest = async (userId) => {
    try {
      await api.delete(
        `/events/${requestsEvent._id}/upload-requests/${userId}`
      );
      const res = await api.get(`/events/${requestsEvent._id}/upload-requests`);
      setRequests(res.data?.data || []);
    } catch (err) {
      setRequestsError(err.response?.data?.error || 'Failed to revoke');
    }
  };

  if (loading) {
    return <SkeletonTable rows={6} cols={5} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-[14px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow placeholder:text-steel outline-none focus:border-steel transition-colors w-[240px]"
        />
        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value)}
          className="rounded-[14px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none cursor-pointer"
        >
          <option value="">All visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <button
          onClick={openCreate}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-[0_0_16px_rgba(96,165,250,0.25)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create Event
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[20px] border border-gray-200 dark:border-graphite">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-graphite bg-gray-50 dark:bg-ink/60">
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Creator</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Media</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((event) => (
              <tr
                key={event._id}
                className="border-b border-gray-100 dark:border-graphite/40 hover:bg-gray-50 dark:hover:bg-graphite/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/media?event=${event._id}`)}
              >
                <td className="px-4 py-3 text-[13px] text-ink dark:text-snow font-medium">
                  {event.title}
                </td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">
                  {event.date ? new Date(event.date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{event.category || '—'}</td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{event.createdBy?.name || '—'}</td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{event.mediaCount || 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    event.isPublic
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${event.isPublic ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {event.isPublic ? 'Public' : 'Private'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/admin/media?event=${event._id}`)}
                      className="px-2.5 py-1 rounded-[8px] text-ash text-[12px] font-medium hover:text-snow hover:bg-graphite/50 active:scale-95 transition-all"
                    >
                      Media
                    </button>
                    <button
                      onClick={() => openRequests(event)}
                      className="px-2.5 py-1 rounded-[8px] text-ash text-[12px] font-medium hover:text-snow hover:bg-graphite/50 active:scale-95 transition-all"
                    >
                      Requests
                    </button>
                    <button
                      onClick={() => openEdit(event)}
                      className="px-2.5 py-1 rounded-[8px] text-brand text-[12px] font-medium hover:text-snow hover:bg-brand/15 active:scale-95 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(event._id)}
                      className="px-2.5 py-1 rounded-[8px] text-red-400 text-[12px] font-medium hover:text-red-300 hover:bg-red-500/10 active:scale-95 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-steel dark:text-ash text-[13px]">
                  No events found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-[500px] max-h-[92vh] flex flex-col bg-ink border border-graphite/60 rounded-[28px] shadow-2xl overflow-hidden">

            {/* ── Modal header with gradient accent ── */}
            <div className="shrink-0 relative overflow-hidden px-6 pt-6 pb-5 border-b border-graphite/40">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/8 via-transparent to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
                  {editingEvent ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-snow text-[17px] font-semibold leading-tight">
                    {editingEvent ? 'Edit Event' : 'Create Event'}
                  </h3>
                  <p className="text-ash text-[12px] mt-0.5">
                    {editingEvent ? 'Update event details below' : 'Fill in the details to publish a new event'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto brand-scrollbar px-6 py-5 space-y-5">

              {/* Title */}
              <div>
                <label className="block text-[12px] font-semibold text-ash uppercase tracking-wider mb-1.5">
                  Event Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Hackathon 2025"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-[14px] bg-obsidian border border-graphite px-4 py-3 text-[14px] text-snow placeholder:text-steel/60 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-ash uppercase tracking-wider">
                    Description
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAiDescription('generate')}
                      disabled={aiBusy || !form.title.trim()}
                      title={!form.title.trim() ? 'Add a title first' : 'Generate with AI'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-[11px] font-medium hover:bg-brand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {aiBusy ? (
                        <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
                        </svg>
                      )}
                      {aiBusy ? 'Working…' : 'AI Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAiDescription('improve')}
                      disabled={aiBusy || !form.description.trim()}
                      title={!form.description.trim() ? 'Write something first' : 'Improve with AI'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-graphite/40 border border-graphite/60 text-ash text-[11px] font-medium hover:text-snow hover:border-ash/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                      </svg>
                      {aiBusy ? 'Working…' : 'Improve'}
                    </button>
                  </div>
                </div>
                <textarea
                  placeholder="Describe what this event is about…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-[14px] bg-obsidian border border-graphite px-4 py-3 text-[14px] leading-relaxed text-snow placeholder:text-steel/60 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all resize-y h-[140px] min-h-[100px] max-h-[300px]"
                />
                {aiError && (
                  <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {aiError}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-[12px] font-semibold text-ash uppercase tracking-wider mb-2">
                  Category
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagSelect(tag)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 border cursor-pointer ${
                        form.category === tag
                          ? 'bg-brand/20 border-brand/50 text-brand shadow-[0_0_10px_rgba(96,165,250,0.2)]'
                          : 'bg-obsidian border-graphite/50 text-ash hover:border-brand/30 hover:text-snow'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Or type a custom category…"
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleCustomTagKeyDown}
                    className="flex-1 rounded-full bg-obsidian border border-graphite px-4 py-2 text-[13px] text-snow placeholder:text-steel/60 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleCustomTagAdd}
                    disabled={!customTag.trim()}
                    className="shrink-0 px-4 py-2 rounded-full bg-brand/15 border border-brand/30 text-brand text-[12px] font-semibold hover:bg-brand/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {form.category && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] text-steel uppercase tracking-wider">Selected:</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/15 border border-brand/35 text-brand text-[12px] font-semibold">
                      {form.category}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, category: '' })}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-brand/30 transition-colors"
                      >
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-[12px] font-semibold text-ash uppercase tracking-wider mb-2">
                  Event Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text" inputMode="numeric" placeholder="DD" maxLength={2}
                    value={form.date ? form.date.split('-')[2] || '' : ''}
                    onChange={(e) => {
                      const day = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const parts = (form.date || '--').split('-');
                      setForm({ ...form, date: `${parts[0]||''}-${parts[1]||''}-${day}` });
                    }}
                    className="w-[54px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] font-medium text-snow placeholder:text-steel/40 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all"
                  />
                  <span className="text-graphite/70 text-xl font-light">/</span>
                  <input
                    type="text" inputMode="numeric" placeholder="MM" maxLength={2}
                    value={form.date ? form.date.split('-')[1] || '' : ''}
                    onChange={(e) => {
                      const month = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const parts = (form.date || '--').split('-');
                      setForm({ ...form, date: `${parts[0]||''}-${month}-${parts[2]||''}` });
                    }}
                    className="w-[54px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] font-medium text-snow placeholder:text-steel/40 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all"
                  />
                  <span className="text-graphite/70 text-xl font-light">/</span>
                  <input
                    type="text" inputMode="numeric" placeholder="YYYY" maxLength={4}
                    value={form.date ? form.date.split('-')[0] || '' : ''}
                    onChange={(e) => {
                      const year = e.target.value.replace(/\D/g, '').slice(0, 4);
                      const parts = (form.date || '--').split('-');
                      setForm({ ...form, date: `${year}-${parts[1]||''}-${parts[2]||''}` });
                    }}
                    className="w-[76px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] font-medium text-snow placeholder:text-steel/40 outline-none focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-transparent transition-all"
                  />
                  <label className="relative cursor-pointer ml-1">
                    <input
                      type="date"
                      value={form.date && /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date : ''}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-10 h-10 rounded-[12px] bg-brand/10 border border-brand/30 flex items-center justify-center hover:bg-brand/20 transition-colors">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                  </label>
                </div>
                {form.date && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !isNaN(new Date(form.date).getTime()) && (
                  <p className="text-[12px] text-brand/80 mt-2 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {new Date(form.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-[12px] font-semibold text-ash uppercase tracking-wider mb-2">
                  Cover Image
                </label>
                <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                {coverPreview ? (
                  <div className="relative rounded-[16px] overflow-hidden aspect-[16/7] bg-graphite/30 group">
                    <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-[12px] font-medium hover:bg-white/30 transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCoverFile(null); setCoverPreview(''); setForm({ ...form, coverImage: '' }); }}
                        className="px-3 py-1.5 rounded-full bg-red-500/80 backdrop-blur-sm border border-red-400/50 text-white text-[12px] font-medium hover:bg-red-500 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="group w-full rounded-[16px] border-2 border-dashed border-graphite/60 hover:border-brand/50 hover:bg-brand/5 transition-all py-8 flex flex-col items-center gap-2.5 text-ash hover:text-snow"
                  >
                    <div className="w-11 h-11 rounded-[14px] bg-graphite/40 group-hover:bg-brand/15 border border-graphite/60 group-hover:border-brand/30 flex items-center justify-center transition-all">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                    <span className="text-[13px] font-medium">Click to upload cover image</span>
                    <span className="text-[11px] opacity-50">JPEG, PNG, WebP — max 25 MB</span>
                  </button>
                )}
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between rounded-[16px] bg-obsidian border border-graphite/60 px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-snow">Public Event</p>
                  <p className="text-[11px] text-ash mt-0.5">
                    {form.isPublic ? 'Anyone can view this event and its media' : 'Only admins can view this event'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isPublic: !form.isPublic })}
                  className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-obsidian ${
                    form.isPublic ? 'bg-brand' : 'bg-graphite'
                  }`}
                  role="switch"
                  aria-checked={form.isPublic}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      form.isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>

            {/* ── Modal footer ── */}
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-graphite/40 bg-ink">
              <p className="text-[11px] text-steel">
                {editingEvent ? 'Changes save immediately' : 'Event will be published right away'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-[12px] text-ash text-[13px] font-medium hover:text-snow hover:bg-graphite/40 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="inline-flex items-center justify-center gap-2 min-w-[90px] px-5 py-2 rounded-[12px] bg-brand text-obsidian text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Saving…
                    </>
                  ) : (
                    editingEvent ? 'Save Changes' : 'Create Event'
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-md">
          <div className="w-full max-w-[360px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[28px] p-6 mx-4 shadow-xl">
            <h3 className="text-ink dark:text-snow text-[16px] font-semibold mb-2">Delete Event</h3>
            <p className="text-steel dark:text-ash text-[13px] mb-6">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-[12px] text-ash text-[13px] font-medium hover:text-snow hover:bg-graphite/40 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-[12px] bg-red-600 text-white text-[13px] font-semibold hover:bg-red-500 active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload requests review modal */}
      {requestsEvent && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
          <div className="w-full max-w-[560px] max-h-[85vh] flex flex-col bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[28px] shadow-xl overflow-hidden">
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-graphite/40">
              <h3 className="text-ink dark:text-snow text-[18px] font-semibold">
                Upload requests
              </h3>
              <p className="text-steel dark:text-ash text-[13px] mt-1 truncate">
                {requestsEvent.title}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {requestsError && (
                <p className="text-[13px] text-red-400 mb-3">{requestsError}</p>
              )}

              {requestsLoading ? (
                <p className="text-steel dark:text-ash text-[13px] py-6 text-center">
                  Loading…
                </p>
              ) : requests.length === 0 ? (
                <p className="text-steel dark:text-ash text-[13px] py-6 text-center">
                  No upload requests yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {requests.map((r) => {
                    const u = r.userId || {};
                    const statusColor = {
                      pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                      denied:   'bg-red-500/15 text-red-400 border-red-500/30',
                      revoked:  'bg-graphite/40 text-ash border-graphite/50',
                    }[r.status] || 'bg-graphite/40 text-ash border-graphite/50';

                    return (
                      <li
                        key={r._id}
                        className="rounded-[16px] border border-gray-200 dark:border-graphite/60 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {u.avatar && (
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-8 h-8 rounded-full object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-ink dark:text-snow truncate">
                                {u.name || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-steel dark:text-ash truncate">
                                {u.email || '—'}
                              </p>
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColor}`}>
                            {r.status}
                          </span>
                        </div>

                        {r.message && (
                          <p className="text-[12px] text-steel dark:text-ash italic">
                            "{r.message}"
                          </p>
                        )}

                        <div className="flex justify-end gap-1.5 mt-1">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => decideRequest(u._id, 'denied')}
                                className="px-3 py-1.5 rounded-full text-[12px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 active:scale-95 transition-all"
                              >
                                Deny
                              </button>
                              <button
                                onClick={() => decideRequest(u._id, 'approved')}
                                className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 hover:border-brand/50 active:scale-95 transition-all"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <button
                              onClick={() => revokeRequest(u._id)}
                              className="px-3 py-1.5 rounded-full text-[12px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 active:scale-95 transition-all"
                            >
                              Revoke
                            </button>
                          )}
                          {r.status === 'denied' && (
                            <button
                              onClick={() => decideRequest(u._id, 'approved')}
                              className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 hover:border-brand/50 active:scale-95 transition-all"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-graphite/40 bg-white dark:bg-ink">
              <button
                onClick={closeRequests}
                className="px-4 py-2 rounded-[12px] text-ash text-[13px] font-medium hover:text-snow hover:bg-graphite/40 active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
