import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import Button from '../common/Button';

export default function CTAFooterBand() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.3 });

  const rise = (delay = 0) => ({
    initial: { opacity: 0, y: 28 },
    animate: inView ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay },
  });

  return (
    <section
      ref={sectionRef}
      className="bg-obsidian rounded-[36px] p-12 md:p-16 text-center"
    >
      <motion.h2
        {...rise(0)}
        className="text-snow text-[36px] md:text-[48px] font-bold mb-4"
      >
        Ready to get started?
      </motion.h2>
      <motion.p
        {...rise(0.12)}
        className="text-ash text-[17px] md:text-[19px] mb-10 max-w-lg mx-auto leading-relaxed"
      >
        Join thousands of event organizers and photographers already using
        Antares to manage their media. Free forever for small teams.
      </motion.p>
      <motion.div
        {...rise(0.24)}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <Button
          variant="outline"
          size="lg"
          pill
          className="border-graphite text-snow hover:bg-graphite/20"
          onClick={() => navigate('/register')}
        >
          Create Free Account
        </Button>
        <Button
          variant="ghost"
          size="lg"
          pill
          className="text-ash hover:text-snow"
          onClick={() => navigate('/events')}
        >
          Browse Events →
        </Button>
      </motion.div>
    </section>
  );
}
