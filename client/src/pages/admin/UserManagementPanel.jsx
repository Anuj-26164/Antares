import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../utils/api.js';
import { SkeletonTable } from '../../components/common/Skeleton.jsx';
import { formatRole } from '../../utils/formatters.js';

const ROLES = ['admin', 'photographer', 'club_member', 'viewer'];

export default function UserManagementPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data.users || []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Count admins to detect last-admin scenario
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const handleRoleChange = async (userId, newRole) => {
    const targetUser = users.find((u) => u._id === userId);

    // Frontend guard: prevent demoting last admin
    if (targetUser?.role === 'admin' && newRole !== 'admin' && adminCount <= 1) {
      setError('At least one admin must remain. Promote another user to admin first.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    const prevUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
    );
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
    } catch (err) {
      setUsers(prevUsers);
      const msg = err.response?.data?.error || 'Failed to update role';
      setError(msg);
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleToggleBlock = async (userId) => {
    const prevUsers = [...users];
    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, isBlocked: !u.isBlocked } : u))
    );
    try {
      await api.patch(`/admin/users/${userId}/block`);
    } catch {
      setUsers(prevUsers);
      setError('Failed to update block status');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return <SkeletonTable rows={6} cols={4} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Error toast */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-[14px] bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[13px]">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-[14px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow placeholder:text-steel outline-none focus:border-steel transition-colors w-[240px]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-[14px] bg-white dark:bg-ink border border-gray-200 dark:border-graphite px-4 py-2.5 text-[14px] text-ink dark:text-snow outline-none cursor-pointer"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{formatRole(r)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[20px] border border-gray-200 dark:border-graphite">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-graphite bg-gray-50 dark:bg-ink/60">
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Registered</th>
              <th className="px-4 py-3 text-[11px] font-semibold text-steel dark:text-ash uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user._id}
                className="border-b border-gray-100 dark:border-graphite/40 hover:bg-gray-50 dark:hover:bg-graphite/20 transition-colors"
              >
                <td className="px-4 py-3 text-[13px] text-ink dark:text-snow font-medium">{user.name}</td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                    disabled={user.role === 'admin' && adminCount <= 1}
                    className={`rounded-[10px] bg-gray-100 dark:bg-obsidian border border-gray-200 dark:border-graphite px-2 py-1 text-[12px] text-ink dark:text-snow outline-none cursor-pointer ${
                      user.role === 'admin' && adminCount <= 1 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={user.role === 'admin' && adminCount <= 1 ? 'Cannot demote the last admin' : ''}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{formatRole(r)}</option>
                    ))}
                  </select>
                  {user.role === 'admin' && adminCount <= 1 && (
                    <p className="text-[10px] text-amber-500 mt-0.5">Last admin</p>
                  )}
                </td>
                <td className="px-4 py-3 text-[13px] text-steel dark:text-ash">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => handleToggleBlock(user._id)}
                      className={`px-3 py-1 rounded-[10px] text-[11px] font-medium transition-colors ${
                        user.isBlocked
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/25'
                          : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/25'
                      }`}
                    >
                      {user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-steel dark:text-ash text-[13px]">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
