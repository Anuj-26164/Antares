import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * BackButton — a floating back arrow that navigates to the previous page.
 * Renders in the top-left area below the navbar.
 */
export default function BackButton({ fallback = '/events' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <motion.button
      onClick={handleBack}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer mb-6"
      aria-label="Go back"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back
    </motion.button>
  );
}
