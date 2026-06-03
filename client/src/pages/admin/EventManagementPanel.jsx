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
          className="ml-auto px-4 py-2.5 rounded-[14px] bg-ink dark:bg-snow text-snow dark:text-ink text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          + Create Event
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
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/admin/media?event=${event._id}`)}
                      className="text-steel dark:text-ash hover:text-ink dark:hover:text-snow text-[12px] transition-colors"
                    >
                      Media
                    </button>
                    <button
                      onClick={() => openRequests(event)}
                      className="text-steel dark:text-ash hover:text-ink dark:hover:text-snow text-[12px] transition-colors"
                    >
                      Requests
                    </button>
                    <button
                      onClick={() => openEdit(event)}
                      className="text-steel dark:text-ash hover:text-ink dark:hover:text-snow text-[12px] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(event._id)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-[12px] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-obsidian/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[480px] max-h-[90vh] flex flex-col bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[28px] shadow-xl overflow-hidden">
            <h3 className="shrink-0 text-ink dark:text-snow text-[18px] font-semibold px-6 pt-6 pb-4 border-b border-gray-100 dark:border-graphite/40">
              {editingEvent ? 'Edit Event' : 'Create Event'}
            </h3>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-[14px] bg-gray-50 dark:bg-obsidian border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow placeholder:text-steel outline-none"
              />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[13px] font-medium text-ash">Description</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAiDescription('generate')}
                      disabled={aiBusy || !form.title.trim()}
                      title={!form.title.trim() ? 'Add a title first' : 'Generate with AI'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-[11px] font-medium hover:bg-brand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
                      </svg>
                      {aiBusy ? 'Working…' : 'Generate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAiDescription('improve')}
                      disabled={aiBusy || !form.description.trim()}
                      title={!form.description.trim() ? 'Write something first' : 'Improve with AI'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-graphite/40 border border-graphite text-ash text-[11px] font-medium hover:text-snow hover:border-ash/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                      {aiBusy ? 'Working…' : 'Improve'}
                    </button>
                  </div>
                </div>
                <textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-[14px] bg-gray-50 dark:bg-obsidian border border-gray-200 dark:border-graphite px-4 py-3 text-[14px] leading-relaxed text-ink dark:text-snow placeholder:text-steel outline-none resize-y h-[220px] min-h-[160px] max-h-[420px]"
                />
                {aiError && (
                  <p className="mt-1.5 text-[12px] text-red-400">{aiError}</p>
                )}
              </div>
              {/* Category tag picker */}
              <div>
                <p className="text-[13px] font-medium text-ash mb-2">Category</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagSelect(tag)}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 border cursor-pointer ${
                        form.category === tag
                          ? 'bg-brand/20 border-brand/50 text-brand shadow-[0_0_8px_rgba(96,165,250,0.25)]'
                          : 'bg-obsidian/60 border-graphite/50 text-ash hover:border-brand/30 hover:text-snow'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {/* Custom tag input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add custom tag..."
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={handleCustomTagKeyDown}
                    className="flex-1 rounded-full bg-obsidian border border-graphite px-4 py-2 text-[13px] text-snow placeholder:text-steel outline-none focus:border-brand/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleCustomTagAdd}
                    disabled={!customTag.trim()}
                    className="px-4 py-2 rounded-full bg-brand/15 border border-brand/30 text-brand text-[13px] font-medium hover:bg-brand/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {/* Selected tag display */}
                {form.category && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] text-steel">Selected:</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/20 border border-brand/40 text-brand text-[13px] font-medium">
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
              {/* Date picker — dd-mm-yyyy */}
              <div>
                <p className="text-[13px] font-medium text-ash mb-2">Event Date</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD"
                    maxLength={2}
                    value={form.date ? form.date.split('-')[2] || '' : ''}
                    onChange={(e) => {
                      const day = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const parts = (form.date || '--').split('-');
                      const y = parts[0] || '';
                      const m = parts[1] || '';
                      const newDate = `${y}-${m}-${day}`;
                      setForm({ ...form, date: newDate });
                    }}
                    className="w-[52px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] text-snow placeholder:text-steel/50 outline-none focus:border-brand/50 transition-colors"
                  />
                  <span className="text-graphite text-lg">/</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM"
                    maxLength={2}
                    value={form.date ? form.date.split('-')[1] || '' : ''}
                    onChange={(e) => {
                      const month = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const parts = (form.date || '--').split('-');
                      const y = parts[0] || '';
                      const d = parts[2] || '';
                      const newDate = `${y}-${month}-${d}`;
                      setForm({ ...form, date: newDate });
                    }}
                    className="w-[52px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] text-snow placeholder:text-steel/50 outline-none focus:border-brand/50 transition-colors"
                  />
                  <span className="text-graphite text-lg">/</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY"
                    maxLength={4}
                    value={form.date ? form.date.split('-')[0] || '' : ''}
                    onChange={(e) => {
                      const year = e.target.value.replace(/\D/g, '').slice(0, 4);
                      const parts = (form.date || '--').split('-');
                      const m = parts[1] || '';
                      const d = parts[2] || '';
                      const newDate = `${year}-${m}-${d}`;
                      setForm({ ...form, date: newDate });
                    }}
                    className="w-[72px] text-center rounded-[12px] bg-obsidian border border-graphite px-2 py-2.5 text-[15px] text-snow placeholder:text-steel/50 outline-none focus:border-brand/50 transition-colors"
                  />
                  {/* Calendar icon button for native picker fallback */}
                  <label className="relative cursor-pointer">
                    <input
                      type="date"
                      value={form.date && /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date : ''}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-10 h-10 rounded-[12px] bg-brand/10 border border-brand/30 flex items-center justify-center hover:bg-brand/20 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                  </label>
                </div>
                {form.date && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !isNaN(new Date(form.date).getTime()) && (
                  <p className="text-[12px] text-ash mt-1.5">
                    {new Date(form.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Cover image upload */}
              <div>
                <p className="text-[12px] font-medium text-steel dark:text-ash mb-2">Cover Image</p>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
                {coverPreview ? (
                  <div className="relative rounded-[14px] overflow-hidden aspect-[16/7] bg-gray-100 dark:bg-graphite/30">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-[12px] font-medium"
                    >
                      Change image
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCoverFile(null); setCoverPreview(''); setForm({ ...form, coverImage: '' }); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full rounded-[14px] border-2 border-dashed border-gray-200 dark:border-graphite hover:border-steel dark:hover:border-ash transition-colors py-6 flex flex-col items-center gap-2 text-steel dark:text-ash"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span className="text-[13px]">Click to upload cover image</span>
                    <span className="text-[11px] opacity-60">JPEG, PNG, WebP — max 25 MB</span>
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2 text-[13px] text-steel dark:text-ash cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                  className="rounded accent-ember"
                />
                Public event
              </label>
              </div>
            </div>
            <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-graphite/40 bg-white dark:bg-ink">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-[14px] text-steel dark:text-ash text-[13px] hover:text-ink dark:hover:text-snow transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-[14px] bg-ink dark:bg-snow text-snow dark:text-ink text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-obsidian/60 backdrop-blur-sm">
          <div className="w-full max-w-[360px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite rounded-[28px] p-6 mx-4 shadow-xl">
            <h3 className="text-ink dark:text-snow text-[16px] font-semibold mb-2">Delete Event</h3>
            <p className="text-steel dark:text-ash text-[13px] mb-6">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-[14px] text-steel dark:text-ash text-[13px] hover:text-ink dark:hover:text-snow transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-[14px] bg-red-600 text-white text-[13px] font-medium hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload requests review modal */}
      {requestsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-obsidian/60 backdrop-blur-sm p-4">
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

                        <div className="flex justify-end gap-2 mt-1">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => decideRequest(u._id, 'denied')}
                                className="px-3 py-1.5 rounded-full text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                Deny
                              </button>
                              <button
                                onClick={() => decideRequest(u._id, 'approved')}
                                className="px-3 py-1.5 rounded-full text-[12px] bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 transition-colors"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {r.status === 'approved' && (
                            <button
                              onClick={() => revokeRequest(u._id)}
                              className="px-3 py-1.5 rounded-full text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                          {r.status === 'denied' && (
                            <button
                              onClick={() => decideRequest(u._id, 'approved')}
                              className="px-3 py-1.5 rounded-full text-[12px] bg-brand/15 border border-brand/30 text-brand hover:bg-brand/25 transition-colors"
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
                className="px-4 py-2 rounded-[14px] text-steel dark:text-ash text-[13px] hover:text-ink dark:hover:text-snow transition-colors"
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
