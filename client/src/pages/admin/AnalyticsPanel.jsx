import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '../../components/common/GlassCard.jsx';
import useThemeStore from '../../store/themeStore.js';
import { SkeletonMetricCard, SkeletonChart } from '../../components/common/Skeleton.jsx';
import api from '../../utils/api.js';

function formatStorage(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-snow dark:bg-ink border border-fog dark:border-graphite rounded-[12px] px-3 py-2 shadow-lg">
      <p className="text-[11px] text-steel dark:text-steel dark:text-ash">{label}</p>
      <p className="text-[14px] font-semibold text-ink dark:text-ink dark:text-snow">{payload[0].value}</p>
    </div>
  );
}

export default function AnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const theme = useThemeStore((state) => state.theme);

  const isDark = theme === 'dark';

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/analytics');
      setData(res.data.data);
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => <SkeletonMetricCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-steel dark:text-steel dark:text-ash text-[14px] mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 rounded-[14px] bg-obsidian dark:bg-graphite text-snow text-[13px] hover:opacity-80 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  const metrics = [
    { label: 'Total Events', value: data.totalEvents, color: '#ff5a00' },
    { label: 'Total Media', value: data.totalMedia, color: '#3b82f6' },
    { label: 'Total Users', value: data.totalUsers, color: '#10b981' },
    { label: 'Storage Used', value: formatStorage(data.totalStorage), color: '#8b5cf6' },
  ];

  const gridColor = isDark ? 'rgba(63,63,70,0.4)' : 'rgba(236,236,238,0.8)';
  const tickColor = isDark ? '#a1a1aa' : '#71717a';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, i) => (
          <GlassCard key={m.label} delay={i * 0.05}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                style={{ backgroundColor: `${m.color}15` }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
              </div>
              <div>
                <p className="text-steel dark:text-steel dark:text-ash text-[11px] font-medium uppercase tracking-wide">{m.label}</p>
                <p className="text-ink dark:text-ink dark:text-snow text-[24px] font-bold leading-tight">{m.value}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard delay={0.2}>
          <p className="text-ink dark:text-ink dark:text-snow text-[14px] font-semibold mb-1">Media Uploads</p>
          <p className="text-steel dark:text-steel dark:text-ash text-[12px] mb-4">Last 30 days</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.uploadsPerDay || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5a00" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff5a00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  tickFormatter={(v) => v?.slice(5) || ''}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#ff5a00"
                  strokeWidth={2.5}
                  fill="url(#uploadGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#ff5a00', stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={0.25}>
          <p className="text-ink dark:text-ink dark:text-snow text-[14px] font-semibold mb-1">User Registrations</p>
          <p className="text-steel dark:text-steel dark:text-ash text-[12px] mb-4">Last 30 days</p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.registrationsPerDay || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  tickFormatter={(v) => v?.slice(5) || ''}
                />
                <YAxis
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#regGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#3b82f6', stroke: isDark ? '#18181b' : '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
