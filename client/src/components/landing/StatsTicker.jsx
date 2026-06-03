const tickerItems = [
  '10,000+ Photos Uploaded',
  '500+ Events Hosted',
  '50+ Partner Clubs',
  '99.9% Uptime',
  '4K HDR Galleries',
  '120+ Universities Onboarded',
  '25,000+ Tagged Memories',
  'Built at IIT Roorkee',
  'AI-assisted Descriptions',
  'Real-time Notifications',
  'Cloudflare R2 Storage',
  'Sub-second Photo Search',
  '300+ Photographers',
  'Open MIT License',
  'GDPR-friendly by Design',
];

export default function StatsTicker() {
  return (
    <div className="w-full overflow-hidden py-6">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: 'ticker 10s linear infinite' }}
      >
        {/* Duplicate content for seamless loop */}
        {[...tickerItems, ...tickerItems].map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-3 text-steel dark:text-ash text-[14px] font-medium"
          >
            {item}
            <span
              aria-hidden="true"
              className="inline-block w-1 h-1 rounded-full bg-steel/40 dark:bg-ash/40"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
