import { useMemo, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  TrendingUp,
  Building2,
  ArrowRight,
  Search,
  CalendarDays,
  CalendarRange,
  Plus,
  Users,
  DoorOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Button, Avatar, StatusBadge, Skeleton } from '@/components/ui';
import { cn, formatDate, formatHourRange, todayISO } from '@/lib/utils';

export function DashboardPage() {
  const { currentUser, bookings, rooms, navigate, users } = useApp();
  const [search, setSearch] = useState('');
  const [loading] = useState(false);

  const myBookings = useMemo(
    () => bookings.filter((b) => b.userId === currentUser?.id && b.status !== 'cancelled'),
    [bookings, currentUser],
  );

  const upcoming = useMemo(
    () =>
      myBookings
        .filter((b) => b.date >= todayISO())
        .sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour)
        .slice(0, 4),
    [myBookings],
  );

  const stats = useMemo(() => {
    const today = todayISO();
    const todayBookings = bookings.filter((b) => b.date === today && b.status !== 'cancelled');
    const pendingCount = bookings.filter((b) => b.status === 'pending').length;
    const activeRooms = rooms.filter((r) => r.active).length;
    return {
      myUpcoming: myBookings.filter((b) => b.date >= today).length,
      todayTotal: todayBookings.length,
      pending: pendingCount,
      activeRooms,
      totalUsers: users.length,
    };
  }, [bookings, rooms, users, myBookings]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return rooms
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.building.toLowerCase().includes(q) ||
          r.equipment.some((e) => e.toLowerCase().includes(q)),
      )
      .slice(0, 4);
  }, [search, rooms]);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';

  const statCards = isAdmin
    ? [
        { label: 'Bookings Today', value: stats.todayTotal, icon: CalendarCheck, color: 'brand', trend: '+12% vs yesterday' },
        { label: 'Pending Approvals', value: stats.pending, icon: Clock, color: 'amber', trend: 'Awaiting review' },
        { label: 'Active Rooms', value: stats.activeRooms, icon: DoorOpen, color: 'teal', trend: `${rooms.length} total` },
        { label: 'Registered Users', value: stats.totalUsers, icon: Users, color: 'slate', trend: 'Across all departments' },
      ]
    : [
        { label: 'My Upcoming', value: stats.myUpcoming, icon: CalendarRange, color: 'brand', trend: 'Next 7 days' },
        { label: 'Bookings Today', value: stats.todayTotal, icon: CalendarCheck, color: 'teal', trend: 'Across campus' },
        { label: 'Pending Approvals', value: stats.pending, icon: Clock, color: 'amber', trend: 'Awaiting review' },
        { label: 'Available Rooms', value: stats.activeRooms, icon: DoorOpen, color: 'slate', trend: 'Ready to book' },
      ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {greeting()}, {currentUser.name.split(' ')[0]}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Here's what's happening across campus today."
              : "Manage your room bookings and find available spaces."}
          </p>
        </div>
        <Button onClick={() => navigate('calendar')} className="self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : statCards.map((stat) => (
              <Card key={stat.label} className="p-5 hover:shadow-card-hover transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">{stat.value}</p>
                  </div>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorBg(stat.color))}>
                    <stat.icon className={cn('h-5 w-5', colorText(stat.color))} />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stat.trend}
                </p>
              </Card>
            ))}
      </div>

      {/* Quick search */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Quick Room Search</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">Search by room name, code, building, or equipment.</p>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Computer Lab, Projector, Engineering Block…"
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-1.5 animate-slide-up">
            {searchResults.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate('calendar')}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/50 transition-colors focus-ring"
              >
                <img src={room.image} alt={room.name} className="h-12 w-16 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{room.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {room.code} · {room.building} · Cap. {room.capacity}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
        {search.trim() && searchResults.length === 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            No rooms found. Try a different search term.
          </div>
        )}
      </Card>

      {/* Upcoming + Quick actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Upcoming Bookings</h3>
            <button
              onClick={() => navigate('my-bookings')}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 focus-ring rounded"
            >
              View all →
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <CalendarRange className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-slate-600">No upcoming bookings</p>
              <p className="text-xs text-slate-400 mt-1">Book a room to get started.</p>
              <Button size="sm" className="mt-4" onClick={() => navigate('calendar')}>
                <Plus className="h-3.5 w-3.5" />
                Book a Room
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700 shrink-0">
                      <span className="text-xs font-bold leading-none">{new Date(b.date + 'T00:00:00').getDate()}</span>
                      <span className="text-[9px] uppercase mt-0.5">
                        {new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{b.purpose}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {room?.name} · {formatHourRange(b.startHour, b.endHour)}
                      </p>
                    </div>
                    <StatusBadge status={b.status} size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction icon={CalendarDays} label="Check Availability" desc="View the weekly calendar" onClick={() => navigate('calendar')} />
            <QuickAction icon={Search} label="Find a Room" desc="Search & filter rooms" onClick={() => navigate('rooms')} />
            <QuickAction icon={CalendarRange} label="My Bookings" desc="Manage your reservations" onClick={() => navigate('my-bookings')} />
            {isAdmin && (
              <>
                <QuickAction icon={CheckCircle2} label="Approve Bookings" desc={`${stats.pending} pending`} onClick={() => navigate('admin-rooms')} />
                <QuickAction icon={Building2} label="Reports" desc="View utilization analytics" onClick={() => navigate('admin-reports')} />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Recent activity for admin */}
      {isAdmin && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Recent Booking Activity</h3>
            <button onClick={() => navigate('admin-reports')} className="text-xs font-medium text-brand-700 hover:text-brand-800 focus-ring rounded">
              View reports →
            </button>
          </div>
          <div className="space-y-2">
            {bookings
              .filter((b) => b.status !== 'cancelled')
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const user = users.find((u) => u.id === b.userId);
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    {user && <Avatar name={user.name} color={user.avatarColor} size="sm" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{b.userName}</span>{' '}
                        <span className="text-slate-400">booked</span>{' '}
                        <span className="font-medium">{room?.name}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(b.date)} · {formatHourRange(b.startHour, b.endHour)}
                      </p>
                    </div>
                    <StatusBadge status={b.status} size="sm" />
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: typeof Search;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/50 transition-all focus-ring group"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700 transition-colors">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function colorBg(color: string): string {
  return {
    brand: 'bg-brand-50',
    teal: 'bg-teal-50',
    amber: 'bg-amber-50',
    slate: 'bg-slate-100',
  }[color] || 'bg-slate-100';
}

function colorText(color: string): string {
  return {
    brand: 'text-brand-700',
    teal: 'text-teal-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600',
  }[color] || 'text-slate-600';
}
