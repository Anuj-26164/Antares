import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import TextType from '../common/TextType';
import BorderGlow from '../common/BorderGlow';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function HeroSection() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) {
      navigate(`/register?email=${encodeURIComponent(email.trim())}`);
    }
  };

  return (
    <motion.section
      className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center pt-32 pb-20 lg:pt-40 lg:pb-28"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* ── Left column ── */}
      <div className="flex flex-col gap-8">

        {/* Badge */}
        <motion.div variants={fadeUp} transition={{ duration: 0.5, ease: 'easeOut' }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-fog dark:border-graphite bg-snow dark:bg-ink px-4 py-1.5 text-[12px] font-medium text-steel dark:text-ash tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Event Media Platform
          </span>
        </motion.div>

        {/* Headline with TextType */}
        <motion.div variants={fadeUp} transition={{ duration: 0.6, ease: 'easeOut' }}>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95] text-snow">
            {/* Static first line */}
            <span className="block">Your events.</span>
            {/* Animated second line */}
            <span className="block mt-2 overflow-hidden whitespace-nowrap">
              <TextType
                text={[
                  'Captured perfectly.',
                  'Organized instantly.',
                  'Shared beautifully.',
                  'Powered by AI.',
                ]}
                typingSpeed={65}
                deletingSpeed={35}
                pauseDuration={1800}
                initialDelay={600}
                showCursor
                cursorCharacter="_"
                cursorBlinkDuration={0.5}
                className="text-brand"
              />
            </span>
          </h1>
        </motion.div>

        {/* Sub-copy */}
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-lg md:text-xl text-white/60 leading-relaxed max-w-[520px]"
        >
          The all-in-one platform for clubs and societies. Upload, organize, and
          share event media — with AI-powered search and watermarked downloads.
        </motion.p>

        {/* Social proof */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-center gap-4"
        >
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {['#60A5FA', '#3b82f6', '#2563eb', '#1d4ed8'].map((bg, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-obsidian flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: bg }}
              >
                {['A', 'B', 'C', '+'][i]}
              </div>
            ))}
          </div>
          <p className="text-[14px] text-white/70">
            <span className="font-bold text-brand">500+</span> clubs already using Antares
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-wrap gap-2"
        >
          {['Watermarked downloads', 'Role-based access', 'Cloudflare R2 storage'].map((feat) => (
            <span
              key={feat}
              className="inline-flex items-center gap-1.5 rounded-full bg-fog dark:bg-graphite/40 px-3 py-1 text-[12px] font-medium text-steel dark:text-ash"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-brand shrink-0">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {feat}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── Right column: CTA card ── */}
      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative"
      >
        {/* Glow behind card */}
        <div
          aria-hidden
          className="absolute -inset-4 rounded-[48px] opacity-20 dark:opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #60A5FA 0%, transparent 70%)' }}
        />

        <BorderGlow
          borderRadius={36}
          glowIntensity={0.7}
          colors={['#60A5FA', '#3b82f6', '#60A5FA']}
          backgroundColor="transparent"
        >
        <div
          className="relative bg-snow dark:bg-ink rounded-[36px] p-8 md:p-10 border border-fog dark:border-graphite"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {/* Card header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-[14px] bg-brand/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-ink dark:text-snow text-[15px] font-semibold leading-tight">Start for free</p>
              <p className="text-steel dark:text-ash text-[12px]">No credit card required</p>
            </div>
          </div>

          <h2 className="text-ink dark:text-snow text-[26px] md:text-[30px] font-bold mb-3 leading-tight">
            Your club's media,<br />beautifully organized.
          </h2>
          <p className="text-steel dark:text-ash text-[15px] leading-relaxed mb-7">
            Join thousands of clubs already using Antares to manage their event media. Set up in minutes.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
            <Button variant="filled" size="lg" pill className="w-full">
              Get Started — It's Free
            </Button>
          </form>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-5 mt-6 pt-5 border-t border-fog dark:border-graphite">
            {[
              { label: 'Secure storage', icon: 'lock' },
              { label: 'Instant setup', icon: 'bolt' },
              { label: 'Free forever', icon: 'gift' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                  {icon === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}
                  {icon === 'bolt' && <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>}
                  {icon === 'gift' && <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></>}
                </svg>
                <span className="text-[11px] text-steel dark:text-ash font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        </BorderGlow>
      </motion.div>
    </motion.section>
  );
}
