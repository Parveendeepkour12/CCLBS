import { useMemo, useState } from 'react';
import { CalendarRange, CalendarX2, Clock, MapPin, X, Pencil, Check, AlertTriangle, Mail, CalendarPlus, ArrowLeft } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Card, Button, StatusBadge, EmptyState, Modal, Avatar } from '@/components/ui';
import { cn, formatDate, formatHourRange, todayISO } from '@/lib/utils';
import type { Booking } from '@/types';

type Tab = 'upcoming' | 'past';

export function MyBookingsPage() {
  const { currentUser, bookings, rooms, cancelBooking, updateBooking, navigate } = useApp();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);

  const myBookings = useMemo(
    () => bookings.filter((b) => b.userId === currentUser?.id).sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour),
    [bookings, currentUser],
  );

  const today = todayISO();
  const upcoming = myBookings.filter((b) => b.date >= today && b.status !== 'cancelled' && b.status !== 'rejected');
  const past = myBookings.filter((b) => b.date < today || b.status === 'cancelled' || b.status === 'rejected');
  const display = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setTab('upcoming')}
          className={cn('rounded-md px-4 py-2 text-sm font-medium transition-all focus-ring', tab === 'upcoming' ? 'bg-white text-slate-800 shadow-soft' : 'text-slate-500 hover:text-slate-700')}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={cn('rounded-md px-4 py-2 text-sm font-medium transition-all focus-ring', tab === 'past' ? 'bg-white text-slate-800 shadow-soft' : 'text-slate-500 hover:text-slate-700')}
        >
          Past ({past.length})
        </button>
      </div>

      {display.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? <CalendarRange className="h-8 w-8" /> : <CalendarX2 className="h-8 w-8" />}
          title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          message={tab === 'upcoming' ? 'You have no upcoming room reservations. Book a room to get started.' : 'Your booking history will appear here once you have past reservations.'}
          action={tab === 'upcoming' ? <Button onClick={() => navigate('calendar')}>Book a Room</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {display.map((b) => {
            const room = rooms.find((r) => r.id === b.roomId);
            if (!room) return null;
            return (
              <Card key={b.id} hover className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Date block */}
                  <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 shrink-0">
                    <span className="text-lg font-bold leading-none">{new Date(b.date + 'T00:00:00').getDate()}</span>
                    <span className="text-[10px] uppercase mt-0.5">
                      {new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800">{b.purpose}</h3>
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{b.code}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{room.name} ({room.code})</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatHourRange(b.startHour, b.endHour)}</span>
                      <span className="flex items-center gap-1"><CalendarRange className="h-3.5 w-3.5" />{formatDate(b.date)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {tab === 'upcoming' && b.status !== 'cancelled' && b.status !== 'rejected' && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setEditTarget(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modify
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setCancelTarget(b)}>
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <Modal onClose={() => setCancelTarget(null)} title="Cancel Booking">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Are you sure you want to cancel this booking?</p>
                <p className="text-xs text-slate-500 mt-1">
                  {cancelTarget.purpose} · {formatDate(cancelTarget.date)} · {formatHourRange(cancelTarget.startHour, cancelTarget.endHour)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 px-6 pb-6">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelTarget(null)}>
              Keep Booking
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => { cancelBooking(cancelTarget.id); setCancelTarget(null); }}>
              Yes, Cancel
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditBookingModal
          booking={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(patch) => {
            updateBooking(editTarget.id, patch);
            setEditTarget(null);
          }}
        />
      )}

      {/* Success modal */}
      {successBooking && (
        <Modal onClose={() => setSuccessBooking(null)}>
          <div className="p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600 mb-4 animate-scale-in">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Booking Updated!</h3>
            <p className="text-sm text-slate-500 mt-1">Your booking has been modified successfully.</p>
            <p className="text-xs font-mono text-brand-700 mt-3">{successBooking.code}</p>
            <div className="mt-5 space-y-2">
              <Button className="w-full" variant="outline">
                <CalendarPlus className="h-4 w-4" />
                Add to Calendar
              </Button>
              <Button className="w-full" onClick={() => setSuccessBooking(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditBookingModal({
  booking,
  onClose,
  onSave,
}: {
  booking: Booking;
  onClose: () => void;
  onSave: (patch: Partial<Booking>) => void;
}) {
  const { rooms } = useApp();
  const room = rooms.find((r) => r.id === booking.roomId);
  const [startHour, setStartHour] = useState(booking.startHour);
  const [duration, setDuration] = useState(booking.endHour - booking.startHour);
  const [purpose, setPurpose] = useState(booking.purpose);

  return (
    <Modal onClose={onClose} title="Modify Booking">
      <div className="p-6 space-y-4">
        {room && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <img src={room.image} alt={room.name} className="h-12 w-16 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{room.name}</p>
              <p className="text-xs text-slate-400">{room.code} · {formatDate(booking.date)}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Time</label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                <option key={h} value={h}>{h}:00 {h >= 12 ? 'PM' : 'AM'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Purpose</label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <Clock className="h-4 w-4" />
          {formatHourRange(startHour, startHour + duration)}
        </div>
      </div>
      <div className="flex gap-3 px-6 pb-6">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={() => onSave({ startHour, endHour: startHour + duration, purpose })}>
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
