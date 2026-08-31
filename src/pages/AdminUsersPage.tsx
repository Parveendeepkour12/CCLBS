import { useState, useMemo } from 'react';
import { Search, Users as UsersIcon, GraduationCap, ShieldCheck, Briefcase } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Input, Select, Avatar, RoleBadge, EmptyState, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

export function AdminUsersPage() {
  const { users, updateUserRole, bookings } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.universityId.includes(q) && !u.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, search, roleFilter]);

  const roleStats = useMemo(() => ({
    total: users.length,
    students: users.filter((u) => u.role === 'student').length,
    faculty: users.filter((u) => u.role === 'faculty').length,
    admins: users.filter((u) => u.role === 'admin').length,
  }), [users]);

  function getUserBookingCount(userId: string): number {
    return bookings.filter((b) => b.userId === userId && b.status !== 'cancelled').length;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">User Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage users, roles, and permissions.</p>
      </div>

      {/* Role stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Users</p>
              <p className="text-xl font-bold text-slate-800">{roleStats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Students</p>
              <p className="text-xl font-bold text-slate-800">{roleStats.students}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Faculty</p>
              <p className="text-xl font-bold text-slate-800">{roleStats.faculty}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Admins</p>
              <p className="text-xl font-bold text-slate-800">{roleStats.admins}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or email…"
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)} className="sm:w-40">
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="No users found"
          message="Try adjusting your search or filter criteria."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden lg:block overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">University ID</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} color={user.avatarColor} size="md" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600 font-mono">{user.universityId}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{user.department}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{getUserBookingCount(user.id)}</td>
                    <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as Role)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      >
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filtered.map((user) => (
              <div key={user.id} className="p-4 flex items-center gap-3">
                <Avatar name={user.name} color={user.avatarColor} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{user.universityId}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.department}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <RoleBadge role={user.role} />
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value as Role)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
