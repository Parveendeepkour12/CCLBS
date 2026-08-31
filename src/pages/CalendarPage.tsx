import { useState, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Info, X, AlertTriangle, Check, Clock, MapPin, Users } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button, Select, Skeleton, Avatar } from '@/components/ui';
import { cn, formatHourShort, formatHourRange, formatDateLong, todayISO, getWeekStart, getWeekDates, isToday } from '@/lib/utils';
import { BookingPanel } from '@/pages/BookingPanel';
import type { CalendarView, Room } from '@/types';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM – 8 PM

export function CalendarPage() {
  const { rooms, bookings } = useApp();
  const [view, setView] = useState<CalendarView>('week');
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || '');
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<{ date: string; startHour: number; endHour: number } | null>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const displayDates = view === 'week' ? weekDates : [selectedDate];

  const roomBookings = useMemo(
    () => bookings.filter((b) => b.roomId === selectedRoomId && b.status !== 'cancelled' && b.status !== 'rejected'),
    [bookings, selectedRoomId],
  );

  function getBookingForSlot(date: string, hour: number) {
    return roomBookings.find((b) => b.date === date && hour >= b.startHour && hour < b.endHour);
  }

  function isSlotBooked(date: string, hour: number): boolean {
    return roomBookings.some((b) => b.date === date && hour >= b.startHour && hour < b.endHour);
  }

  function isSlotPending(date: string, hour: number): boolean {
    return roomBookings.some((b) => b.date === date && b.status === 'pending' && hour >= b.startHour && hour < b.endHour);
  }

  // Drag-to-select state
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null); // absolute hour index
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  function absHour(dateIdx: number, hourIdx: number): number {
    return dateIdx * 24 + hourIdx;
  }

  function unabsHour(abs: number): { dateIdx: number; hour: number } {
    return { dateIdx: Math.floor(abs / 24), hour: abs % 24 };
  }

  const handleSlotDown = useCallback(
    (dateIdx: number, hourIdx: number) => {
      const date = displayDates[dateIdx];
      if (isSlotBooked(date, HOURS[hourIdx])) return;
      setDragging(true);
      const abs = absHour(dateIdx, hourIdx);
      setDragStart(abs);
      setDragEnd(abs);
    },
    [displayDates, roomBookings],
  );

  const handleSlotEnter = useCallback(
    (dateIdx: number, hourIdx: number) => {
      if (!dragging) return;
      const date = displayDates[dateIdx];
      if (isSlotBooked(date, HOURS[hourIdx])) return;
      const abs = absHour(dateIdx, hourIdx);
      setDragEnd((prev) => {
        if (prev === null) return abs;
        return prev;
      });
      setDragEnd(abs);
    },
    [dragging, displayDates, roomBookings],
  );

  function finishDrag() {
    if (dragging && dragStart !== null && dragEnd !== null) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      const loUn = unabsHour(lo);
      const hiUn = unabsHour(hi);
      const date = displayDates[loUn.dateIdx];
      const startHour = HOURS[loUn.hour];
      const endHour = HOURS[hiUn.hour] + 1;
      // Check no booked slots in range
      let canBook = true;
      for (let h = loUn.hour; h <= hiUn.hour; h++) {
        if (isSlotBooked(date, HOURS[h])) {
          canBook = false;
          break;
        }
      }
      if (canBook) {
        setDraft({ date, startHour, endHour });
        setPanelOpen(true);
      }
    }
    setDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }

  function handleSingleClick(date: string, hour: number) {
    if (isSlotBooked(date, hour)) return;
    setDraft({ date, startHour: hour, endHour: hour + 1 });
    setPanelOpen(true);
  }

  function isDragSelected(dateIdx: number, hourIdx: number): boolean {
    if (!dragging || dragStart === null || dragEnd === null) return false;
    const abs = absHour(dateIdx, hourIdx);
    return abs >= Math.min(dragStart, dragEnd) && abs <= Math.max(dragStart, dragEnd);
  }

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }
  function goToday() {
    setWeekStart(getWeekStart(new Date()));
    setSelectedDate(todayISO());
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="min-w-[200px]">
            {rooms.filter((r) => r.active).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.code}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-2 text-sm font-medium transition-colors focus-ring', view === 'week' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
            >
              <CalendarRange className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('day')}
              className={cn('px-3 py-2 text-sm font-medium transition-colors focus-ring', view === 'day' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-ring" aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={nextWeek} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-ring" aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Room info bar */}
      {selectedRoom && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-soft">
          <img src={selectedRoom.image} alt={selectedRoom.name} className="h-10 w-14 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{selectedRoom.name}</p>
            <p className="text-xs text-slate-400">{selectedRoom.code} · {selectedRoom.building}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{selectedRoom.capacity}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Floor {selectedRoom.floor}</span>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-teal-100 border border-teal-300" />Available</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-300" />Pending</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100 border border-red-300" />Booked</span>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {/* Day headers */}
          <div
            className={cn(
              'grid border-b border-slate-200 bg-slate-50',
              view === 'week' ? 'grid-cols-[60px_repeat(7,1fr)]' : 'grid-cols-[60px_1fr]',
            )}
          >
            <div className="p-2.5" />
            {displayDates.map((date) => {
              const d = new Date(date + 'T00:00:00');
              const today = isToday(date);
              return (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    if (view === 'week') setView('day');
                  }}
                  className={cn(
                    'p-2.5 text-center transition-colors hover:bg-slate-100 focus-ring',
                    view === 'day' && 'cursor-default',
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                      today ? 'bg-brand-700 text-white' : 'text-slate-700',
                    )}
                  >
                    {d.getDate()}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            ref={gridRef}
            className={cn(
              'grid no-select',
              view === 'week' ? 'grid-cols-[60px_repeat(7,1fr)]' : 'grid-cols-[60px_1fr]',
            )}
            onMouseLeave={finishDrag}
            onMouseUp={finishDrag}
          >
            {/* Hour labels */}
            <div className="flex flex-col">
              {HOURS.map((h) => (
                <div key={h} className="h-12 flex items-start justify-end pr-2 pt-1 text-[10px] font-medium text-slate-400 border-r border-slate-100">
                  {formatHourShort(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {displayDates.map((date, dateIdx) => (
              <div key={date} className="border-l border-slate-100">
                {HOURS.map((hour, hourIdx) => {
                  const booking = getBookingForSlot(date, hour);
                  const booked = isSlotBooked(date, hour);
                  const pending = isSlotPending(date, hour);
                  const selected = isDragSelected(dateIdx, hourIdx);
                  const isStart = booking && hour === booking.startHour;

                  return (
                    <div
                      key={hour}
                      onMouseDown={() => handleSlotDown(dateIdx, hourIdx)}
                      onMouseEnter={() => handleSlotEnter(dateIdx, hourIdx)}
                      onClick={() => {
                        if (!dragging && !booked) handleSingleClick(date, hour);
                      }}
                      className={cn(
                        'h-12 border-b border-slate-100 relative cursor-pointer transition-colors group',
                        booked && 'cursor-not-allowed',
                        selected && 'bg-brand-200/60 ring-1 ring-inset ring-brand-500',
                        !booked && !selected && 'hover:bg-teal-50',
                      )}
                    >
                      {/* Booking block */}
                      {isStart && booking && (
                        <div
                          className={cn(
                            'absolute inset-x-0.5 top-0.5 bottom-0.5 rounded-md px-2 py-1 z-10 overflow-hidden',
                            booking.status === 'pending' ? 'bg-amber-100 border border-amber-300' : 'bg-red-100 border border-red-300',
                          )}
                          style={{ height: `calc(${booking.endHour - booking.startHour} * 3rem - 4px)` }}
                        >
                          <p className={cn('text-[11px] font-semibold truncate', booking.status === 'pending' ? 'text-amber-800' : 'text-red-800')}>
                            {booking.purpose}
                          </p>
                          <p className={cn('text-[10px] truncate', booking.status === 'pending' ? 'text-amber-700' : 'text-red-700')}>
                            {formatHourShort(booking.startHour)}–{formatHourShort(booking.endHour)}
                          </p>
                          {booking.userName && (
                            <p className={cn('text-[10px] truncate mt-0.5', booking.status === 'pending' ? 'text-amber-600' : 'text-red-600')}>
                              {booking.userName}
                            </p>
                          )}
                        </div>
                      )}
                      {/* Hover tooltip */}
                      {!booked && !selected && (
                        <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-white whitespace-nowrap">
                            {formatHourShort(hour)} — Available
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Info className="h-3.5 w-3.5" />
        Click a time slot to book, or drag across multiple slots to select a time range.
      </div>

      {/* Booking slide-over */}
      {panelOpen && draft && selectedRoom && (
        <BookingPanel
          room={selectedRoom}
          date={draft.date}
          startHour={draft.startHour}
          endHour={draft.endHour}
          onClose={() => {
            setPanelOpen(false);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}
