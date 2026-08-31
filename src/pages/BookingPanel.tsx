import { useState, useMemo, useEffect } from 'react';
import { X, CalendarDays, Clock, MapPin, Users, AlertTriangle, Check, Mail, CalendarPlus, ArrowLeft } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { Button, Input, Textarea, Avatar } from '@/components/ui';
import { cn, formatHourRange, formatDateLong, formatHourShort } from '@/lib/utils';
import type { Room } from '@/types';

interface BookingPanelProps {
  room: Room;
  date: string;
  startHour: number;
  endHour: number;
  onClose: () => void;
}

type Stage = 'form' | 'success';

export function BookingPanel({ room, date, startHour, endHour, onClose }: BookingPanelProps) {
  const { bookings, addBooking, currentUser } = useApp();
  const [stage, setStage] = useState<Stage>('form');
  const [startTime, setStartTime] = useState(startHour);
  const [duration, setDuration] = useState(endHour - startHour);
  const [purpose, setPurpose] = useState('');
  const [confirmedCode, setConfirmedCode] = useState('');
  const [error, setError] = useState('');

  const computedEnd = startTime + duration;

  const conflicts = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.roomId === room.id &&
          b.date === date &&
          b.status !== 'cancelled' &&
          b.status !== 'rejected' &&
          startTime < b.endHour &&
          computedEnd > b.startHour,
      ),
    [bookings, room.id, date, startTime, computedEnd],
  );

  const hasConflict = conflicts.length > 0;
  const isValid = purpose.trim().length >= 3 && !hasConflict && duration > 0;

  function handleConfirm() {
    if (!isValid) {
      if (purpose.trim().length < 3) setError('Please enter a purpose (at least 3 characters).');
      return;
    }
    const booking = addBooking({
      roomId: room.id,
      date,
      startHour: startTime,
      endHour: computedEnd,
      purpose: purpose.trim(),
      status: currentUser?.role === 'admin' ? 'confirmed' : 'pending',
    });
    setConfirmedCode(booking.code);
    setStage('success');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-pop animate-slide-in-right flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {stage === 'success' && (
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 focus-ring">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-base font-semibold text-slate-800">
              {stage === 'form' ? 'Book a Room' : 'Booking Confirmed'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-ring">
            <X className="h-5 w-5" />
          </button>
        </div>

        {stage === 'form' ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5 space-y-5">
            {/* Room summary */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <img src={room.image} alt={room.name} className="h-14 w-20 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{room.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{room.code} · {room.building}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.capacity}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Floor {room.floor}</span>
                </div>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Date</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 text-brand-700" />
                {formatDateLong(date)}
              </div>
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Time</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                    <option key={h} value={h}>{formatHourShort(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time summary */}
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm text-brand-700">
              <Clock className="h-4 w-4" />
              {formatHourRange(startTime, computedEnd)}
            </div>

            {/* Conflict warning */}
            {hasConflict && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">Time conflict detected</p>
                    <p className="text-xs text-red-600 mt-1">
                      {conflicts.length} booking{conflicts.length > 1 ? 's' : ''} overlap with this time:
                    </p>
                    <div className="mt-2 space-y-1">
                      {conflicts.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 rounded-md bg-white/60 px-2 py-1.5 text-xs text-red-700">
                          <Clock className="h-3 w-3" />
                          {formatHourRange(c.startHour, c.endHour)} — {c.purpose}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Purpose */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Purpose of Booking</label>
              <Textarea
                value={purpose}
                onChange={(e) => { setPurpose(e.target.value); setError(''); }}
                placeholder="e.g. Data Structures lab session, Faculty meeting, Project presentation…"
                rows={3}
              />
              {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
            </div>
          </div>
        ) : (
          /* Success state */
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-6 flex flex-col items-center text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600 mb-4 animate-scale-in">
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Booking Confirmed!</h3>
            <p className="text-sm text-slate-500 mt-1">Your room has been reserved successfully.</p>

            <div className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs text-slate-500">Confirmation Code</span>
                <span className="text-sm font-bold text-brand-700 font-mono">{confirmedCode}</span>
              </div>
              <div className="space-y-2.5 mt-3">
                <DetailRow icon={MapPin} label="Room" value={`${room.name} (${room.code})`} />
                <DetailRow icon={CalendarDays} label="Date" value={formatDateLong(date)} />
                <DetailRow icon={Clock} label="Time" value={formatHourRange(startTime, computedEnd)} />
                <DetailRow icon={Users} label="Capacity" value={`${room.capacity} seats`} />
              </div>
            </div>

            <div className="mt-4 w-full flex items-center gap-2 rounded-lg bg-teal-50 px-3.5 py-2.5 text-sm text-teal-700">
              <Mail className="h-4 w-4 shrink-0" />
              A confirmation email has been sent to your university email.
            </div>

            <div className="mt-5 w-full space-y-2">
              <Button className="w-full" variant="outline">
                <CalendarPlus className="h-4 w-4" />
                Add to Calendar
              </Button>
              <Button className="w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {stage === 'form' && (
          <div className="border-t border-slate-200 px-5 py-4 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!isValid} onClick={handleConfirm}>
              {hasConflict ? 'Resolve Conflict' : 'Confirm Booking'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-slate-400 shrink-0" />
      <span className="text-xs text-slate-500 w-16">{label}</span>
      <span className="text-sm font-medium text-slate-700 flex-1">{value}</span>
    </div>
  );
}
