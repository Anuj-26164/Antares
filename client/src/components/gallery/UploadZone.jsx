import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api.js';
import Button from '../common/Button.jsx';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ eventId, onUploadComplete }) {
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => previews.forEach(p => URL.revokeObjectURL(p.preview));
  }, [previews]);

  const onDrop = useCallback((acceptedFiles) => {
    setError(null);
    const newPreviews = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      isVideo: file.type.startsWith('video/'),
      caption: '',
    }));
    setPreviews(prev => [...prev, ...newPreviews]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
  });

  const removeFile = (index) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const setCaption = (index, value) => {
    setPreviews((prev) => prev.map((p, i) => (i === index ? { ...p, caption: value.slice(0, 500) } : p)));
  };

  const handleUpload = async () => {
    if (previews.length === 0 || !eventId) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      previews.forEach(({ file }) => formData.append('files', file));
      // Per-file captions, aligned by index. Empty string = "let AI fill it".
      const captions = previews.map((p) => (p.caption || '').trim());
      formData.append('captions', JSON.stringify(captions));

      await api.post(`/media/upload/${eventId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      previews.forEach(p => URL.revokeObjectURL(p.preview));
      setPreviews([]);
      setProgress(100);
      onUploadComplete?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-graphite bg-ink/60 p-5">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center py-8 cursor-pointer rounded-[20px] border-2 border-dashed transition-all duration-200 ${
          isDragActive
            ? 'border-brand/60 bg-brand/5'
            : 'border-graphite hover:border-brand/30 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p className="text-snow text-[14px] font-medium">
          {isDragActive ? 'Drop files here' : 'Drag & drop or click to browse'}
        </p>
        <p className="text-ash text-[12px] mt-1">Photos & videos — JPEG, PNG, WebP, MP4, MOV</p>
      </div>

      {/* Preview grid */}
      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-snow text-[13px] font-medium">
                {previews.length} file{previews.length > 1 ? 's' : ''} selected
              </p>
              <button
                onClick={() => { previews.forEach(p => URL.revokeObjectURL(p.preview)); setPreviews([]); }}
                className="text-ash text-[12px] hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {previews.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-3 p-2 rounded-[14px] bg-graphite/20 border border-graphite/40"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative shrink-0 w-20 h-20 rounded-[10px] overflow-hidden bg-graphite/40 cursor-pointer group"
                    onClick={() => setLightboxIndex(i)}
                  >
                    {p.isVideo ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.5">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    ) : (
                      <img
                        src={p.preview}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Caption + meta */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-snow text-[12px] font-medium truncate">{p.name}</p>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-ash text-[11px] hover:text-red-400 transition-colors shrink-0"
                        aria-label="Remove file"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={p.caption}
                      onChange={(e) => setCaption(i, e.target.value)}
                      placeholder={p.isVideo ? 'Add a caption (optional)' : 'Add a caption — leave blank for an AI-generated one'}
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none px-2.5 py-1.5 rounded-[8px] bg-ink/70 border border-graphite/60 text-snow text-[12px] placeholder:text-steel focus:outline-none focus:border-brand/40"
                    />
                    <div className="flex items-center justify-between text-[10px] text-steel">
                      <span>{formatBytes(p.size)}</span>
                      <span>{p.caption.length}/500</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-ash text-[12px]">Uploading...</span>
            <span className="text-brand text-[12px] font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-graphite rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-[12px] mt-3">{error}</p>
      )}

      {previews.length > 0 && !uploading && (
        <div className="mt-4">
          <Button variant="filled" size="md" pill onClick={handleUpload} className="w-full">
            Upload {previews.length} file{previews.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              onClick={() => setLightboxIndex(null)}
            >
              ×
            </button>

            {/* Prev / Next */}
            {previews.length > 1 && (
              <>
                <button
                  className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i - 1 + previews.length) % previews.length); }}
                >
                  ‹
                </button>
                <button
                  className="absolute right-16 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i + 1) % previews.length); }}
                >
                  ›
                </button>
              </>
            )}

            <motion.div
              key={lightboxIndex}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-[90vw] max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {previews[lightboxIndex]?.isVideo ? (
                <video
                  src={previews[lightboxIndex].preview}
                  controls
                  className="max-w-full max-h-[80vh] rounded-[16px]"
                />
              ) : (
                <img
                  src={previews[lightboxIndex]?.preview}
                  alt={previews[lightboxIndex]?.name}
                  className="max-w-full max-h-[80vh] rounded-[16px] object-contain"
                />
              )}
              <p className="text-white/60 text-[12px] text-center mt-2">
                {previews[lightboxIndex]?.name} · {formatBytes(previews[lightboxIndex]?.size || 0)}
                {previews.length > 1 && ` · ${lightboxIndex + 1} / ${previews.length}`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
