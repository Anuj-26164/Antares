/**
 * Reusable skeleton loading components.
 * Uses a shimmer animation via CSS for a polished loading state.
 */

export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[14px] bg-fog/60 dark:bg-graphite/40 ${className}`} />
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-3.5"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[36px] bg-fog/40 dark:bg-graphite/20 border border-fog dark:border-graphite/30 p-8 ${className}`}>
      <div className="rounded-[12px] bg-fog/60 dark:bg-graphite/40 h-10 w-10 mb-5" />
      <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-5 w-3/4 mb-3" />
      <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-3.5 w-full mb-2" />
      <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-3.5 w-2/3" />
    </div>
  );
}

export function SkeletonMediaCard({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[36px] bg-fog/40 dark:bg-graphite/20 border border-fog dark:border-graphite/30 overflow-hidden ${className}`}>
      <div className="aspect-[4/3] bg-fog/60 dark:bg-graphite/40" />
      <div className="p-4">
        <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-4 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`animate-pulse rounded-[28px] border border-fog dark:border-graphite/30 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-fog/30 dark:bg-graphite/20 border-b border-fog dark:border-graphite/30">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 px-4 py-3.5 border-b border-fog/50 dark:border-graphite/20 last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-3.5 flex-1"
              style={{ maxWidth: colIdx === 0 ? '40%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetricCard({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[36px] bg-fog/40 dark:bg-graphite/20 border border-fog dark:border-graphite/30 p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-fog/60 dark:bg-graphite/40" />
        <div className="flex-1">
          <div className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-3 w-20 mb-2" />
          <div className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[36px] bg-fog/40 dark:bg-graphite/20 border border-fog dark:border-graphite/30 p-6 ${className}`}>
      <div className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-4 w-40 mb-2" />
      <div className="rounded-[6px] bg-fog/60 dark:bg-graphite/40 h-3 w-24 mb-6" />
      <div className="rounded-[14px] bg-fog/60 dark:bg-graphite/40 h-[200px] w-full" />
    </div>
  );
}

export function SkeletonProfile({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-[36px] bg-fog/40 dark:bg-graphite/20 border border-fog dark:border-graphite/30 p-8 ${className}`}>
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-fog/60 dark:bg-graphite/40 shrink-0" />
        <div className="flex-1">
          <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-6 w-48 mb-3" />
          <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-3.5 w-32 mb-2" />
          <div className="rounded-[8px] bg-fog/60 dark:bg-graphite/40 h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
