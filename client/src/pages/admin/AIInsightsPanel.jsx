import { motion } from 'framer-motion';
import GlassCard from '../../components/common/GlassCard.jsx';

const placeholderCards = [
  {
    title: 'Most Popular Events',
    description: 'AI-powered analysis of event engagement and attendance patterns.',
    value: '—',
  },
  {
    title: 'Trending Media',
    description: 'Automatically detect trending uploads based on views and interactions.',
    value: '—',
  },
  {
    title: 'User Engagement',
    description: 'Insights into user activity, retention, and growth trends.',
    value: '—',
  },
];

export default function AIInsightsPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-ink dark:text-snow text-[24px] font-bold">AI Insights</h2>
        <span className="inline-flex items-center rounded-[12px] px-3 py-1 text-[10px] font-medium bg-ember/20 text-ember">
          Coming Soon
        </span>
      </div>
      <p className="text-steel dark:text-ash text-[14px] mb-8 max-w-[600px]">
        Intelligent analytics powered by machine learning. Get automated insights about your platform's
        performance, user behavior, and content trends.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {placeholderCards.map((card, i) => (
          <GlassCard key={card.title} delay={i * 0.1}>
            <p className="text-ink dark:text-snow text-[14px] font-medium mb-1">{card.title}</p>
            <p className="text-steel dark:text-ash text-[12px] mb-4">{card.description}</p>
            <p className="text-ink dark:text-snow text-[28px] font-bold">{card.value}</p>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  );
}
