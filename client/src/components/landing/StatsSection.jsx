import { useState, useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';

const stats = [
  { numeral: 10000, suffix: '+', label: 'Photos Uploaded' },
  { numeral: 500, suffix: '+', label: 'Events Hosted' },
  { numeral: 50, suffix: '+', label: 'Partner Clubs' },
  { numeral: 99.9, suffix: '%', label: 'Uptime' },
];

function AnimatedNumber({ value, suffix, duration = 2000 }) {
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView || hasAnimated) return;
    setHasAnimated(true);

    const startTime = performance.now();
    const isDecimal = value % 1 !== 0;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * value;

      if (isDecimal) {
        setDisplay(current.toFixed(1));
      } else {
        setDisplay(Math.floor(current));
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplay(isDecimal ? value.toFixed(1) : value);
      }
    }

    requestAnimationFrame(animate);
  }, [isInView, value, duration, hasAnimated]);

  // Format number with commas
  const formatted = typeof display === 'string'
    ? display
    : display.toLocaleString();

  return (
    <span ref={ref}>
      {formatted}{suffix}
    </span>
  );
}

export default function StatsSection() {
  return (
    <section className="py-16">
      <div className="text-center mb-12">
        <h2 className="text-[32px] md:text-[40px] font-bold text-obsidian dark:text-snow mb-3">
          Trusted by clubs everywhere
        </h2>
        <p className="text-steel dark:text-ash text-[16px] md:text-[18px]">
          Growing every day with passionate event organizers.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[44px] md:text-[56px] font-bold text-obsidian dark:text-snow">
              <AnimatedNumber value={stat.numeral} suffix={stat.suffix} />
            </p>
            <p className="text-[14px] md:text-[15px] font-normal text-steel dark:text-ash mt-2">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
