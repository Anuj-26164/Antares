import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../utils/api.js';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/mov'];

export default function SettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = [];
    if (!settings.uploadSizeLimit || settings.uploadSizeLimit <= 0) {
      errs.push('Upload size limit must be greater than 0');
    }
    if (!settings.allowedImageTypes || settings.allowedImageTypes.length < 1) {
      errs.push('At least 1 image type must be selected');
    }
    if (!settings.allowedVideoTypes || settings.allowedVideoTypes.length < 1) {
      errs.push('At least 1 video type must be selected');
    }
    return errs;
  };

  const handleSave = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/settings', {
        uploadSizeLimit: settings.uploadSizeLimit,
        maxBulkUploadCount: settings.maxBulkUploadCount,
        allowedImageTypes: settings.allowedImageTypes,
        allowedVideoTypes: settings.allowedVideoTypes,
        defaultVisibility: settings.defaultVisibility,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const toggleImageType = (type) => {
    setSettings((prev) => ({
      ...prev,
      allowedImageTypes: prev.allowedImageTypes?.includes(type)
        ? prev.allowedImageTypes.filter((t) => t !== type)
        : [...(prev.allowedImageTypes || []), type],
    }));
  };

  const toggleVideoType = (type) => {
    setSettings((prev) => ({
      ...prev,
      allowedVideoTypes: prev.allowedVideoTypes?.includes(type)
        ? prev.allowedVideoTypes.filter((t) => t !== type)
        : [...(prev.allowedVideoTypes || []), type],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <style>{`
          .antares-loader{height:15px;aspect-ratio:4;display:grid;animation:l31-0 1s infinite}
          .antares-loader::before,.antares-loader::after{content:"";grid-area:1/1;--_g:no-repeat radial-gradient(farthest-side,#fff 94%,#0000);background:var(--_g) left,var(--_g) right;background-size:25% 100%}
          .antares-loader::after{transform:rotate(0) translate(37.5%) rotate(0);animation:inherit;animation-name:l31-1}
          @keyframes l31-0{100%{transform:translate(37.5%)}}
          @keyframes l31-1{100%{transform:rotate(-.5turn) translate(37.5%) rotate(.5turn)}}
        `}</style>
        <div className="antares-loader" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[600px]"
    >
      {/* Messages */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-[14px] border text-[13px] ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-[14px] bg-red-900/30 border border-red-800 text-red-400 text-[13px]">
          <ul className="list-disc list-inside">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Upload size limit */}
        <div>
          <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">
            Upload Size Limit (MB)
          </label>
          <input
            type="number"
            min="1"
            value={settings.uploadSizeLimit || ''}
            onChange={(e) => setSettings({ ...settings, uploadSizeLimit: Number(e.target.value) })}
            className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none focus:border-ash transition-colors w-full"
          />
        </div>

        {/* Max bulk upload count */}
        <div>
          <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">
            Max Bulk Upload Count
          </label>
          <input
            type="number"
            min="1"
            value={settings.maxBulkUploadCount || ''}
            onChange={(e) => setSettings({ ...settings, maxBulkUploadCount: Number(e.target.value) })}
            className="rounded-[14px] bg-snow dark:bg-ink border border-fog dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none focus:border-ash transition-colors w-full"
          />
        </div>

        {/* Allowed image types */}
        <div>
          <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">
            Allowed Image Types
          </label>
          <div className="flex flex-wrap gap-3">
            {IMAGE_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-[13px] text-steel dark:text-ash cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowedImageTypes?.includes(type) || false}
                  onChange={() => toggleImageType(type)}
                  className="rounded"
                />
                {type.split('/')[1]}
              </label>
            ))}
          </div>
        </div>

        {/* Allowed video types */}
        <div>
          <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">
            Allowed Video Types
          </label>
          <div className="flex flex-wrap gap-3">
            {VIDEO_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-[13px] text-steel dark:text-ash cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowedVideoTypes?.includes(type) || false}
                  onChange={() => toggleVideoType(type)}
                  className="rounded"
                />
                {type.split('/')[1]}
              </label>
            ))}
          </div>
        </div>

        {/* Default visibility */}
        <div>
          <label className="text-ink dark:text-snow text-[13px] font-medium block mb-2">
            Default Visibility
          </label>
          <label className="flex items-center gap-2 text-[13px] text-steel dark:text-ash cursor-pointer">
            <input
              type="checkbox"
              checked={settings.defaultVisibility === 'public'}
              onChange={(e) =>
                setSettings({ ...settings, defaultVisibility: e.target.checked ? 'public' : 'private' })
              }
              className="rounded"
            />
            Public by default
          </label>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-fit px-6 py-2.5 rounded-[14px] bg-[#09090b] text-snow text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </motion.div>
  );
}
