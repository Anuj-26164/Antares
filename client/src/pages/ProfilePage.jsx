import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import api from '../utils/api.js';
import { getUserAvatar } from '../utils/avatar.js';
import { formatRole } from '../utils/formatters.js';
import Input from '../components/common/Input.jsx';
import BackButton from '../components/common/BackButton.jsx';
import BrandLink from '../components/common/BrandLink.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import MediaModal from '../components/gallery/MediaModal.jsx';

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [favourites, setFavourites] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  useEffect(() => {
    loadFavourites(1);
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  const loadFavourites = async (pageNum) => {
    setLoadingFavs(true);
    try {
      const response = await api.get('/users/me/favourites', {
        params: { page: pageNum, limit: 20 },
      });
      const data = response.data.data;
      const items = Array.isArray(data) ? data : data.media || [];
      if (pageNum === 1) {
        setFavourites(items);
      } else {
        setFavourites((prev) => [...prev, ...items]);
      }
      setHasMore(items.length >= 20);
      setPage(pageNum);
    } catch {
      // Silently handle
    } finally {
      setLoadingFavs(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingFavs) {
      loadFavourites(page + 1);
    }
  };

  const handleOpenMedia = useCallback(async (item) => {
    try {
      // Fetch full media details including uploadedBy, comments, etc.
      const res = await api.get(`/media/${item._id}`);
      setSelectedMedia(res.data.data || item);
    } catch {
      // Fall back to the item we already have
      setSelectedMedia(item);
    }
  }, []);

  const handleCloseMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const handleFavouriteChange = useCallback(() => {
    // Refresh favourites list from page 1 when a favourite is toggled
    loadFavourites(1);
  }, []);

  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // If user selected a file, upload it to the avatar endpoint first
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const uploadRes = await api.post('/users/me/avatar', formData);
        // Use the returned avatar URL as preview until fetchUser completes
        if (uploadRes.data?.data?.avatarUrl) {
          setAvatarPreview(uploadRes.data.data.avatarUrl);
        }
      }

      // Update other profile fields (name)
      await api.put('/users/me', { name });

      // Refresh user state to get the new avatar URL from the server
      await fetchUser();
      setEditing(false);
      setSaveSuccess(true);
      setAvatarFile(null);
      setAvatarPreview(null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    setSaveError(null);
    try {
      await api.put('/users/me', { avatar: '' });
      await fetchUser();
      setAvatarPreview(null);
      setAvatarFile(null);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to remove avatar');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const displayAvatar = avatarPreview || getUserAvatar(user);

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-[1400px] w-full mx-auto px-6 lg:px-10 py-10">
        <BackButton fallback="/events" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Profile header card */}
          <div className="bg-snow dark:bg-ink rounded-[36px] p-8 md:p-10 mb-10 border border-fog dark:border-graphite" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-start">
                <div className="relative group">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-fog dark:border-graphite">
                    <img
                      src={displayAvatar}
                      alt={user?.name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {editing && !saving && (
                    <label className="absolute inset-0 flex items-center justify-center bg-obsidian/50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-snow text-[11px] font-medium">Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                  {saving && avatarFile && (
                    <div className="absolute inset-0 flex items-center justify-center bg-obsidian/50 rounded-full">
                      <div className="w-6 h-6 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {saveError && editing && (
                  <p className="text-red-500 text-[12px] mt-2 max-w-[120px] text-center">{saveError}</p>
                )}
                {editing && !avatarFile && user?.avatar && user.avatar.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={removingAvatar || saving}
                    className="mt-2 text-[11px] font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {removingAvatar ? 'Removing...' : 'Remove Avatar'}
                  </button>
                )}
              </div>

              {/* User info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-[24px] md:text-[28px] font-bold text-ink dark:text-snow">
                    {user?.name || 'User'}
                  </h1>
                  <Badge label={formatRole(user?.role)} />
                </div>
                <p className="text-steel dark:text-ash text-[15px]">{user?.email}</p>
                <p className="text-ash text-[13px] mt-1">
                  Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {!editing ? (
                  <>
                    <Button variant="outline" size="sm" pill onClick={() => setEditing(true)}>
                      Edit Profile
                    </Button>
                    <Button variant="ghost" size="sm" pill className="text-red-500" onClick={handleLogout}>
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" pill onClick={() => { setEditing(false); setAvatarFile(null); setAvatarPreview(null); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Edit form */}
            {editing && (
              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSave}
                className="mt-8 pt-8 border-t border-fog dark:border-graphite max-w-lg"
              >
                <h3 className="text-ink dark:text-snow text-[18px] font-semibold mb-5">Edit Profile</h3>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">Display Name</label>
                    <Input
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {saveError && (
                    <p className="text-red-500 text-[13px]">{saveError}</p>
                  )}

                  <Button variant="filled" size="md" pill disabled={saving} onClick={handleSave} className="w-fit mt-2">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </motion.form>
            )}

            {/* Success message */}
            {saveSuccess && (
              <p className="mt-4 text-green-600 dark:text-green-400 text-[13px] font-medium">
                ✓ Profile updated successfully
              </p>
            )}
          </div>

          {/* Favourites section */}
          <div>
            <h2 className="text-[22px] font-bold text-ink dark:text-snow mb-6">Your Favourites</h2>

            {favourites.length === 0 && !loadingFavs ? (
              <div className="bg-snow dark:bg-ink rounded-[28px] border border-fog dark:border-graphite p-10 text-center">
                <p className="text-steel dark:text-ash text-[15px]">No favourites yet. Browse the gallery and heart some photos!</p>
                <Button variant="outline" size="md" pill className="mt-4" onClick={() => navigate('/gallery')}>
                  Browse Gallery
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {favourites.map((item) => (
                    <motion.div
                      key={item._id}
                      whileHover={{ scale: 1.03 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="rounded-[28px] overflow-hidden bg-snow dark:bg-ink border border-fog dark:border-graphite cursor-pointer group relative"
                      style={{ boxShadow: 'var(--shadow-card)' }}
                      onClick={() => handleOpenMedia(item)}
                    >
                      <div className="aspect-[4/3] relative overflow-hidden">
                        {item.type === 'video' ? (
                          <img
                            src={item.thumbnailUrl || `/api/media/${item._id}/thumbnail`}
                            alt={item.title || 'Video'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={`/api/media/${item._id}/serve`}
                            alt={item.title || 'Media'}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}

                        {/* Video play icon */}
                        {item.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 3h6v6"/>
                              <path d="M9 21H3v-6"/>
                              <path d="M21 3l-7 7"/>
                              <path d="M3 21l7-7"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <Button variant="outline" size="md" pill onClick={handleLoadMore} disabled={loadingFavs}>
                      {loadingFavs ? 'Loading...' : 'Load more'}
                    </Button>
                  </div>
                )}
              </>
            )}

            {loadingFavs && favourites.length === 0 && (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-fog dark:border-graphite border-t-ink dark:border-t-snow rounded-full animate-spin" />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Media viewer modal */}
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={handleCloseMedia}
          onFavourite={handleFavouriteChange}
        />
      )}
    </div>
  );
}
