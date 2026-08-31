import { useMemo, useState } from 'react';
import { Download, TrendingUp, Calendar, Clock, Building2, BarChart3 } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Button, Select } from '@/components/ui';
import { cn, todayISO } from '@/lib/utils';

export function AdminReportsPage() {
  const { bookings, rooms } = useApp();
  const [range, setRange] = useState<'week' | 'month' | 'all'>('week');

  const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
  const startDate = todayISO(-(days - 1));

  const filteredBookings = useMemo(
    () => bookings.filter((b) => b.date >= startDate && b.status !== 'cancelled'),
    [bookings, startDate],
  );

  // Utilization by room (bar chart)
  const roomUtilization = useMemo(() => {
    return rooms
      .map((room) => {
        const count = filteredBookings.filter((b) => b.roomId === room.id).length;
        const hours = filteredBookings
          .filter((b) => b.roomId === room.id)
          .reduce((sum, b) => sum + (b.endHour - b.startHour), 0);
        return { name: room.name, code: room.code, count, hours };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [filteredBookings, rooms]);

  const maxHours = Math.max(...roomUtilization.map((r) => r.hours), 1);

  // Bookings over time (line chart)
  const bookingsOverTime = useMemo(() => {
    const data: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = todayISO(-i);
      const count = filteredBookings.filter((b) => b.date === d).length;
      data.push({ date: d, count });
    }
    return data;
  }, [filteredBookings, days]);

  const maxBookingsPerDay = Math.max(...bookingsOverTime.map((d) => d.count), 1);

  // Peak time heatmap (day of week x hour)
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0));
    filteredBookings.forEach((b) => {
      const day = new Date(b.date + 'T00:00:00').getDay();
      for (let h = b.startHour; h < b.endHour; h++) {
        if (h >= 7 && h <= 20) {
          grid[day][h - 7]++;
        }
      }
    });
    return grid;
  }, [filteredBookings]);

  const maxHeat = Math.max(...heatmapData.flat(), 1);

  // Stats
  const totalBookings = filteredBookings.length;
  const totalHours = filteredBookings.reduce((sum, b) => sum + (b.endHour - b.startHour), 0);
  const avgPerDay = days > 0 ? (totalBookings / days).toFixed(1) : '0';
  const utilizationRate = Math.round((totalHours / (rooms.length * days * 14)) * 100);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 14 }, (_, i) => i + 7);

  function handleExport() {
    const csv = ['Date,Room,User,Start,End,Purpose,Status'];
    filteredBookings.forEach((b) => {
      const room = rooms.find((r) => r.id === b.roomId);
      csv.push(`${b.date},${room?.name || ''},${b.userName},${b.startHour}:00,${b.endHour}:00,"${b.purpose}",${b.status}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cclbs-report-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function heatColor(value: number): string {
    if (value === 0) return 'bg-slate-50';
    const ratio = value / maxHeat;
    if (ratio > 0.75) return 'bg-brand-700';
    if (ratio > 0.5) return 'bg-brand-500';
    if (ratio > 0.25) return 'bg-brand-300';
    return 'bg-brand-100';
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Reports & Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5">Room utilization and booking trends.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value as 'week' | 'month' | 'all')} className="w-36">
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="all">Last 90 days</option>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BarChart3} label="Total Bookings" value={totalBookings} color="brand" />
        <StatCard icon={Clock} label="Total Hours" value={totalHours} color="teal" />
        <StatCard icon={Calendar} label="Avg / Day" value={avgPerDay} color="amber" />
        <StatCard icon={TrendingUp} label="Utilization Rate" value={`${utilizationRate}%`} color="slate" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Bar chart - room utilization */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Room Utilization</h3>
          <p className="text-xs text-slate-400 mb-4">Total booked hours per room</p>
          <div className="space-y-3">
            {roomUtilization.map((r) => (
              <div key={r.code}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">{r.name}</span>
                  <span className="text-xs text-slate-400">{r.hours}h · {r.count} bookings</span>
                </div>
                <div className="h-7 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${(r.hours / maxHours) * 100}%` }}
                  >
                    <span className="text-[10px] font-semibold text-white">{r.hours}h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Line chart - bookings over time */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Booking Trends</h3>
          <p className="text-xs text-slate-400 mb-4">Daily bookings over the selected period</p>
          <div className="relative h-48 flex items-end gap-px">
            {bookingsOverTime.map((d, i) => {
              const height = (d.count / maxBookingsPerDay) * 100;
              return (
                <div key={i} className="flex-1 group relative">
                  <div
                    className="w-full rounded-t bg-teal-400 hover:bg-teal-600 transition-all duration-200 cursor-pointer"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  {d.count > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                        {d.count} on {d.date.slice(5)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400">
            <span>{bookingsOverTime[0]?.date.slice(5)}</span>
            <span>{bookingsOverTime[bookingsOverTime.length - 1]?.date.slice(5)}</span>
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Peak Time Heatmap</h3>
            <p className="text-xs text-slate-400 mt-0.5">Booking density by day and hour</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Less</span>
            <span className="h-3 w-3 rounded bg-slate-50 border border-slate-200" />
            <span className="h-3 w-3 rounded bg-brand-100" />
            <span className="h-3 w-3 rounded bg-brand-300" />
            <span className="h-3 w-3 rounded bg-brand-500" />
            <span className="h-3 w-3 rounded bg-brand-700" />
            <span>More</span>
          </div>
        </div>

        {/* Heatmap grid */}
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[600px]">
            {/* Hour headers */}
            <div className="grid grid-cols-[40px_repeat(14,1fr)] gap-1 mb-1">
              <div />
              {hourLabels.map((h) => (
                <div key={h} className="text-center text-[9px] font-medium text-slate-400">
                  {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
                </div>
              ))}
            </div>
            {/* Day rows */}
            {dayLabels.map((day, dayIdx) => (
              <div key={day} className="grid grid-cols-[40px_repeat(14,1fr)] gap-1 mb-1">
                <div className="flex items-center text-[10px] font-medium text-slate-500">{day}</div>
                {hourLabels.map((_, hourIdx) => {
                  const value = heatmapData[dayIdx][hourIdx];
                  return (
                    <div
                      key={hourIdx}
                      className={cn(
                        'aspect-square rounded transition-all hover:ring-2 hover:ring-brand-400 cursor-pointer',
                        heatColor(value),
                      )}
                      title={`${day} ${hourLabels[hourIdx]}:00 — ${value} booking${value !== 1 ? 's' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Calendar; label: string; value: string | number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    brand: { bg: 'bg-brand-50', text: 'text-brand-700' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colors[color].bg, colors[color].text)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}
