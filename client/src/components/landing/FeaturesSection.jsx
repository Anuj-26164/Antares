import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import BorderGlow from '../common/BorderGlow.jsx';

const features = [
  {
    title: 'Event Albums',
    description: 'Organize photos and videos by event with automatic categorization.',
    icon: 'camera',
  },
  {
    title: 'Access Control',
    description: 'Role-based permissions ensure the right people see the right content.',
    icon: 'lock',
  },
  {
    title: 'AI Tagging',
    description: 'Automatically tag and categorize your media with AI-powered analysis.',
    icon: 'tag',
  },
  {
    title: 'Facial Recognition',
    description: 'Find photos of specific people across all your events instantly.',
    icon: 'user',
  },
  {
    title: 'Social Interactions',
    description: 'Like, comment, and favourite photos to engage with your community.',
    icon: 'chat',
  },
  {
    title: 'Cloud Storage',
    description: 'Secure, scalable storage powered by Cloudflare R2 with global CDN.',
    icon: 'cloud',
  },
];

export default function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section id="features" className="py-4">
      {/* Section header */}
      <div className="text-center mb-14">
        <h2 className="font-display text-3xl md:text-5xl font-bold text-snow mb-4 tracking-tight">
          Everything you need
        </h2>
        <p className="text-white/50 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Powerful features designed specifically for clubs, societies, and event organizers.
        </p>
      </div>

      <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <BorderGlow
            key={feature.title}
            borderRadius={36}
            glowIntensity={0.5}
            colors={['#60A5FA', '#3b82f6', '#60A5FA']}
            backgroundColor="#18181b"
            fillOpacity={0.15}
            glowColor="210 80 70"
          >
            <motion.div
              className="bg-ink/40 rounded-[36px] p-8 md:p-10 border border-graphite/50 min-h-[260px] flex flex-col justify-between"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: index * 0.1,
              }}
            >
              <div>
                <div className="w-12 h-12 rounded-[14px] bg-brand/10 flex items-center justify-center mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {feature.icon === 'camera' && <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}
                    {feature.icon === 'lock' && <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>}
                    {feature.icon === 'tag' && <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>}
                    {feature.icon === 'user' && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}
                    {feature.icon === 'chat' && <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>}
                    {feature.icon === 'cloud' && <><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></>}
                  </svg>
                </div>
                <h3 className="font-heading text-snow text-xl md:text-2xl font-bold mb-3">
                  {feature.title}
                </h3>
              </div>
              <p className="text-white/50 text-base md:text-lg leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          </BorderGlow>
        ))}
      </div>
    </section>
  );
}
