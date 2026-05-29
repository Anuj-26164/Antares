import { useRef, useState, useEffect, useCallback } from 'react';

/* ── Helpers ────────────────────────────────────────────────────────────── */
function fmt(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
const PlayIco = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);
const PauseIco = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const VolIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);
const MuteIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
const FsIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
);
const ExFsIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 0 2-2h3M3 16h3a2 2 0 0 0 2 2v3" />
  </svg>
);
const PipIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
  </svg>
);
const DlIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const ShareIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const HeartIco = ({ filled }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 ${filled ? 'text-red-400' : ''}`}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

/* ── Control button ─────────────────────────────────────────────────────── */
const Btn = ({ onClick, title, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-150 ${className}`}
  >
    {children}
  </button>
);

/* ── Main component ─────────────────────────────────────────────────────── */
export default function VideoPlayer({ src, poster, onDownload, onFavourite, onShare, liked, likeCount }) {
  const videoRef  = useRef(null);
  const wrapRef   = useRef(null);
  const hideRef   = useRef(null);
  const seekRef   = useRef(null);

  const [paused,   setPaused]   = useState(true);
  const [muted,    setMuted]    = useState(false);
  const [volume,   setVolume]   = useState(1);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [fs,       setFs]       = useState(false);
  const [visible,  setVisible]  = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  /* Sync video events → state */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const on = (ev, fn) => v.addEventListener(ev, fn);
    const off = (ev, fn) => v.removeEventListener(ev, fn);
    const onFsChg = () => setFs(!!document.fullscreenElement);

    const handlers = {
      play:            () => setPaused(false),
      pause:           () => setPaused(true),
      waiting:         () => setLoading(true),
      playing:         () => { setLoading(false); setError(false); },
      canplay:         () => setLoading(false),
      loadedmetadata:  () => { setDuration(v.duration); setLoading(false); },
      timeupdate:      () => {
        setCurrent(v.currentTime);
        if (v.buffered.length) {
          setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
        }
      },
      volumechange:    () => { setMuted(v.muted); setVolume(v.volume); },
      error:           () => { setError(true); setLoading(false); },
    };

    Object.entries(handlers).forEach(([ev, fn]) => on(ev, fn));
    document.addEventListener('fullscreenchange', onFsChg);

    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => off(ev, fn));
      document.removeEventListener('fullscreenchange', onFsChg);
    };
  }, []);

  /* Auto-hide controls */
  const showControls = useCallback(() => {
    setVisible(true);
    clearTimeout(hideRef.current);
    if (!videoRef.current?.paused) {
      hideRef.current = setTimeout(() => setVisible(false), 3000);
    }
  }, []);

  useEffect(() => {
    if (paused) { setVisible(true); clearTimeout(hideRef.current); }
    else { hideRef.current = setTimeout(() => setVisible(false), 3000); }
    return () => clearTimeout(hideRef.current);
  }, [paused]);

  /* Actions */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    paused ? v.play().catch(() => {}) : v.pause();
  };

  const handleSeekClick = (e) => {
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * duration;
  };

  const setVol = (val) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted  = val === 0;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const toggleFs = () => {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const togglePip = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else v.requestPictureInPicture?.();
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full rounded-2xl overflow-hidden bg-black"
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* Native video — src set directly, crossOrigin before load */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        crossOrigin="use-credentials"
        className="w-full h-full object-contain"
        playsInline
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Loading spinner */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-white/30">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-white/40 text-[13px]">Video unavailable</p>
        </div>
      )}

      {/* Big play button when paused */}
      {paused && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{
              background: 'rgba(8,8,14,0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      )}

      {/* Glassmorphism control bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-3 transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(8,8,14,0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Seek bar */}
          <div
            ref={seekRef}
            className="relative h-1 mb-3 cursor-pointer group/seek"
            onClick={handleSeekClick}
          >
            <div className="absolute inset-0 rounded-full bg-white/10" />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: `${buffered}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-400 transition-all" style={{ width: `${progress}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1">
            <Btn onClick={togglePlay} title={paused ? 'Play' : 'Pause'} className="text-white w-9 h-9">
              {paused ? <PlayIco /> : <PauseIco />}
            </Btn>

            <Btn onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              {muted || volume === 0 ? <MuteIco /> : <VolIco />}
            </Btn>

            <input
              type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(parseFloat(e.target.value))}
              className="w-16 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgba(96,165,250,0.9) ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.15) ${(muted ? 0 : volume) * 100}%)`,
                accentColor: '#60A5FA',
              }}
            />

            <span className="text-white/50 text-[11px] font-mono ml-2 shrink-0">
              {fmt(current)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            <Btn onClick={onFavourite} title="Like" className={liked ? 'text-red-400' : ''}>
              <HeartIco filled={liked} />
            </Btn>
            {likeCount > 0 && (
              <span className="text-white/40 text-[11px] -ml-1 mr-1">{likeCount}</span>
            )}

            <Btn onClick={onDownload} title="Download"><DlIco /></Btn>
            <Btn onClick={onShare} title="Share"><ShareIco /></Btn>
            <Btn onClick={togglePip} title="Picture in Picture"><PipIco /></Btn>
            <Btn onClick={toggleFs} title={fs ? 'Exit Fullscreen' : 'Fullscreen'}>
              {fs ? <ExFsIco /> : <FsIco />}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
