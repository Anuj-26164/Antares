import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import BorderGlow from '../common/BorderGlow.jsx';

const problems = [
  {
    lead: 'Forget about',
    phrase: 'scattered Google Drives',
    description: 'All your event media in one centralized, organized platform. No more hunting through shared folders.',
    icon: 'folder',
  },
  {
    lead: 'No more',
    phrase: 'lost event photos',
    description: 'Every photo and video is securely stored in the cloud with automatic backups and instant access.',
    icon: 'lock',
  },
  {
    lead: 'Say goodbye to',
    phrase: 'permission chaos',
    description: 'Role-based access control means the right people see the right content. Simple, secure, automatic.',
    icon: 'shield',
  },
  {
    lead: 'Never deal with',
    phrase: 'broken links',
    description: 'Permanent, reliable URLs for all your media. Share with confidence — links that always work.',
    icon: 'link',
  },
];

export default function DarkProblemPanel() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="bg-obsidian rounded-[36px] p-10 md:p-16"
    >
      {/* Section header */}
      <motion.div
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="font-display text-snow text-3xl md:text-5xl font-bold mb-4 tracking-tight">
          The old way is broken
        </h2>
        <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Clubs and societies deserve better than scattered tools and manual workflows. Antares fixes everything.
        </p>
      </motion.div>

      {/* Problem grid — 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {problems.map((item, index) => (
          <BorderGlow
            key={index}
            borderRadius={28}
            glowIntensity={0.5}
            colors={['#60A5FA', '#3b82f6', '#60A5FA']}
            backgroundColor="#18181b"
            fillOpacity={0.15}
            glowColor="210 80 70"
          >
            <motion.div
              className="rounded-[28px] p-7 md:p-8"
              initial={{ x: -20, opacity: 0 }}
              animate={isInView ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }}
              transition={{
                duration: 0.5,
                ease: 'easeOut',
                delay: index * 0.1,
              }}
            >
            <div className="w-10 h-10 rounded-[12px] bg-brand/10 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {item.icon === 'folder' && <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>}
                {item.icon === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}
                {item.icon === 'shield' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
                {item.icon === 'link' && <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>}
              </svg>
            </div>
            <p className="text-xl md:text-2xl mb-3">
              <span className="text-white/50 font-normal">{item.lead} </span>
              <span className="text-snow font-bold">{item.phrase}</span>
            </p>
            <p className="text-white/40 text-base md:text-lg leading-relaxed">
              {item.description}
            </p>
            </motion.div>
          </BorderGlow>
        ))}
      </div>
    </section>
  );
}
