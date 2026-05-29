import { motion } from 'framer-motion';
import BorderGlow from './BorderGlow.jsx';

export default function GlassCard({ children, className = '', animate = true, delay = 0 }) {
  const innerClasses =
    'bg-ink/60 border border-graphite rounded-[36px] p-6';

  const content = animate ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
      className={`${innerClasses} ${className}`}
    >
      {children}
    </motion.div>
  ) : (
    <div className={`${innerClasses} ${className}`}>{children}</div>
  );

  return (
    <BorderGlow
      borderRadius={36}
      glowIntensity={0.5}
      colors={['#60A5FA', '#3b82f6', '#60A5FA']}
      backgroundColor="#18181b"
      fillOpacity={0.15}
      glowColor="210 80 70"
    >
      {content}
    </BorderGlow>
  );
}
