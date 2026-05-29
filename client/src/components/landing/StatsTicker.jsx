const tickerItems = [
  '10,000+ Photos Uploaded',
  '500+ Events',
  '50+ Clubs',
  '99.9% Uptime',
  '10,000+ Photos Uploaded',
  '500+ Events',
  '50+ Clubs',
  '99.9% Uptime',
];

export default function StatsTicker() {
  return (
    <div className="w-full overflow-hidden py-6">
      <div
        className="flex gap-12 whitespace-nowrap"
        style={{ animation: 'ticker 25s linear infinite' }}
      >
        {/* Duplicate content for seamless loop */}
        {[...tickerItems, ...tickerItems].map((item, i) => (
          <span
            key={i}
            className="text-steel dark:text-ash text-[14px] font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
